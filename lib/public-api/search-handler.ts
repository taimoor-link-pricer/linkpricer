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
  lookupFailure,
  readJsonBody,
  refundLookups,
  refusalFor,
  rejectRequest,
  withinDeadline,
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
  freshSince,
  matchesSearch,
  MAX_SEARCH_BODY_BYTES,
  parseSearchRequest,
  priceNiche,
  sortResults,
  sourcePriceBounds,
  type ParsedSearch,
  type SearchResult,
} from "@/lib/public-api/search";
import { METRIC_FLOOR } from "@/lib/public-api/shape";
import { notPlatformHost, sourceAllowed } from "@/lib/public-api/source-quality";
import { candidateFilterClauses } from "@/lib/search/catalog-search";
import { countryValueMatches } from "@/lib/search/country-normalize";

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

// The filters on a metric match only sites where that metric is known, so
// every range starts at the metric's floor (METRIC_FLOOR: 0 is how the
// catalogue stores an unknown metric). The floor is a constant from code,
// never from the request.
function metricRange(
  column: SQL,
  floor: number,
  min: number | undefined,
  max: number | undefined,
  cast: SQL
): SQL {
  if (min == null && max == null) return sql``;
  return sql.join(
    [
      sql`AND ${column} >= ${sql.raw(String(floor))}`,
      min != null ? sql`AND ${column} >= ${min}::${cast}` : sql``,
      max != null ? sql`AND ${column} <= ${max}::${cast}` : sql``,
    ],
    sql` `
  );
}

/**
 * The category filter, matched against what a site is about: the topic our
 * own description of it gives (`semantic_category`, written from the site's
 * homepage — "Finance / Financial News & Media"), and the sources' category
 * text only for a site not described yet.
 *
 * The sources' text says what a site ACCEPTS, often as a long list, and on
 * its own it filled a health search with marketwatch.com (listed under
 * "Health") and iheart.com (twenty topics), and a casino search with
 * newspapers that take gambling posts. Each value is a validated lower-case
 * word or phrase with no LIKE wildcards in it (search.ts).
 */
function categoryClause(categories: string[] | undefined): SQL {
  if (!categories?.length) return sql``;
  const matchesAny = (column: SQL) =>
    sql`(${sql.join(categories.map((c) => sql`lower(${column}) LIKE ${"%" + c + "%"}`), sql` OR `)})`;
  return sql`AND (CASE WHEN d.semantic_category IS NOT NULL
    THEN ${matchesAny(sql`d.semantic_category`)}
    ELSE ${matchesAny(sql`d.category`)} END)`;
}

const SPELLINGS_TTL_MS = 60 * 60 * 1000;
let spellingsCache: { at: number; values: Promise<string[]> } | null = null;

/**
 * Every distinct stored value of `domains.country_main_traffic` — about 500
 * spellings — kept for an hour per instance. Read by a loose index scan, one
 * index probe per value (~0.3 s), not a DISTINCT over 670,000 rows (~1.6 s).
 */
function storedCountrySpellings(): Promise<string[]> {
  const now = Date.now();
  if (spellingsCache && now - spellingsCache.at < SPELLINGS_TTL_MS) return spellingsCache.values;
  const values = db
    .execute(sql`
      WITH RECURSIVE t(c) AS (
        SELECT min(country_main_traffic) FROM domains
        UNION ALL
        SELECT (SELECT min(country_main_traffic) FROM domains WHERE country_main_traffic > t.c)
        FROM t WHERE t.c IS NOT NULL
      )
      SELECT c FROM t WHERE c IS NOT NULL
    `)
    .then((r) => (r.rows as { c: string }[]).map((row) => row.c));
  const entry = { at: now, values };
  spellingsCache = entry;
  // A failed read is not kept: the next search tries again.
  values.catch(() => {
    if (spellingsCache === entry) spellingsCache = null;
  });
  return values;
}

/**
 * The country filter as an exact match on the stored spellings of the
 * countries asked for, picked by countryValueMatches — the rule the Related
 * Sites page applies in SQL, so both find the same sites. Exact values let
 * Postgres use the column's index; the normalising regex read the whole table
 * on every country search (13 s for the UK on a cold cache).
 */
