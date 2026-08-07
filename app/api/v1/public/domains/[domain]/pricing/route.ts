import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getUsdRates, toUsd as toUsdWithRates } from "@/lib/currency";

// ─── helpers ───────────────────────────────────────────────────────────────

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function toPrice(val: unknown): number | null {
  const n = Number(val);
  return val == null || val === "" || isNaN(n) || n === 0 ? null : Math.round(n * 100) / 100;
}

function ourPrice(marketplacePrice: number): number {
  return Math.max(Math.round(marketplacePrice * 1.15), Math.floor(marketplacePrice) + 1);
}

function jsonError(code: string, message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json(
    { error: code, message, status },
    { status, headers: extra }
  );
}

// The daily limit resets at midnight UTC, not exactly 24h from whenever this
// request happened to land — a key that trips the limit at 23:59 UTC should
// get Retry-After: 60, not a flat 86400 implying a near-full day left.
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(1, Math.round((next - now.getTime()) / 1000));
}

// ─── route ─────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const startMs = Date.now();

  // 1. Require API key header
  const rawKey = req.headers.get("x-api-key");
  if (!rawKey) {
    return jsonError("missing_api_key", "Provide your API key in the x-api-key header.", 401);
  }

  const keyHash = hashKey(rawKey);

  // 2. Validate key
  const keyRows = await db.execute(sql`
    SELECT id, user_id, daily_limit, per_minute_limit, request_count, usage_date, is_active
    FROM api_keys
    WHERE key_hash = ${keyHash}
    LIMIT 1
  `);

  if (!keyRows.rows.length || !keyRows.rows[0].is_active) {
    return jsonError("invalid_api_key", "API key is invalid or inactive.", 401);
  }

  const k = keyRows.rows[0] as {
    id: string;
    user_id: string;
    daily_limit: number;
    per_minute_limit: number;
    request_count: number;
    usage_date: string | null;
    is_active: boolean;
  };

  const today = new Date().toISOString().slice(0, 10);

  // 3. Normalize domain
  const { domain: rawDomain } = await params;
  const domain = normalizeDomain(decodeURIComponent(rawDomain));

  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return jsonError("invalid_domain", "Domain parameter is missing or malformed.", 422);
  }

  // 4. Optional niche filter
  const VALID_NICHES = ["standard", "gambling", "adult", "cbd", "loan", "dating", "crypto", "trading_forex"] as const;
  type Niche = typeof VALID_NICHES[number];
  const nicheParam = req.nextUrl.searchParams.get("niche");
  if (nicheParam && !VALID_NICHES.includes(nicheParam as Niche)) {
    return jsonError(
      "invalid_niche",
      `Invalid niche. Valid values are: ${VALID_NICHES.join(", ")}`,
      422
    );
  }
  const nicheFilter = nicheParam as Niche | null;

  // 5. Daily limit — atomic check-and-increment. Previously the count was read
  // once up front and only written back in `finally`, so concurrent requests
  // could all pass the check before any of them incremented it (TOCTOU). This
  // does both in one statement, serialized by Postgres's row lock on the key.
  const dailyUpdate = await db.execute(sql`
    UPDATE api_keys
    SET request_count = CASE WHEN usage_date = ${today} THEN request_count + 1 ELSE 1 END,
        usage_date    = ${today}
    WHERE id = ${k.id}
      AND (usage_date IS DISTINCT FROM ${today} OR request_count < daily_limit)
    RETURNING request_count
  `);
  if (!dailyUpdate.rows.length) {
    return jsonError(
      "rate_limit_exceeded",
      "Daily request limit reached. Resets at midnight UTC.",
      429,
      { "Retry-After": String(secondsUntilMidnightUtc()) }
    );
  }

  // 6. Per-minute limit
  const minuteRows = await db.execute(sql`
    SELECT COUNT(*) AS cnt
    FROM api_request_logs
    WHERE api_key_id = ${k.id}
      AND created_at > NOW() - INTERVAL '1 minute'
  `);
  const minuteUsed = Number(minuteRows.rows[0]?.cnt ?? 0);
  if (minuteUsed >= k.per_minute_limit) {
    return jsonError(
      "rate_limit_exceeded",
      "Per-minute rate limit exceeded. See Retry-After header.",
      429,
      { "Retry-After": "60" }
    );
  }

  // Reserve this request's log row now, before the downstream pricing work,
  // so concurrent requests see it in their own per-minute count immediately —
  // previously the log row was only written in `finally`, after all downstream
  // work, leaving a wide window where concurrent requests undercounted.
  const logInsert = await db.execute(sql`
    INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
    VALUES (${k.id}, ${k.user_id}, ${domain}, 0, 0)
    RETURNING id
  `);
  const logId = logInsert.rows[0]?.id as string | undefined;

  let httpStatus = 200;

  try {
    const rates = await getUsdRates();
    const toUsd = (amount: number, currency: string | null | undefined): number =>
      toUsdWithRates(amount, currency, rates) as number;

    // Query domains + marketplace_offers directly — no cache layer. This used
    // to check `marketplace_price_cache` first (a 24h-TTL table fed by this
    // same endpoint), but nothing else in the codebase ever reads or writes
    // it, Analyze queries the same source tables live with no cache at all,
    // and the cache was the reason a currency bug (see below) could persist
    // for up to a day after being fixed at the source — dropping the layer
    // removes that whole failure mode rather than just patching it once.
    // One row per (domain_id, marketplace_name) — that pair is unique — so
    // no GROUP BY is needed; each marketplace's own currency is read
    // alongside its prices so every niche column can be converted to USD
    // before any cross-marketplace comparison happens (previously this
    // wasn't done at all — a raw EUR/GBP/etc. number was returned labeled
    // "USD" outright).
    const sourceRows = await db.execute(sql`
      SELECT
        o.currency,
        o.min_price::float              AS min_price,
        o.gambling_min_price::float     AS gambling_min,
        o.adult_min_price::float        AS adult_min,
        o.cbd_min_price::float          AS cbd_min,
        o.loan_min_price::float         AS loan_min,
        o.dating_min_price::float       AS dating_min,
        o.crypto_min_price::float       AS crypto_min,
        o.trading_forex_min_price::float AS trading_forex_min
      FROM domains d
      JOIN marketplace_offers o ON o.domain_id = d.id
      WHERE d.domain = ${domain}
        AND o.available = true
    `);

    let pr: Record<string, unknown> | null = null;

    if (sourceRows.rows.length > 0) {
      const agg: Record<string, number | null> = {
        standard_lowest: null,
        gambling_lowest: null,
        adult_lowest: null,
        cbd_lowest: null,
        loan_lowest: null,
        dating_lowest: null,
        crypto_lowest: null,
        forex_lowest: null,
      };
      const pick = (cur: number | null, next: number | null) =>
        next == null ? cur : cur == null || next < cur ? next : cur;

      for (const row of sourceRows.rows as any[]) {
        const currency = row.currency as string | null;
        const usd = (raw: unknown) => {
          const n = toPrice(raw);
          return n == null ? null : toUsd(n, currency);
        };
        // Base price for this offer — every niche falls back to this when
        // the offer has no price set for that specific niche, exactly like
        // Analyze's nichePrice(): a niche filter changes which number shows,
        // it never hides an offer just because it lacks niche-specific
        // pricing. Previously a niche column with no value was excluded
        // from that niche's comparison entirely instead of falling back,
        // which understated (or hid) how cheap a domain actually was for
        // that niche.
        const base = usd(row.min_price);
        agg.standard_lowest = pick(agg.standard_lowest, base);
        agg.gambling_lowest = pick(agg.gambling_lowest, usd(row.gambling_min) ?? base);
        agg.adult_lowest    = pick(agg.adult_lowest,    usd(row.adult_min) ?? base);
        agg.cbd_lowest       = pick(agg.cbd_lowest,      usd(row.cbd_min) ?? base);
        agg.loan_lowest      = pick(agg.loan_lowest,     usd(row.loan_min) ?? base);
        agg.dating_lowest    = pick(agg.dating_lowest,   usd(row.dating_min) ?? base);
        agg.crypto_lowest    = pick(agg.crypto_lowest,   usd(row.crypto_min) ?? base);
        agg.forex_lowest     = pick(agg.forex_lowest,    usd(row.trading_forex_min) ?? base);
      }

      pr = agg;
    }

    const lastUpdated = pr != null ? new Date().toISOString() : null;

    // 8. Domain metrics from new domains table
    const metricRows = await db.execute(sql`
      SELECT
        domain_rating,
        org_traffic,
        ref_domains,
        country_main_traffic AS country
      FROM domains
      WHERE domain = ${domain}
      LIMIT 1
    `);

    const mr = metricRows.rows[0] ?? null;

    if (!pr && !mr) {
      httpStatus = 404;
      return jsonError("domain_not_found", "No data found for this domain.", 404);
    }

    const allPricing: Record<string, { price: number | null }> = {
      standard:      { price: toPrice(pr?.standard_lowest) },
      gambling:      { price: toPrice(pr?.gambling_lowest) },
      adult:         { price: toPrice(pr?.adult_lowest) },
      cbd:           { price: toPrice(pr?.cbd_lowest) },
      loan:          { price: toPrice(pr?.loan_lowest) },
      dating:        { price: toPrice(pr?.dating_lowest) },
      crypto:        { price: toPrice(pr?.crypto_lowest) },
      trading_forex: { price: toPrice(pr?.forex_lowest) },
    };

    const pricing = Object.fromEntries(
      Object.entries(allPricing)
        .filter(([k, { price }]) => price !== null && (!nicheFilter || k === nicheFilter))
        .map(([k, { price }]) => [k, {
          lowest_price: price,
          our_price: ourPrice(price as number),
          currency: "USD",
        }])
    );

    return NextResponse.json({
      domain,
      found: pr != null,
      pricing,
      metrics: {
        domain_rating:   mr?.domain_rating != null ? Number(mr.domain_rating) : null,
        organic_traffic: mr?.org_traffic != null ? Number(mr.org_traffic) : null,
        ref_domains:     mr?.ref_domains != null ? Number(mr.ref_domains) : null,
        country:         (mr?.country as string) ?? null,
      },
      last_updated: lastUpdated
        ? new Date(lastUpdated).toISOString().slice(0, 10)
        : null,
    });

  } catch (err) {
    console.error("[/api/v1/public/domains/pricing]", err);
    httpStatus = 500;
    return jsonError("internal_error", "An internal error occurred. Please retry.", 500);
  } finally {
    const latencyMs = Date.now() - startMs;
    // Must be awaited — in a serverless function the execution context can be
    // frozen right after the response is returned, silently dropping any
    // fire-and-forget writes. request_count/usage_date are already updated
    // atomically above (step 5); this just fills in the reserved log row's
    // final status/latency and bumps last_used_at.
    const writes = [
      db.execute(sql`
        UPDATE api_keys SET last_used_at = NOW() WHERE id = ${k.id}
      `).catch(() => {}),
    ];
    if (logId) {
      writes.push(
        db.execute(sql`
          UPDATE api_request_logs SET http_status = ${httpStatus}, latency_ms = ${latencyMs} WHERE id = ${logId}
        `).catch(() => {})
      );
    }
    await Promise.all(writes);
  }
}
