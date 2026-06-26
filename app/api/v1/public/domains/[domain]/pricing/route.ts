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
  return val == null || val === "" || isNaN(n) ? null : Math.round(n * 100) / 100;
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

  // 3. Daily limit — resets each UTC day
  const dailyUsed = k.usage_date === today ? (k.request_count ?? 0) : 0;
  if (dailyUsed >= k.daily_limit) {
    return jsonError(
      "rate_limit_exceeded",
      "Daily request limit reached. Resets at midnight UTC.",
      429,
      { "Retry-After": "86400" }
    );
  }

  // 4. Per-minute limit — count recent requests from log
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

  let httpStatus = 200;

  try {
    // 6. Pricing — aggregate lowest price per niche across all marketplaces
    const pricingRows = await db.execute(sql`
      SELECT
        MIN(min_price::float)             AS standard_lowest,
        MIN(gambling_min_price::float)    AS gambling_lowest,
        MIN(adult_min_price::float)       AS adult_lowest,
        MIN(cbd_min_price::float)         AS cbd_lowest,
        MIN(loan_min_price::float)        AS loan_lowest,
        MIN(dating_min_price::float)      AS dating_lowest,
        MIN(crypto_min_price::float)      AS crypto_lowest,
        MIN(trading_forex_min_price::float) AS forex_lowest,
        MAX(fetched_at)                   AS last_updated
      FROM marketplace_price_cache
      WHERE domain = ${domain}
        AND available = true
        AND expires_at > NOW()
    `);

    const pr = pricingRows.rows[0] ?? null;
    const hasPricing = pr != null && pr.last_updated != null;

    // 7. Domain metrics
    const metricRows = await db.execute(sql`
      SELECT domain_rating, org_traffic, ref_domains, country_main_traffic
      FROM domains
      WHERE domain = ${domain}
      LIMIT 1
    `);

    const mr = metricRows.rows[0] ?? null;

    if (!hasPricing && !mr) {
      httpStatus = 404;
      return jsonError("domain_not_found", "No data found for this domain.", 404);
    }

    const response = {
      domain,
      found: hasPricing,
      pricing: {
        standard:      { lowest_price: toPrice(pr?.standard_lowest),  currency: "USD" },
        gambling:      { lowest_price: toPrice(pr?.gambling_lowest),   currency: "USD" },
        adult:         { lowest_price: toPrice(pr?.adult_lowest),      currency: "USD" },
        cbd:           { lowest_price: toPrice(pr?.cbd_lowest),        currency: "USD" },
        loan:          { lowest_price: toPrice(pr?.loan_lowest),       currency: "USD" },
        dating:        { lowest_price: toPrice(pr?.dating_lowest),     currency: "USD" },
        crypto:        { lowest_price: toPrice(pr?.crypto_lowest),     currency: "USD" },
        trading_forex: { lowest_price: toPrice(pr?.forex_lowest),      currency: "USD" },
      },
      metrics: {
        domain_rating:   mr?.domain_rating != null ? Number(mr.domain_rating) : null,
        organic_traffic: mr?.org_traffic != null ? Number(mr.org_traffic) : null,
        ref_domains:     mr?.ref_domains != null ? Number(mr.ref_domains) : null,
        country:         (mr?.country_main_traffic as string) ?? null,
      },
      last_updated: hasPricing
        ? new Date(pr!.last_updated as string).toISOString().slice(0, 10)
        : null,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[/api/v1/public/domains/pricing]", err);
    httpStatus = 500;
    return jsonError("internal_error", "An internal error occurred. Please retry.", 500);
  } finally {
    // 8. Log the request regardless of outcome
    const latencyMs = Date.now() - startMs;
    db.execute(sql`
      INSERT INTO api_request_logs (api_key_id, user_id, domain, http_status, latency_ms)
      VALUES (${k.id}, ${k.user_id}, ${domain}, ${httpStatus}, ${latencyMs})
    `).catch(() => {});

    // 9. Increment daily usage counter
    db.execute(sql`
      UPDATE api_keys
      SET request_count = CASE WHEN usage_date = ${today} THEN request_count + 1 ELSE 1 END,
          usage_date    = ${today},
          last_used_at  = NOW()
      WHERE id = ${k.id}
    `).catch(() => {});
  }
}
