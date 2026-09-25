/**
 * The batch pricing endpoint (v2): POST /api/v2/public/domains/pricing.
 *
 * Up to 200 domains per call, each answered with the exact per-domain body v1
 * returns (buildPricingBody). v1 is untouched by this endpoint and stays the
 * single-domain contract existing integrators already use.
 *
 * Quota is metered per domain, not per call: a batch of N distinct valid
 * domains claims N lookups from the monthly quota up front — atomically, in
 * the statement that authenticates the key, like v1 — and hands back one for
 * every domain the catalogue does not contain. Counting a 200-domain batch as
 * one request would make a 10,000/month plan worth 2,000,000 lookups. The
 * per-minute limit counts calls, since it exists to protect the database from
 * bursts, and one batch is one round of queries.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getUsdRates } from "@/lib/currency";
import {
  domainForms,
  hashKey,
  jsonError,
  jsonOk,
  monthWindow,
  NO_STORE,
  normalizeCountry,
  rateLimitHeaders,
  secondsUntilNextMonthUtc,
  toOffer,
} from "@/lib/public-api/common";
import {
  buildBatchBody,
  MAX_BODY_BYTES,
  parseBatchRequest,
  type BatchRequestError,
  type ParsedBatch,
} from "@/lib/public-api/batch";
import { buildPricingBody, type PricingBody } from "@/lib/public-api/shape";

const TAG = "[/api/v2/public/domains/pricing]";

interface ClaimRow {
  id: string;
  user_id: string;
  is_active: boolean;
  month_limit: number;
  per_minute_limit: number;
  month_used_before: number;
  month_used: number | null;
  minute_used: number | null;
  allowed: boolean;
  minute_blocked: boolean;
  month_blocked: boolean;
}

interface CatalogRow {
  req_domain: string;
  domain_row: Record<string, unknown> | null;
  offers: Record<string, unknown>[] | null;
}

type RequestRejection =
  | BatchRequestError
  | { status: 400 | 413; code: string; message: string; results?: undefined };

function errorWith(err: RequestRejection): NextResponse {
  const body: Record<string, unknown> = { error: err.code, message: err.message, status: err.status };
  if (err.results) body.results = err.results;
  return NextResponse.json(body, { status: err.status, headers: NO_STORE });
}

/**
 * Is this key usable? Read-only, and only used on the request-rejection
 * paths, so that a malformed request with a bad key still gets the 401 an
 * integrator expects to see first — without touching any counter.
 */
async function keyIsActive(keyHash: string): Promise<boolean> {
  const r = await db.execute(sql`
    SELECT is_active FROM api_keys WHERE key_hash = ${keyHash} LIMIT 1
  `);
  const row = r.rows[0] as { is_active: boolean } | undefined;
  return !!row?.is_active;
}

/**
 * Offers, metrics and freshness for every requested domain in ONE round trip.
 *
 * This is v1's catalogue query (lib/public-api/handler.ts) made set-based,
 * with every rule it carries preserved per requested domain:
 *   - every spelling of a host is matched (case variants and unicode/punycode
 *     forms are separate `domains` rows) and their offers pooled;
 *   - metrics come from the most-populated of those rows, chosen
 *     deterministically;
 *   - one offer per marketplace, cheapest quote winning, with app./panel.
 *     twins of the same marketplace collapsed to one source;
 *   - active vendor (supplier_offers) rows included, never trusted.
 * scripts/verify-public-api-v2.mts checks the result matches v1 domain by
 * domain against the live catalogue.
 */
