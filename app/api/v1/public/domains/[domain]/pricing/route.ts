import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

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

// lp_domain_price stores prices in their source currency (p.currency), not USD.
// Convert before returning/caching so the "currency": "USD" field in the response is true.
const CURRENCY_TO_USD: Record<string, number> = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };
function toUsd(amount: number, currency: string | null | undefined): number {
  const rate = CURRENCY_TO_USD[(currency ?? "USD").trim().toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

function jsonError(code: string, message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json(
    { error: code, message, status },
    { status, headers: extra }
  );
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

  // 3. Daily limit
  const dailyUsed = k.usage_date === today ? (k.request_count ?? 0) : 0;
  if (dailyUsed >= k.daily_limit) {
    return jsonError(
      "rate_limit_exceeded",
      "Daily request limit reached. Resets at midnight UTC.",
      429,
      { "Retry-After": "86400" }
    );
  }

  // 4. Per-minute limit
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

  // 5. Normalize domain
  const { domain: rawDomain } = await params;
  const domain = normalizeDomain(decodeURIComponent(rawDomain));

  if (!domain || domain.length < 3 || !domain.includes(".")) {
    return jsonError("invalid_domain", "Domain parameter is missing or malformed.", 422);
  }

  // 6. Optional niche filter
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

  let httpStatus = 200;

  try {
    // 6. Check cache first
    const cacheRows = await db.execute(sql`
      SELECT
        MIN(min_price::float)               AS standard_lowest,
        MIN(gambling_min_price::float)      AS gambling_lowest,
        MIN(adult_min_price::float)         AS adult_lowest,
        MIN(cbd_min_price::float)           AS cbd_lowest,
        MIN(loan_min_price::float)          AS loan_lowest,
        MIN(dating_min_price::float)        AS dating_lowest,
        MIN(crypto_min_price::float)        AS crypto_lowest,
        MIN(trading_forex_min_price::float) AS forex_lowest,
        MAX(fetched_at)                     AS last_updated
      FROM marketplace_price_cache
      WHERE domain = ${domain}
        AND available = true
        AND expires_at > NOW()
    `);

    const cached = cacheRows.rows[0] ?? null;
    const cacheHit = cached?.last_updated != null;

    // 7. If no cache, fetch from source tables
    let pr: Record<string, unknown> | null = null;
    let lastUpdated: string | null = null;

    if (cacheHit) {
      pr = cached;
      lastUpdated = cached.last_updated as string;
    } else {
      // Query domains + marketplace_offers (new scraper tables)
      const sourceRows = await db.execute(sql`
        SELECT
          o.marketplace_name,
          MIN(o.min_price::float)              AS min_price,
          MIN(o.gambling_min_price::float)     AS gambling_min,
          MIN(o.adult_min_price::float)        AS adult_min,
          MIN(o.cbd_min_price::float)          AS cbd_min,
          MIN(o.loan_min_price::float)         AS loan_min,
          MIN(o.dating_min_price::float)       AS dating_min,
          MIN(o.crypto_min_price::float)       AS crypto_min,
          MIN(o.trading_forex_min_price::float) AS trading_forex_min
        FROM domains d
        JOIN marketplace_offers o ON o.domain_id = d.id
        WHERE d.domain = ${domain}
          AND o.available = true
        GROUP BY o.marketplace_name
      `);

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

        for (const row of sourceRows.rows as any[]) {
          const pick = (cur: number | null, next: unknown) => {
            const n = toPrice(next);
            return n == null ? cur : cur == null ? n : Math.min(cur, n);
          };
          agg.standard_lowest  = pick(agg.standard_lowest,  row.min_price);
          agg.gambling_lowest  = pick(agg.gambling_lowest,  row.gambling_min);
          agg.adult_lowest     = pick(agg.adult_lowest,     row.adult_min);
          agg.cbd_lowest       = pick(agg.cbd_lowest,       row.cbd_min);
          agg.loan_lowest      = pick(agg.loan_lowest,      row.loan_min);
          agg.dating_lowest    = pick(agg.dating_lowest,    row.dating_min);
          agg.crypto_lowest    = pick(agg.crypto_lowest,    row.crypto_min);
          agg.forex_lowest     = pick(agg.forex_lowest,     row.trading_forex_min);
        }

        pr = agg;
        lastUpdated = new Date().toISOString();

        // Write to cache asynchronously (one row per marketplace, 24h TTL)
        for (const row of sourceRows.rows as any[]) {
          db.execute(sql`
            INSERT INTO marketplace_price_cache (
              domain, marketplace_name, min_price, currency,
              gambling_min_price, adult_min_price, cbd_min_price,
              loan_min_price, dating_min_price, crypto_min_price,
              trading_forex_min_price, available, fetched_at, expires_at
            ) VALUES (
              ${domain}, ${row.marketplace_name}, ${row.min_price}, 'USD',
              ${row.gambling_min}, ${row.adult_min}, ${row.cbd_min},
              ${row.loan_min}, ${row.dating_min}, ${row.crypto_min},
              ${row.trading_forex_min}, true, NOW(), NOW() + INTERVAL '24 hours'
            )
            ON CONFLICT (domain, marketplace_name) DO UPDATE SET
              min_price               = EXCLUDED.min_price,
              currency                = EXCLUDED.currency,
              gambling_min_price      = EXCLUDED.gambling_min_price,
              adult_min_price         = EXCLUDED.adult_min_price,
              cbd_min_price           = EXCLUDED.cbd_min_price,
              loan_min_price          = EXCLUDED.loan_min_price,
              dating_min_price        = EXCLUDED.dating_min_price,
              crypto_min_price        = EXCLUDED.crypto_min_price,
              trading_forex_min_price = EXCLUDED.trading_forex_min_price,
              available               = true,
              fetched_at              = NOW(),
              expires_at              = NOW() + INTERVAL '24 hours'
          `).catch(() => {});
        }
      }
    }

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

    const allPricing = {
      standard:      toPrice(pr?.standard_lowest),
      gambling:      toPrice(pr?.gambling_lowest),
      adult:         toPrice(pr?.adult_lowest),
      cbd:           toPrice(pr?.cbd_lowest),
      loan:          toPrice(pr?.loan_lowest),
      dating:        toPrice(pr?.dating_lowest),
      crypto:        toPrice(pr?.crypto_lowest),
      trading_forex: toPrice(pr?.forex_lowest),
    };

    const pricing = Object.fromEntries(
      Object.entries(allPricing)
        .filter(([k, v]) => v !== null && (!nicheFilter || k === nicheFilter))
        .map(([k, v]) => [k, { lowest_price: v, currency: "USD" }])
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
    db.execute(sql`
      INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
      VALUES (${k.id}, ${k.user_id}, ${domain}, ${httpStatus}, ${latencyMs})
    `).catch(() => {});

    db.execute(sql`
      UPDATE api_keys
      SET request_count = CASE WHEN usage_date = ${today} THEN request_count + 1 ELSE 1 END,
          usage_date    = ${today},
          last_used_at  = NOW()
      WHERE id = ${k.id}
    `).catch(() => {});
  }
}
