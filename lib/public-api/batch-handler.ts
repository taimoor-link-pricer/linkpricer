/**
 * The public pricing endpoint (v1): POST /api/v1/public/domains/pricing.
 *
 * Up to 200 domains per call, each answered with the per-domain body built by
 * buildPricingBody(). This started life as a separate v2 batch endpoint next
 * to a single-domain GET; with no integrator on either, the batch endpoint
 * became v1 and the GET was retired (a single domain is a batch of one).
 *
 * Quota is metered per domain, not per call: a batch of N distinct valid
 * domains claims N lookups from the monthly quota up front — atomically, in
 * the statement that authenticates the key — and hands back one for
 * every domain the catalogue does not contain. Counting a 200-domain batch as
 * one request would make a 10,000/month plan worth 2,000,000 lookups. The
 * per-minute limit counts calls, since it exists to protect the database from
 * bursts, and one batch is one round of queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getUsdRates } from "@/lib/currency";
import {
  domainForms,
  hashKey,
  jsonError,
  jsonOk,
  normalizeCountry,
  rateLimitHeaders,
  toOffer,
} from "@/lib/public-api/common";
import {
  claimDenial,
  claimLookups,
  claimWindow,
  logLookups,
  readJsonBody,
  refundLookups,
  refusalFor,
  rejectRequest,
} from "@/lib/public-api/access";
import {
  buildBatchBody,
  MAX_BODY_BYTES,
  parseBatchRequest,
  type ParsedBatch,
} from "@/lib/public-api/batch";
import type { NicheId } from "@/lib/public-api/pricing";
import { buildPricingBody, type PricingBody } from "@/lib/public-api/shape";
import { sourceAllowed } from "@/lib/public-api/source-quality";

const TAG = "[/api/v1/public/domains/pricing]";

export interface CatalogRow {
  req_domain: string;
  domain_row: Record<string, unknown> | null;
  offers: Record<string, unknown>[] | null;
}

/**
 * Offers, metrics and freshness for every requested domain in ONE round trip.
 *
 * This is the single-domain catalogue query (lib/public-api/handler.ts) made set-based,
 * with every rule it carries preserved per requested domain:
 *   - every spelling of a host is matched (case variants and unicode/punycode
 *     forms are separate `domains` rows) and their offers pooled;
 *   - metrics come from the most-populated of those rows, chosen
 *     deterministically;
 *   - one offer per marketplace, cheapest quote winning, with app./panel.
 *     twins of the same marketplace collapsed to one source;
 *   - active vendor (supplier_offers) rows included, never trusted.
 * scripts/verify-public-api-batch.mts checks the result matches it domain by
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
          -- Not placements: monthly rentals and the like (source-quality.ts).
          AND ${sourceAllowed(sql`o.marketplace_name`)}
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
      -- Joined on the requested forms, not on d, for the reason handler.ts gives:
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

/**
 * One catalogue row as the published pricing body, or null when the catalogue
 * does not hold the domain. Shared with the search endpoint, whose results
 * are these same bodies.
 */
export function pricingBodyFor(
  domain: string,
  row: CatalogRow | undefined,
  rates: Record<string, number>,
  niche: NicheId | null
): PricingBody | null {
  const domainRow = row?.domain_row ?? null;
  if (!domainRow) return null;
  const offers = (row?.offers ?? []).map(toOffer);
  const metrics = {
    domain_rating: domainRow.domain_rating != null ? Number(domainRow.domain_rating) : null,
    organic_traffic: domainRow.org_traffic != null ? Number(domainRow.org_traffic) : null,
    ref_domains: domainRow.ref_domains != null ? Number(domainRow.ref_domains) : null,
    country: normalizeCountry(domainRow.country_main_traffic as string | null),
  };
  return buildPricingBody(domain, offers, rates, niche, metrics);
}

/**
 * `resolvedKeyHash` is for callers that have already worked out which key to
 * charge without holding its plaintext — the MCP server, for an app signed in
 * through OAuth (lib/mcp/auth.ts). Everything after the key is identical.
 */