export async function countryClause(codes: string[] | undefined): Promise<SQL> {
  if (!codes?.length) return sql``;
  const values = (await storedCountrySpellings()).filter((v) => codes.some((c) => countryValueMatches(v, c)));
  if (!values.length) return sql`AND false`;
  return sql`AND d.country_main_traffic IN (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;
}

/** What every candidate query shares: the conditions on a site, and on an offer that prices it. */
export interface CandidateConditions {
  /** Conditions on `domains d`. */
  site: SQL;
  /** Conditions on `marketplace_offers o`: a fresh, usable price for the niche. */
  offer: SQL;
  /** That price's column, `o.<niche>_min_price`. */
  priceCol: SQL;
}

export function candidateConditions(parsed: ParsedSearch, since: string, country: SQL): CandidateConditions {
  const f = parsed.filters;
  const cols = NICHES[priceNiche(parsed.niche)].columns;
  // A column name from the NICHES constant, never from the request.
  const priceCol = sql.raw(`o.${cols ? cols.min : "min_price"}`);

  // Language and TLD are the Related Sites page's own clauses, so the two
  // surfaces cannot disagree on what "German" means against the catalogue's
  // free-text columns. Country (countryClause) is the same rule, made
  // index-friendly; category (categoryClause) is deliberately not.
  const { languageClause, tldClause } = candidateFilterClauses({ language: f.language, tlds: f.tld });

  return {
    priceCol,
    offer: sql`o.available = true AND ${priceCol} > 0
        AND ${sourceAllowed(sql`o.marketplace_name`)}
        -- Confirmed recently (MAX_PRICE_AGE_DAYS), by the same timestamp the
        -- published last_updated is read from.
        AND GREATEST(o.updated_at::timestamp, o.last_fetched_at) >= ${since}::date`,
    site: sql`${notPlatformHost(sql`d.domain`)}
      ${metricRange(sql`d.domain_rating`, METRIC_FLOOR.domain_rating, f.min_dr, f.max_dr, sql`int`)}
      ${metricRange(sql`d.org_traffic`, METRIC_FLOOR.organic_traffic, f.min_traffic, f.max_traffic, sql`bigint`)}
      ${metricRange(sql`d.ref_domains`, METRIC_FLOOR.ref_domains, f.min_ref_domains, f.max_ref_domains, sql`bigint`)}
      ${country}
      ${languageClause}
      ${tldClause}
      ${categoryClause(f.category)}`,
  };
}

/**
 * One offer's price for the niche in USD — the conversion toUsd() applies
 * (lib/currency.ts): the offer's own currency, trimmed and upper-cased, and 1
 * for one we hold no rate for. Explicit ::float on every branch — the Neon
 * HTTP driver otherwise infers the CASE as integer and rejects the bound rates.
 */
function offerUsd(conditions: CandidateConditions, rates: Record<string, number>): SQL {
  const whens = Object.entries(rates)
    .filter(([cur, rate]) => cur !== "USD" && Number.isFinite(rate))
    .map(([cur, rate]) => sql`WHEN ${cur} THEN ${rate}::float`);
  const rate = whens.length
    ? sql`(CASE upper(btrim(o.currency)) ${sql.join(whens, sql` `)} ELSE 1::float END)`
    : sql`1::float`;
  return sql`${conditions.priceCol}::float * ${rate}`;
}

/** The metric sorts, each on the column the response publishes the metric from. */
const METRIC_SORTS = {
  dr: { column: sql`d.domain_rating`, floor: METRIC_FLOOR.domain_rating, ranged: ["min_dr", "max_dr"] },
  traffic: { column: sql`d.org_traffic`, floor: METRIC_FLOOR.organic_traffic, ranged: ["min_traffic", "max_traffic"] },
  ref_domains: {
    column: sql`d.ref_domains`,
    floor: METRIC_FLOOR.ref_domains,
    ranged: ["min_ref_domains", "max_ref_domains"],
  },
} as const;

/**
 * A search sorted by a metric: the sites in the order of that metric, read
 * straight off the domains table.
 *
 * Each site is checked for a usable offer as it is reached, and the walk stops
 * at `limit` — on the DR and traffic indexes, after a few hundred sites. The
 * joined-and-grouped query (candidateQuery) read the whole catalogue and all
 * its offers for every search, 1.5–13 s; this measured 30–500 ms on the same
 * searches. It returns exactly what that query would, in the same order, in
 * two parts: `known`, the sites whose metric is known, best first; then, only
 * when those do not fill the page, `unknown`, the rest by name — the order
 * NULLS LAST gave them.
 *
 * A price range is the grouped query's test on the cheapest offer, put per
 * offer: the cheapest is at most `max` when some offer is, and at least `min`
 * when no offer is below it. Same cent of slack as candidateQuery's HAVING.
 */
export function rankedCandidateQuery(
  parsed: ParsedSearch,
  conditions: CandidateConditions,
  rates: Record<string, number>,
  bounds: { min: number | null; max: number | null },
  part: "known" | "unknown",
  limit: number
): SQL {
  const by = parsed.sort.by as keyof typeof METRIC_SORTS;
  const { column, floor } = METRIC_SORTS[by];
  const known = sql`${column} >= ${sql.raw(String(floor))}`;
  const direction = parsed.sort.order === "asc" ? sql`ASC` : sql`DESC`;
  const usd = offerUsd(conditions, rates);
  const offer = (extra: SQL) =>
    sql`(SELECT 1 FROM marketplace_offers o WHERE o.domain_id = d.id AND ${conditions.offer} ${extra})`;
  return sql`
    SELECT lower(d.domain) AS host
    FROM domains d
    WHERE ${part === "known" ? known : sql`(${column} IS NULL OR ${column} < ${sql.raw(String(floor))})`}
      AND ${conditions.site}
      AND EXISTS ${offer(bounds.max != null ? sql`AND ${usd} <= ${bounds.max + 0.01}::float` : sql``)}
      ${bounds.min != null ? sql`AND NOT EXISTS ${offer(sql`AND ${usd} < ${bounds.min - 0.01}::float`)}` : sql``}
    ORDER BY ${part === "known" ? sql`${column} ${direction}, ` : sql``}lower(d.domain) ASC
    LIMIT ${limit}::int
  `;
}

/**
 * The hosts that match, cheapest or dearest first, for a search sorted by
 * price — the price has to be computed per domain before it can be ordered
 * on, so this one joins every matching offer and groups them per domain.
 * Every other search takes rankedCandidateQuery.
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
  conditions: CandidateConditions,
  rates: Record<string, number>,
  bounds: { min: number | null; max: number | null },
  limit: number
): SQL {
  const usd = sql`MIN(${offerUsd(conditions, rates)})`;

  // A cent of slack either side: this compares an unrounded float, while the
  // published price was rounded to the cent before the fee. matchesSearch
  // applies the exact rule afterwards.
  const having = [
    bounds.min != null ? sql`${usd} >= ${bounds.min - 0.01}::float` : null,
    bounds.max != null ? sql`${usd} <= ${bounds.max + 0.01}::float` : null,
  ].filter((c): c is SQL => c != null);

  // A metric as the response publishes it: NULL below its floor.
  const metric = parsed.sort.by === "price" ? null : METRIC_SORTS[parsed.sort.by];
  const sortExpr = metric
    ? sql`(CASE WHEN ${metric.column} >= ${sql.raw(String(metric.floor))} THEN ${metric.column} END)`
    : usd;
  const direction = parsed.sort.order === "asc" ? sql`ASC` : sql`DESC`;

  return sql`
    SELECT lower(d.domain) AS host
    FROM domains d
    JOIN marketplace_offers o ON o.domain_id = d.id AND ${conditions.offer}
    WHERE ${conditions.site}
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
  limit: number,
  since: string
): Promise<{ hosts: string[]; exhausted: boolean }> {
  const bounds = sourcePriceBounds(parsed.filters, minFeeCents(rates));
  // A max_price below the minimum fee: no source price can satisfy it.
  if (bounds.none) return { hosts: [], exhausted: true };
  const conditions = candidateConditions(parsed, since, await countryClause(parsed.filters.country));
  const read = async (query: SQL) =>
    ((await db.execute(query)).rows as unknown as { host: string }[]).map((r) => r.host);

  let rows: string[];
  if (parsed.sort.by === "price") {
    rows = await read(candidateQuery(parsed, conditions, rates, bounds, limit));
  } else {
    rows = await read(rankedCandidateQuery(parsed, conditions, rates, bounds, "known", limit));
    // A range on the sort's own metric already requires it to be known.
    const ranged = METRIC_SORTS[parsed.sort.by].ranged.some((k) => parsed.filters[k] != null);
    if (rows.length < limit && !ranged) {
      rows = rows.concat(
        await read(rankedCandidateQuery(parsed, conditions, rates, bounds, "unknown", limit - rows.length))
      );
    }
  }
  return { hosts: distinctHosts(rows), exhausted: rows.length < limit };
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
  const since = freshSince();
  const { hosts, exhausted } = await fetchCandidates(parsed, rates, candidateLimit(parsed.limit), since);

  const matched: SearchResult[] = [];
  const price = async (batch: string[]) => {
    const catalog = await fetchCatalog(batch);
    for (const domain of batch) {
      const data = pricingBodyFor(domain, catalog.get(domain), rates, parsed.niche);
      if (data && matchesSearch(data, parsed.filters, parsed.niche, since)) matched.push({ domain, data });
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

  // 4. Search, within the deadline.
  let results: SearchResult[];
  let hasMore: boolean;
  try {
    ({ results, hasMore } = await withinDeadline(getUsdRates().then((rates) => runSearch(parsed, rates))));
  } catch (err) {
    // Our failure, not the caller's: every claimed lookup goes back.
    const afterFailure = await refundLookups(key.id, w.month, units, TAG);
    const failure = lookupFailure(
      err,
      rateLimitHeaders(monthLimit, afterFailure ?? monthUsed, minuteLimit, minuteUsed, w.monthResetEpoch),
      TAG
    );
    logLookups(key, [{ domain: LOG_PLACEHOLDER, status: failure.status }], Date.now() - startMs, TAG);
    return failure;
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
