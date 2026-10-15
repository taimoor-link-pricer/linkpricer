/**
 * Key checking, quota claiming and request reading for the public API.
 *
 * Moved here verbatim from batch-handler.ts when the search endpoint was
 * added. Both endpoints draw on the same monthly quota with the same key, so
 * the statement that authenticates a key and claims lookups has to be ONE
 * statement in one place: a second copy that drifted would mean two endpoints
 * disagreeing about what a customer has left.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import {
  jsonError,
  monthWindow,
  NO_STORE,
  rateLimitHeaders,
  secondsUntilNextMonthUtc,
} from "@/lib/public-api/common";

export interface ClaimRow {
  id: string;
  user_id: string;
  is_active: boolean;
  blocked: boolean;
  expired: boolean;
  expires_at: string | null;
  month_limit: number;
  per_minute_limit: number;
  month_used_before: number;
  month_used: number | null;
  minute_used: number | null;
  allowed: boolean;
  minute_blocked: boolean;
  month_blocked: boolean;
}

type KeyStateRow = Pick<ClaimRow, "is_active" | "blocked" | "expired" | "expires_at">;

/** A request refused as a whole: nothing is looked up and no quota is used. */
export interface RequestRejection {
  status: 400 | 413 | 422;
  code: string;
  message: string;
  /** Per-entry detail, on the one batch rejection that carries it. */
  results?: unknown;
}

export function errorWith(err: RequestRejection): NextResponse {
  const body: Record<string, unknown> = { error: err.code, message: err.message, status: err.status };
  if (err.results) body.results = err.results;
  return NextResponse.json(body, { status: err.status, headers: NO_STORE });
}

/**
 * The 401 for a key that cannot be used, or null if it can. All three causes
 * share the documented `invalid_api_key` code — an integrator branches on
 * that — but say which one it is, because "invalid" sends someone whose trial
 * simply ran out hunting for a typo in their key.
 */
export function refusalFor(k: KeyStateRow | undefined): NextResponse | null {
  if (!k || !k.is_active) return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  if (k.blocked) {
    return jsonError("invalid_api_key", "This API key has been blocked. Contact Linkpricer support.", 401);
  }
  if (k.expired) {
    const on = k.expires_at ? ` on ${new Date(k.expires_at).toISOString().slice(0, 10)}` : "";
    return jsonError("invalid_api_key", `This API key expired${on}.`, 401);
  }
  return null;
}

/**
 * Is this key usable? Read-only, and only used on the request-rejection
 * paths, so that a malformed request with a bad key still gets the 401 an
 * integrator expects to see first — without touching any counter.
 */
export async function keyRefusal(keyHash: string): Promise<NextResponse | null> {
  const r = await db.execute(sql`
    SELECT is_active,
           blocked_at IS NOT NULL                             AS blocked,
           (expires_at IS NOT NULL AND expires_at <= NOW())   AS expired,
           expires_at
    FROM api_keys WHERE key_hash = ${keyHash} LIMIT 1
  `);
  return refusalFor(r.rows[0] as KeyStateRow | undefined);
}

/**
 * Rejects a request we will not look anything up for. The key is still
 * checked (read-only), so a bad key is reported as 401, not as the body's
 * own 4xx.
 */
export async function rejectRequest(keyHash: string, err: RequestRejection, tag: string): Promise<NextResponse> {
  try {
    const refusal = await keyRefusal(keyHash);
    if (refusal) return refusal;
  } catch (e) {
    // The request is being rejected either way; if the key check itself
    // fails, report the request's own error rather than turning it into a 500.
    console.error(`${tag} key check failed`, e);
  }
  return errorWith(err);
}

/**
 * Reads and parses a JSON body of at most `maxBytes`. `example` is the body
 * shape quoted back in the invalid_json message.
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number,
  example: string
): Promise<{ ok: true; json: unknown } | { ok: false; error: RequestRejection }> {
  const tooLarge: RequestRejection = {
    status: 413,
    code: "payload_too_large",
    message: `Request body exceeds ${maxBytes} bytes.`,
  };
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) return { ok: false, error: tooLarge };

  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, error: { status: 400, code: "invalid_json", message: "Could not read the request body." } };
  }
  // Content-Length can be absent (chunked) or wrong, so the actual size is
  // what is enforced; the header check above only saves reading a body that
  // announces itself as too big.
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false, error: tooLarge };

  try {
    return { ok: true, json: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      error: {
        status: 400,
        code: "invalid_json",
        message: `Request body is not valid JSON. Send Content-Type: application/json with ${example}.`,
      },
    };
  }
}

/** The minute and month a claim is counted against, fixed once per request. */
export interface ClaimWindow {
  now: Date;
  minuteBucket: number;
  month: string;
  /** Epoch seconds of the next monthly reset (1st, 00:00 UTC). */
  monthResetEpoch: number;
}

export function claimWindow(now = new Date()): ClaimWindow {
  return {
    now,
    minuteBucket: Math.floor(now.getTime() / 60000),
    month: monthWindow(now),
    monthResetEpoch: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0) / 1000),
  };
}

/**
 * Authenticates the key and claims `units` lookups in one statement. `k`
 * snapshots the key before the update so that a refusal can say which limit
 * refused it. The claim is admitted only when ALL of it fits the remaining
 * monthly quota: a partial answer would leave the caller to work out which
 * part of their request was served.
 *
 * Throws when the statement fails; nothing was claimed in that case, because
 * the claim and the key check are one statement and it failed as a whole.
 */
