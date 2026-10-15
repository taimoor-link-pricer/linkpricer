/**
 * The public search endpoint (v1): POST /api/v1/public/domains/search.
 *
 * Takes filters instead of domains and answers with up to 50 matching domains,
 * each carrying the pricing endpoint's own per-domain body. It runs in two
 * steps on purpose:
 *
 *   1. one query picks the matching hosts, in the requested order;
 *   2. the pricing endpoint's catalogue query (fetchCatalog) prices them.
 *
 * So a search result is not "like" a pricing result — it IS one, built by the
 * same query and the same function, and a domain found here prices to the same
 * figures when it is sent to the pricing endpoint a moment later.
 *
 * Quota is the same monthly pool, at the same rate: one lookup per domain
 * returned. The call claims `limit` lookups up front (it cannot know how many
 * sites will match before it looks) and hands back every one it did not use,
 * so a search that returns 12 domains costs 12 and one that returns none
 * costs nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getUsdRates } from "@/lib/currency";
import { minFeeCents } from "@/lib/pricing/fee";
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
import { normalizeBatchDomain } from "@/lib/public-api/batch";
import { fetchCatalog, pricingBodyFor } from "@/lib/public-api/batch-handler";
import {
  domainForms,
  hashKey,
  isValidHostname,
  jsonError,
  jsonOk,
  rateLimitHeaders,
} from "@/lib/public-api/common";
import { NICHES } from "@/lib/public-api/pricing";
import {
  buildSearchBody,
  matchesSearch,
  MAX_SEARCH_BODY_BYTES,
  parseSearchRequest,
  priceNiche,
  sortResults,
  sourcePriceBounds,
  type ParsedSearch,
  type SearchResult,
} from "@/lib/public-api/search";
import { notPlatformHost, sourceAllowed } from "@/lib/public-api/source-quality";
import { candidateFilterClauses } from "@/lib/search/catalog-search";

const TAG = "[/api/v1/public/domains/search]";

/** What a search that returned nothing, or failed, is logged under. */
const LOG_PLACEHOLDER = "(search)";

/**
 * How many hosts the candidate query returns for a search of `limit`. More
 * than `limit`, because a candidate can still be dropped afterwards: two rows
 * can be one host, and the published body is what decides a match
 * (matchesSearch). The surplus is also how `has_more` is known without a
 * second, counting query over the whole catalogue.
 */
function candidateLimit(limit: number): number {
  return limit * 2 + 20;
}

// The filters on a metric match only sites where that metric is known, and 0
// is how the catalogue stores an unknown one — so every range starts at "> 0".
function metricRange(column: SQL, min: number | undefined, max: number | undefined, cast: SQL): SQL {
  if (min == null && max == null) return sql``;
  return sql.join(
    [
      sql`AND ${column} > 0`,
      min != null ? sql`AND ${column} >= ${min}::${cast}` : sql``,
      max != null ? sql`AND ${column} <= ${max}::${cast}` : sql``,
    ],
    sql` `
  );
}

/**
 * The hosts that match, best first.
 *
 * One query shape for every search: `domains` filtered on its own columns,
 * joined to the available offers that price the niche, grouped to one row per
 * domain so the cheapest price can be filtered and sorted on. Postgres picks
 * the join order from the filters — a selective one (a country, a TLD) is
 * walked domain by domain; a loose one aggregates the offers once. Measured
 * against the live catalogue that is 1–4 seconds either way, where pricing
 * each domain separately took up to 40 seconds on a price-sorted search.
 *
 * The price here is the cheapest available source price in USD, which is what
 * `marketplace.lowest` publishes for the standard niche. For the others it is
 * a close stand-in (the published figure keeps one offer per marketplace
 * first), which is why the caller re-checks each body with matchesSearch.
 *
 * Vendor offers (supplier_offers) are priced in step 2 but are not searched
 * here: a domain listed only by a vendor is reachable through the pricing
 * endpoint, not through search.
 */