export function catalogQuery(domains: string[]): SQL {
  const pairs = domains.flatMap((d) => domainForms(d).map((f) => [d, f] as const));
  const values = sql.join(
    pairs.map(([d, f]) => sql`(${d}::text, ${f}::text)`),
    sql`, `
  );

  return sql`
    WITH req(req_domain, form) AS (VALUES ${values}),
    d AS (
      SELECT req.req_domain, dm.id, dm.domain, dm.domain_rating, dm.org_traffic,
             dm.ref_domains, dm.country_main_traffic
      FROM req
      JOIN domains dm ON lower(dm.domain) = req.form
    ),
    best_domain AS (
      SELECT DISTINCT ON (req_domain) *
      FROM d
      ORDER BY
        req_domain,
        (domain_rating IS NOT NULL AND domain_rating > 0) DESC,
        COALESCE(org_traffic, 0) DESC,
        COALESCE(ref_domains, 0) DESC,
        domain ASC
    ),
    offers AS (
      SELECT * FROM (
        SELECT DISTINCT ON (d.req_domain, regexp_replace(lower(o.marketplace_name), '^(app|panel)\\.', ''))
          d.req_domain,
          o.currency,
          o.min_price, o.max_price,
          o.gambling_min_price, o.gambling_max_price,
          o.adult_min_price, o.adult_max_price,
          o.cbd_min_price, o.cbd_max_price,
          o.loan_min_price, o.loan_max_price,
          o.dating_min_price, o.dating_max_price,
          o.crypto_min_price, o.crypto_max_price,
          o.trading_forex_min_price, o.trading_forex_max_price,
          o.link_insertion_min_price, o.link_insertion_max_price,
          COALESCE(m.trusted, false) AS trusted,
          GREATEST(o.updated_at::timestamp, o.last_fetched_at) AS freshness
        FROM marketplace_offers o
        JOIN d ON d.id = o.domain_id
        LEFT JOIN marketplaces m ON lower(m.name) = lower(o.marketplace_name)
        WHERE o.available = true
        ORDER BY d.req_domain,
                 regexp_replace(lower(o.marketplace_name), '^(app|panel)\\.', ''),
                 o.min_price::float ASC NULLS LAST
      ) mo

      UNION ALL

      SELECT
        req.req_domain,
        s.currency,
        s.min_price, s.max_price,
        s.gambling_min_price, s.gambling_max_price,
        s.adult_min_price, s.adult_max_price,
        s.cbd_min_price, s.cbd_max_price,
        s.loan_min_price, s.loan_max_price,
        s.dating_min_price, s.dating_max_price,
        s.crypto_min_price, s.crypto_max_price,
        s.trading_forex_min_price, s.trading_forex_max_price,
        s.link_insertion_min_price, s.link_insertion_max_price,
        false AS trusted,
        s.updated_at AS freshness
      FROM supplier_offers s
      -- Joined on the requested forms, not on d, for the reason v1 gives:
      -- d can hold several rows for one host, and joining through it would
      -- multiply every vendor offer by that row count.
      JOIN req ON lower(s.domain) = req.form
      WHERE s.status = 'active' AND s.is_active = true
    )
    SELECT
      r.req_domain,
      (SELECT row_to_json(b) FROM best_domain b WHERE b.req_domain = r.req_domain) AS domain_row,
      (SELECT json_agg(x) FROM offers x WHERE x.req_domain = r.req_domain)         AS offers
    FROM (SELECT DISTINCT req_domain FROM req) r
  `;
}

export async function fetchCatalog(domains: string[]): Promise<Map<string, CatalogRow>> {
  const result = await db.execute(catalogQuery(domains));
  const out = new Map<string, CatalogRow>();
  for (const row of result.rows as unknown as CatalogRow[]) out.set(row.req_domain, row);
  return out;
}