export async function claimLookups(keyHash: string, units: number, w: ClaimWindow): Promise<ClaimRow | undefined> {
  const { minuteBucket, month } = w;
  const auth = await db.execute(sql`
    WITH k AS (
      SELECT id, user_id, is_active, per_minute_limit,
             blocked_at IS NOT NULL                           AS blocked,
             (expires_at IS NOT NULL AND expires_at <= NOW()) AS expired,
             expires_at,
             COALESCE(monthly_limit, daily_limit * 30) AS month_limit,
             minute_window, minute_count, month_window, month_count
      FROM api_keys
      WHERE key_hash = ${keyHash}
      LIMIT 1
    ),
    bumped AS (
      UPDATE api_keys a
      SET minute_count  = CASE WHEN a.minute_window = ${minuteBucket} THEN a.minute_count + 1 ELSE 1 END,
          minute_window = ${minuteBucket},
          month_count   = CASE WHEN a.month_window = ${month} THEN a.month_count ELSE 0 END + ${units}::int,
          month_window  = ${month},
          last_used_at  = NOW()
      FROM k
      WHERE a.id = k.id
        AND k.is_active
        AND NOT k.blocked
        AND NOT k.expired
        AND (a.minute_window IS DISTINCT FROM ${minuteBucket} OR a.minute_count < a.per_minute_limit)
        AND (CASE WHEN a.month_window = ${month} THEN a.month_count ELSE 0 END) + ${units}::int
            <= COALESCE(a.monthly_limit, a.daily_limit * 30)
      RETURNING a.id, a.month_count, a.minute_count
    )
    SELECT
      k.id,
      k.user_id,
      k.is_active,
      k.blocked,
      k.expired,
      k.expires_at,
      k.month_limit,
      k.per_minute_limit,
      (CASE WHEN k.month_window = ${month} THEN k.month_count ELSE 0 END)          AS month_used_before,
      (SELECT month_count FROM bumped)                                              AS month_used,
      (SELECT minute_count FROM bumped)                                             AS minute_used,
      (SELECT COUNT(*) FROM bumped) > 0                                             AS allowed,
      (k.minute_window = ${minuteBucket} AND k.minute_count >= k.per_minute_limit)  AS minute_blocked,
      ((CASE WHEN k.month_window = ${month} THEN k.month_count ELSE 0 END) + ${units}::int > k.month_limit) AS month_blocked
    FROM k
  `);
  return auth.rows[0] as unknown as ClaimRow | undefined;
}

/**
 * The 429 (or 401) for a claim that was not admitted. `shortfall` words the
 * case where some quota remains but not enough for this request, which is the
 * one message that differs by endpoint.
 */
export function claimDenial(
  k: ClaimRow,
  w: ClaimWindow,
  shortfall: (remaining: number, monthLimit: number) => string
): NextResponse {
  const monthLimit = Number(k.month_limit);
  const minuteLimit = Number(k.per_minute_limit);
  const usedBefore = Number(k.month_used_before);

  if (k.minute_blocked) {
    return jsonError(
      "rate_limit_exceeded",
      "Per-minute rate limit exceeded. See Retry-After header.",
      429,
      { "Retry-After": "60", ...rateLimitHeaders(monthLimit, usedBefore, minuteLimit, minuteLimit, w.monthResetEpoch) }
    );
  }
  if (k.month_blocked) {
    const remaining = Math.max(0, monthLimit - usedBefore);
    const message =
      remaining === 0
        ? `Monthly quota of ${monthLimit} lookups reached. Resets on the 1st at 00:00 UTC.`
        : shortfall(remaining, monthLimit);
    return jsonError(
      "quota_exceeded",
      message,
      429,
      { "Retry-After": String(secondsUntilNextMonthUtc(w.now)), ...rateLimitHeaders(monthLimit, usedBefore, minuteLimit, null, w.monthResetEpoch) }
    );
  }
  return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
}

/**
 * Hands back `n` of the lookups claimed. Scoped to the claim's month window
 * so a refund can never land in the next month's counter if the call
 * straddled midnight on the 1st. Returns the counter after the refund, so the
 * headers report what the caller actually has left.
 */
export async function refundLookups(keyId: string, month: string, n: number, tag: string): Promise<number | null> {
  if (n <= 0) return null;
  try {
    const r = await db.execute(sql`
      UPDATE api_keys
      SET month_count = GREATEST(month_count - ${n}::int, 0)
      WHERE id = ${keyId} AND month_window = ${month}
      RETURNING month_count
    `);
    const row = r.rows[0] as { month_count: number } | undefined;
    return row ? Number(row.month_count) : null;
  } catch (err) {
    console.error(`${tag} quota refund of ${n} failed`, err);
    return null;
  }
}

/**
 * History, not enforcement — the counters on api_keys are the limit — so it
 * is written after the response, one row per domain.
 */
export function logLookups(
  k: Pick<ClaimRow, "id" | "user_id">,
  statuses: { domain: string; status: number }[],
  latencyMs: number,
  tag: string
): void {
  after(async () => {
    if (statuses.length === 0) return;
    try {
      const rows = sql.join(
        statuses.map((s) => sql`(${k.id}, ${k.user_id}, ${s.domain}, ${s.status}, ${latencyMs})`),
        sql`, `
      );
      await db.execute(sql`
        INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
        VALUES ${rows}
      `);
    } catch (err) {
      console.error(`${tag} log write failed`, err);
    }
  });
}