export function candidateQuery(
  parsed: ParsedSearch,
  rates: Record<string, number>,
  bounds: { min: number | null; max: number | null },
  limit: number
): SQL {
  const f = parsed.filters;
  const cols = NICHES[priceNiche(parsed.niche)].columns;
  // A column name from the NICHES constant, never from the request.
  const priceCol = sql.raw(`o.${cols ? cols.min : "min_price"}`);

  // Same conversion toUsd() applies to an offer (lib/currency.ts): the offer's
  // own currency, trimmed and upper-cased, and 1 for one we hold no rate for.
  // Explicit ::float on every branch — the Neon HTTP driver otherwise infers
  // the CASE as integer and rejects the bound rates.
  const whens = Object.entries(rates)
    .filter(([cur, rate]) => cur !== "USD" && Number.isFinite(rate))
    .map(([cur, rate]) => sql`WHEN ${cur} THEN ${rate}::float`);
  const rate = whens.length
    ? sql`(CASE upper(btrim(o.currency)) ${sql.join(whens, sql` `)} ELSE 1::float END)`
    : sql`1::float`;
  const usd = sql`MIN(${priceCol}::float * ${rate})`;

  // Country, language, TLD and category are the Related Sites page's own
  // clauses, so the two surfaces cannot disagree on what "US" or "German"
  // means against the catalogue's free-text columns.
  const { countryClause, languageClause, tldClause, categoryClause } = candidateFilterClauses({
    countries: f.country,
    language: f.language,
    tlds: f.tld,
    categories: f.category,
  });

  // A cent of slack either side: this compares an unrounded float, while the
  // published price was rounded to the cent before the fee. matchesSearch
  // applies the exact rule afterwards.
  const having = [
    bounds.min != null ? sql`${usd} >= ${bounds.min - 0.01}::float` : null,
    bounds.max != null ? sql`${usd} <= ${bounds.max + 0.01}::float` : null,
  ].filter((c): c is SQL => c != null);

  const sortExpr = {
    dr: sql`NULLIF(d.domain_rating, 0)`,
    traffic: sql`NULLIF(d.org_traffic, 0)`,
    ref_domains: sql`NULLIF(d.ref_domains, 0)`,
    price: usd,
  }[parsed.sort.by];
  const direction = parsed.sort.order === "asc" ? sql`ASC` : sql`DESC`;

  return sql`
    SELECT lower(d.domain) AS host
    FROM domains d
    JOIN marketplace_offers o
      ON o.domain_id = d.id AND o.available = true AND ${priceCol} > 0
        AND ${sourceAllowed(sql`o.marketplace_name`)}
    WHERE ${notPlatformHost(sql`d.domain`)}
      ${metricRange(sql`d.domain_rating`, f.min_dr, f.max_dr, sql`int`)}
      ${metricRange(sql`d.org_traffic`, f.min_traffic, f.max_traffic, sql`bigint`)}
      ${metricRange(sql`d.ref_domains`, f.min_ref_domains, f.max_ref_domains, sql`bigint`)}
      ${countryClause}
      ${languageClause}
      ${tldClause}
      ${categoryClause}
    GROUP BY d.id
    ${having.length ? sql`HAVING ${sql.join(having, sql` AND `)}` : sql``}
    ORDER BY ${sortExpr} ${direction} NULLS LAST, lower(d.domain) ASC
    LIMIT ${limit}::int
  `;
}

/**
 * The candidate hosts as the pricing endpoint would accept them, one per
 * site. `domains` holds some hosts twice (by case, and as unicode and
 * punycode), which the catalogue query pools into one answer — so the second
 * spelling of a host is dropped here rather than priced and returned twice.
 * Rows that are not a bare host cannot be looked up at all and are skipped.
 */
export function distinctHosts(hosts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const host of hosts) {
    if (!isValidHostname(host) || normalizeBatchDomain(host) !== host) continue;
    const forms = domainForms(host);
    if (forms.some((form) => seen.has(form))) continue;
    for (const form of forms) seen.add(form);
    out.push(host);
  }
  return out;
}

async function fetchCandidates(
  parsed: ParsedSearch,
  rates: Record<string, number>,
  limit: number
): Promise<{ hosts: string[]; exhausted: boolean }> {
  const bounds = sourcePriceBounds(parsed.filters, minFeeCents(rates));
  // A max_price below the minimum fee: no source price can satisfy it.
  if (bounds.none) return { hosts: [], exhausted: true };
  const result = await db.execute(candidateQuery(parsed, rates, bounds, limit));
  const rows = result.rows as unknown as { host: string }[];
  return { hosts: distinctHosts(rows.map((r) => r.host)), exhausted: rows.length < limit };
}

/**
 * Runs the search: up to `parsed.limit` results, in order, and whether more
 * matched. Read-only, and free of the key and the quota, so
 * scripts/verify-public-api-search.mts can run it against the live catalogue.
 */