export async function handleBatchPricingRequest(req: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();

  // 1. Key present.
  const rawKey = req.headers.get("x-api-key");
  if (!rawKey) {
    return jsonError("missing_api_key", "Provide your API key in the x-api-key header.", 401);
  }
  const keyHash = hashKey(rawKey);

  // 2. Read and validate the body BEFORE claiming quota — the claim needs to
  //    know how many lookups this call is, and a request we reject without
  //    looking anything up must cost nothing. A rejected request still checks
  //    the key (read-only), so a bad key is reported as 401, not 4xx-body.
  const reject = async (err: RequestRejection) => {
    let active = true;
    try {
      active = await keyIsActive(keyHash);
    } catch (e) {
      // The request is being rejected either way; if the key check itself
      // fails, report the request's own error rather than turning it into a 500.
      console.error(`${TAG} key check failed`, e);
    }
    if (!active) {
      return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
    }
    return errorWith(err);
  };

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return reject({ status: 413, code: "payload_too_large", message: `Request body exceeds ${MAX_BODY_BYTES} bytes.` });
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return reject({ status: 400, code: "invalid_json", message: "Could not read the request body." });
  }
  // Content-Length can be absent (chunked) or wrong, so the actual size is
  // what is enforced; the header check above only saves reading a body that
  // announces itself as too big.
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return reject({ status: 413, code: "payload_too_large", message: `Request body exceeds ${MAX_BODY_BYTES} bytes.` });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reject({
      status: 400,
      code: "invalid_json",
      message: 'Request body is not valid JSON. Send Content-Type: application/json with { "domains": [...] }.',
    });
  }
  const parsed = parseBatchRequest(json);
  if (!parsed.ok) return reject(parsed);

  const units = parsed.unique.length;

  // 3. Authenticate and claim `units` lookups in one statement — the batch
  //    form of v1's claim. `k` snapshots the key before the update so that a
  //    refusal can say which limit refused it. A batch is admitted only when
  //    ALL of it fits the remaining monthly quota: a partial answer would
  //    leave the caller to work out which half of their list was priced.
  const now = new Date();
  const minuteBucket = Math.floor(now.getTime() / 60000);
  const month = monthWindow(now);
  const monthResetEpoch = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0) / 1000
  );

  let auth;
  try {
    auth = await db.execute(sql`
    WITH k AS (
      SELECT id, user_id, is_active, per_minute_limit,
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
        AND (a.minute_window IS DISTINCT FROM ${minuteBucket} OR a.minute_count < a.per_minute_limit)
        AND (CASE WHEN a.month_window = ${month} THEN a.month_count ELSE 0 END) + ${units}::int
            <= COALESCE(a.monthly_limit, a.daily_limit * 30)
      RETURNING a.id, a.month_count, a.minute_count
    )
    SELECT
      k.id,
      k.user_id,
      k.is_active,
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
  } catch (err) {
    // Nothing was claimed: the claim and the key check are one statement, and
    // it failed as a whole.
    console.error(`${TAG} auth/claim failed`, err);
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  const k = auth.rows[0] as unknown as ClaimRow | undefined;

  if (!k || !k.is_active) {
    return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  }

  const monthLimit = Number(k.month_limit);
  const minuteLimit = Number(k.per_minute_limit);

  if (!k.allowed) {
    if (k.minute_blocked) {
      return jsonError(
        "rate_limit_exceeded",
        "Per-minute rate limit exceeded. See Retry-After header.",
        429,
        { "Retry-After": "60", ...rateLimitHeaders(monthLimit, Number(k.month_used_before), minuteLimit, minuteLimit, monthResetEpoch) }
      );
    }
    if (k.month_blocked) {
      const remaining = Math.max(0, monthLimit - Number(k.month_used_before));
      const message =
        remaining === 0
          ? `Monthly quota of ${monthLimit} lookups reached. Resets on the 1st at 00:00 UTC.`
          : `This batch needs ${units} lookups but only ${remaining} of your ${monthLimit} monthly lookups remain. Send ${remaining} or fewer distinct domains, or wait for the reset on the 1st at 00:00 UTC.`;
      return jsonError(
        "quota_exceeded",
        message,
        429,
        { "Retry-After": String(secondsUntilNextMonthUtc(now)), ...rateLimitHeaders(monthLimit, Number(k.month_used_before), minuteLimit, null, monthResetEpoch) }
      );
    }
    return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  }

  let monthUsed = Number(k.month_used);
  const minuteUsed = k.minute_used == null ? null : Number(k.minute_used);

  // Hands back `n` of the lookups claimed above. Scoped to this month's
  // window so a refund can never land in the next month's counter if the
  // call straddled midnight on the 1st. Returns the counter after the
  // refund, so the headers report what the caller actually has left.
  const refund = async (n: number): Promise<number | null> => {
    if (n <= 0) return null;
    try {
      const r = await db.execute(sql`
        UPDATE api_keys
        SET month_count = GREATEST(month_count - ${n}::int, 0)
        WHERE id = ${k.id} AND month_window = ${month}
        RETURNING month_count
      `);
      const row = r.rows[0] as { month_count: number } | undefined;
      return row ? Number(row.month_count) : null;
    } catch (err) {
      console.error(`${TAG} quota refund of ${n} failed`, err);
      return null;
    }
  };

  const log = (statuses: { domain: string; status: number }[]) => {
    const latencyMs = Date.now() - startMs;
    // History, not enforcement — the counters on api_keys are the limit — so
    // it is written after the response, one row per domain looked up, the
    // same granularity v1 logs at.
    after(async () => {
      if (statuses.length === 0) return;
      try {
        const rows = sql.join(
          statuses.map(
            (s) => sql`(${k.id}, ${k.user_id}, ${s.domain}, ${s.status}, ${latencyMs})`
          ),
          sql`, `
        );
        await db.execute(sql`
          INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
          VALUES ${rows}
        `);
      } catch (err) {
        console.error(`${TAG} log write failed`, err);
      }
    });
  };

  // 4. Look everything up in one round trip, alongside the currency rates.
  let catalog: Map<string, CatalogRow>;
  let rates: Record<string, number>;
  try {
    [rates, catalog] = await Promise.all([getUsdRates(), fetchCatalog(parsed.unique)]);
  } catch (err) {
    console.error(TAG, err);
    // Our failure, not the caller's: every claimed lookup goes back. v1
    // charges its single unit on a 500; at up to 200 units a call that would
    // let one bad deploy drain a customer's month.
    await refund(units);
    log(parsed.unique.map((domain) => ({ domain, status: 500 })));
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  // 5. Build each domain's v1 body.
  const found = new Map<string, PricingBody>();
  try {
    for (const domain of parsed.unique) {
      const row = catalog.get(domain);
      const domainRow = row?.domain_row ?? null;
      if (!domainRow) continue;
      const offers = (row?.offers ?? []).map(toOffer);
      const metrics = {
        domain_rating: domainRow.domain_rating != null ? Number(domainRow.domain_rating) : null,
        organic_traffic: domainRow.org_traffic != null ? Number(domainRow.org_traffic) : null,
        ref_domains: domainRow.ref_domains != null ? Number(domainRow.ref_domains) : null,
        country: normalizeCountry(domainRow.country_main_traffic as string | null),
      };
      found.set(domain, buildPricingBody(domain, offers, rates, parsed.niche, metrics));
    }
  } catch (err) {
    console.error(TAG, err);
    await refund(units);
    log(parsed.unique.map((domain) => ({ domain, status: 500 })));
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  // 6. Domains the catalogue does not hold are not charged.
  const notFound = units - found.size;
  const afterRefund = await refund(notFound);
  if (afterRefund != null) monthUsed = afterRefund;

  log(parsed.unique.map((domain) => ({ domain, status: found.has(domain) ? 200 : 404 })));

  const body = buildBatchBody(parsed as ParsedBatch, found, {
    charged: found.size,
    monthly_limit: monthLimit,
    monthly_remaining: Math.max(0, monthLimit - monthUsed),
    resets_at: new Date(monthResetEpoch * 1000).toISOString(),
  });

  return jsonOk(body, {
    ...rateLimitHeaders(monthLimit, monthUsed, minuteLimit, minuteUsed, monthResetEpoch),
    "X-API-Version": "2",
    "X-Lookups-Charged": String(found.size),
  });
}