export async function handleBatchPricingRequest(req: NextRequest, resolvedKeyHash?: string): Promise<NextResponse> {
  const startMs = Date.now();

  // 1. Key present.
  let keyHash = resolvedKeyHash;
  if (!keyHash) {
    const rawKey = req.headers.get("x-api-key");
    if (!rawKey) {
      return jsonError("missing_api_key", "Provide your API key in the x-api-key header.", 401);
    }
    keyHash = hashKey(rawKey);
  }

  // 2. Read and validate the body BEFORE claiming quota — the claim needs to
  //    know how many lookups this call is, and a request we reject without
  //    looking anything up must cost nothing. A rejected request still checks
  //    the key (read-only), so a bad key is reported as 401, not 4xx-body.
  const read = await readJsonBody(req, MAX_BODY_BYTES, '{ "domains": [...] }');
  if (!read.ok) return rejectRequest(keyHash, read.error, TAG);
  const parsed = parseBatchRequest(read.json);
  if (!parsed.ok) return rejectRequest(keyHash, parsed, TAG);

  const units = parsed.unique.length;

  // 3. Authenticate and claim `units` lookups in one statement (access.ts).
  const w = claimWindow();
  let k;
  try {
    k = await claimLookups(keyHash, units, w);
  } catch (err) {
    console.error(`${TAG} auth/claim failed`, err);
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  const refusal = refusalFor(k);
  if (refusal || !k) return refusal ?? jsonError("invalid_api_key", "API key is invalid or inactive.", 401);

  const monthLimit = Number(k.month_limit);
  const minuteLimit = Number(k.per_minute_limit);

  if (!k.allowed) {
    return claimDenial(
      k,
      w,
      (remaining) =>
        `This batch needs ${units} lookups but only ${remaining} of your ${monthLimit} monthly lookups remain. Send ${remaining} or fewer distinct domains, or wait for the reset on the 1st at 00:00 UTC.`
    );
  }

  let monthUsed = Number(k.month_used);
  const minuteUsed = k.minute_used == null ? null : Number(k.minute_used);
  const key = k;

  const refund = (n: number) => refundLookups(key.id, w.month, n, TAG);
  // One row per domain looked up, the same granularity the old single-domain
  // endpoint logged at.
  const log = (statuses: { domain: string; status: number }[]) =>
    logLookups(key, statuses, Date.now() - startMs, TAG);

  // 4. Look everything up in one round trip, alongside the currency rates.
  let catalog: Map<string, CatalogRow>;
  let rates: Record<string, number>;
  try {
    [rates, catalog] = await Promise.all([getUsdRates(), fetchCatalog(parsed.unique)]);
  } catch (err) {
    console.error(TAG, err);
    // Our failure, not the caller's: every claimed lookup goes back. The old
    // single-domain GET charged its unit on a 500; at up to 200 units that would
    // let one bad deploy drain a customer's month.
    await refund(units);
    log(parsed.unique.map((domain) => ({ domain, status: 500 })));
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  // 5. Build each domain's pricing body. A domain we list whose listings all
  //    lack a usable price (empty or zero on every niche) has nothing to sell:
  //    it is answered like a missing domain, with its own error code.
  const found = new Map<string, PricingBody>();
  const unpriced = new Set<string>();
  try {
    for (const domain of parsed.unique) {
      const body = pricingBodyFor(domain, catalog.get(domain), rates, parsed.niche);
      if (!body) continue;
      if (body.available_niches.length === 0) unpriced.add(domain);
      else found.set(domain, body);
    }
  } catch (err) {
    console.error(TAG, err);
    await refund(units);
    log(parsed.unique.map((domain) => ({ domain, status: 500 })));
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  // 6. Only an answer that carries a price is charged. A domain that is priced,
  //    but not for the niche filtered to, still comes back (with
  //    available_niches saying what it IS priced for) at no cost.
  const charged = [...found.values()].filter((b) => b.found).length;
  const afterRefund = await refund(units - charged);
  if (afterRefund != null) monthUsed = afterRefund;

  log(parsed.unique.map((domain) => ({ domain, status: found.has(domain) ? 200 : 404 })));

  const body = buildBatchBody(
    parsed as ParsedBatch,
    found,
    {
      charged,
      monthly_limit: monthLimit,
      monthly_remaining: Math.max(0, monthLimit - monthUsed),
      resets_at: new Date(w.monthResetEpoch * 1000).toISOString(),
    },
    unpriced
  );

  return jsonOk(body, {
    ...rateLimitHeaders(monthLimit, monthUsed, minuteLimit, minuteUsed, w.monthResetEpoch),
    "X-API-Version": "1",
    "X-Lookups-Charged": String(charged),
  });
}