export async function runSearch(
  parsed: ParsedSearch,
  rates: Record<string, number>
): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const { hosts, exhausted } = await fetchCandidates(parsed, rates, candidateLimit(parsed.limit));

  const matched: SearchResult[] = [];
  const price = async (batch: string[]) => {
    const catalog = await fetchCatalog(batch);
    for (const domain of batch) {
      const data = pricingBodyFor(domain, catalog.get(domain), rates, parsed.niche);
      if (data && matchesSearch(data, parsed.filters, parsed.niche)) matched.push({ domain, data });
    }
  };

  // Price the first `limit` and a few spare, and only reach for the rest of
  // the candidates if the body check dropped enough to leave the page short.
  // Nearly every search is the one round trip.
  const first = hosts.slice(0, parsed.limit + 5);
  const rest = hosts.slice(first.length);
  if (first.length) await price(first);
  let unpriced = rest.length > 0;
  if (unpriced && matched.length < parsed.limit) {
    await price(rest);
    unpriced = false;
  }

  const ordered = sortResults(matched, parsed.sort, parsed.niche);
  return {
    results: ordered.slice(0, parsed.limit),
    // More matched than fit the page, candidates were left unpriced because
    // the page was already full, or the candidate query stopped at its limit.
    hasMore: ordered.length > parsed.limit || unpriced || !exhausted,
  };
}

/**
 * `resolvedKeyHash` is for callers that have already worked out which key to
 * charge without holding its plaintext — the MCP server, for an app signed in
 * through OAuth (lib/mcp/auth.ts). Everything after the key is identical.
 */
export async function handleSearchRequest(req: NextRequest, resolvedKeyHash?: string): Promise<NextResponse> {
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

  // 2. Read and validate the body BEFORE claiming quota — a request we reject
  //    without searching must cost nothing. A rejected request still checks
  //    the key (read-only), so a bad key is reported as 401, not 4xx-body.
  const read = await readJsonBody(req, MAX_SEARCH_BODY_BYTES, '{ "filters": { "min_dr": 40 } }');
  if (!read.ok) return rejectRequest(keyHash, read.error, TAG);
  const parsed = parseSearchRequest(read.json);
  if (!parsed.ok) return rejectRequest(keyHash, parsed, TAG);

  // 3. Authenticate and claim the most this search can return (access.ts).
  const units = parsed.limit;
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
        `This search can return up to ${units} domains but only ${remaining} of your ${monthLimit} monthly lookups remain. Set "limit" to ${remaining} or lower, or wait for the reset on the 1st at 00:00 UTC.`
    );
  }

  let monthUsed = Number(k.month_used);
  const minuteUsed = k.minute_used == null ? null : Number(k.minute_used);
  const key = k;

  // 4. Search.
  let results: SearchResult[];
  let hasMore: boolean;
  try {
    ({ results, hasMore } = await runSearch(parsed, await getUsdRates()));
  } catch (err) {
    console.error(TAG, err);
    // Our failure, not the caller's: every claimed lookup goes back.
    await refundLookups(key.id, w.month, units, TAG);
    logLookups(key, [{ domain: LOG_PLACEHOLDER, status: 500 }], Date.now() - startMs, TAG);
    return jsonError("internal_error", "An internal error occurred. No lookups were charged. Please retry.", 500);
  }

  // 5. Only the domains returned are charged.
  const afterRefund = await refundLookups(key.id, w.month, units - results.length, TAG);
  if (afterRefund != null) monthUsed = afterRefund;

  // One row per domain returned, as the pricing endpoint logs; a search that
  // found nothing still leaves a row, so the call is visible in the history.
  logLookups(
    key,
    results.length
      ? results.map((r) => ({ domain: r.domain, status: 200 }))
      : [{ domain: LOG_PLACEHOLDER, status: 200 }],
    Date.now() - startMs,
    TAG
  );

  const body = buildSearchBody(parsed, results, hasMore, {
    charged: results.length,
    monthly_limit: monthLimit,
    monthly_remaining: Math.max(0, monthLimit - monthUsed),
    resets_at: new Date(w.monthResetEpoch * 1000).toISOString(),
  });

  return jsonOk(body, {
    ...rateLimitHeaders(monthLimit, monthUsed, minuteLimit, minuteUsed, w.monthResetEpoch),
    "X-API-Version": "1",
    "X-Lookups-Charged": String(results.length),
  });
}
