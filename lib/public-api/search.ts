/**
 * The public search endpoint's request parsing, result checking and response
 * shape, as pure functions.
 *
 * POST /api/v1/public/domains/search is the pricing endpoint turned around:
 * instead of a list of domains it takes filters (DR, traffic, country, price
 * …) and answers with up to MAX_SEARCH_RESULTS matching domains, each carrying
 * the same per-domain pricing body the pricing endpoint returns
 * (buildPricingBody, shape.ts).
 *
 * Kept free of the database, the request and the quota claim for the same
 * reason batch.ts is: the shape is the product, and it has to be assertable
 * on its own. lib/public-api/search.test.ts pins it.
 */

import { withFeeUsd } from "@/lib/pricing/fee";
import type { BatchUsage } from "@/lib/public-api/batch";
import { ACCEPTED_NICHE_VALUES, resolveNiche, type NicheId } from "@/lib/public-api/pricing";
import { knownMetric, METRIC_FLOOR, type PricingBody } from "@/lib/public-api/shape";
import { countryMatchPrefixes } from "@/lib/search/country-normalize";
import { languageMatchValues } from "@/lib/search/language-normalize";

/**
 * The most domains one search returns. There is no pagination on purpose: a
 * search is for finding sites that fit a brief, and a caller who wants
 * different sites narrows the filters or changes the sort. Paging through
 * every match would hand out the catalogue itself.
 */
export const MAX_SEARCH_RESULTS = 50;

/** Upper bound on the values in one list filter (country, tld, category). */
export const MAX_FILTER_VALUES = 20;

/**
 * How recently a source must have confirmed a site's price for search to pick
 * the site. Some marketplaces stopped being refreshed months ago while their
 * listings still read as available — 76,268 offers last fetched in June, tens
 * of thousands not since March (Oct 2026) — and a site priced only by one of
 * them is a price nobody can buy at. About 6% of priced sites have nothing
 * fresher. The pricing endpoint still answers for them when asked by name,
 * with the date in `last_updated`.
 */
export const MAX_PRICE_AGE_DAYS = 90;

/** The oldest `last_updated` (YYYY-MM-DD) a search result may carry. */
export function freshSince(now = new Date()): string {
  return new Date(now.getTime() - MAX_PRICE_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
}

/** Far above any real search request; a body this size is not one we would accept. */
export const MAX_SEARCH_BODY_BYTES = 16 * 1024;

export const SEARCH_SORTS = ["dr", "traffic", "ref_domains", "price"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type SearchOrder = "asc" | "desc";

/** Every accepted key of `filters`, in the order the docs list them. */
export const FILTER_KEYS = [
  "min_dr",
  "max_dr",
  "min_traffic",
  "max_traffic",
  "min_ref_domains",
  "max_ref_domains",
  "min_price",
  "max_price",
  "country",
  "language",
  "tld",
  "category",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

const TOP_LEVEL_KEYS = ["filters", "niche", "sort", "order", "limit"] as const;

/**
 * The filters as validated and normalized — and as echoed back, under the
 * same keys the caller sent, so a response says exactly what was searched.
 */
export interface SearchFilters {
  min_dr?: number;
  max_dr?: number;
  min_traffic?: number;
  max_traffic?: number;
  min_ref_domains?: number;
  max_ref_domains?: number;
  /** USD, compared against `pricing.<niche>.linkpricer.lowest`. */
  min_price?: number;
  max_price?: number;
  /** ISO 3166-1 alpha-2 codes, upper case. Any one of them matches. */
  country?: string[];
  /** ISO 639-1 code, lower case. */
  language?: string;
  /** Without the leading dot, lower case. Any one of them matches. */
  tld?: string[];
  /** Words matched against the site's category text. Any one of them matches. */
  category?: string[];
}

/** A request-level rejection: nothing is searched and no quota is used. */
export interface SearchRequestError {
  ok: false;
  status: 400 | 422;
  code: string;
  message: string;
}

export interface ParsedSearch {
  ok: true;
  niche: NicheId | null;
  filters: SearchFilters;
  sort: { by: SearchSort; order: SearchOrder };
  limit: number;
}

export interface SearchResult {
  domain: string;
  /** The same pricing body the pricing endpoint returns for this domain. */
  data: PricingBody;
}

export interface SearchBody {
  api_version: "1";
  niche: NicheId | null;
  filters: SearchFilters;
  sort: { by: SearchSort; order: SearchOrder };
  summary: {
    returned: number;
    limit: number;
    /** Whether more domains matched than were returned. */
    has_more: boolean;
  };
  usage: BatchUsage;
  results: SearchResult[];
}

const EXAMPLE = '{ "filters": { "min_dr": 40, "country": ["US"], "max_price": 200 } }';

function fail(status: 400 | 422, code: string, message: string): SearchRequestError {
  return { ok: false, status, code, message };
}

function invalidFilter(key: string, rule: string): SearchRequestError {
  return fail(422, "invalid_filter", `"${key}" ${rule}`);
}

/** A JSON number that is a whole number within [min, max], or null. */
function wholeNumber(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

/**
 * A list filter accepts one string or an array of them. Returns the trimmed,
 * de-duplicated entries, or null when the value is not that shape.
 */
function stringList(v: unknown): string[] | null {
  const raw = typeof v === "string" ? [v] : v;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FILTER_VALUES) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const t = item.trim();
    if (!t) return null;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

const LIST_RULE = `must be a string or an array of 1 to ${MAX_FILTER_VALUES} strings.`;

// A TLD is matched as a literal suffix in a LIKE pattern, so its character
// set is closed to exactly what a TLD can contain — which also keeps LIKE's
// own wildcards (% and _) out of it.
const TLD_SAFE = /^[\p{L}\p{N}]([\p{L}\p{N}-]*[\p{L}\p{N}])?(\.[\p{L}\p{N}]([\p{L}\p{N}-]*[\p{L}\p{N}])?)*$/u;

// A category is matched as a substring in a LIKE pattern. Letters, digits and
// the punctuation category names actually use; never % or _.
const CATEGORY_SAFE = /^[\p{L}\p{N}][\p{L}\p{N} &/,'-]*$/u;

const METRIC_RANGES: [FilterKey, FilterKey, number, string][] = [
  ["min_dr", "max_dr", 100, "must be a whole number from 0 to 100."],
  ["min_traffic", "max_traffic", 1e12, "must be a whole number, 0 or more."],
  ["min_ref_domains", "max_ref_domains", 1e12, "must be a whole number, 0 or more."],
];

export function parseSearchRequest(body: unknown): ParsedSearch | SearchRequestError {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return fail(400, "invalid_request", `Request body must be a JSON object: ${EXAMPLE}.`);
  }
  const b = body as Record<string, unknown>;

  // Unknown fields are refused rather than ignored. A search is charged per
  // result, so a filter that silently did nothing — sent at the top level
  // instead of inside "filters", or misspelled — would be a charge for sites
  // the caller never asked for.
  const unknownTop = Object.keys(b).filter((k) => !(TOP_LEVEL_KEYS as readonly string[]).includes(k));
  if (unknownTop.length) {
    const hint = (FILTER_KEYS as readonly string[]).includes(unknownTop[0]) ? ' Filters go inside "filters".' : "";
    return fail(
      422,
      "unknown_field",
      `Unknown field "${unknownTop[0]}". Accepted fields are: ${TOP_LEVEL_KEYS.join(", ")}.${hint}`
    );
  }

  // Omitted filters are no filters; a niche alone is a complete search.
  const rawFilters = b.filters ?? {};
  if (typeof rawFilters !== "object" || Array.isArray(rawFilters)) {
    return fail(400, "invalid_request", `"filters" must be an object: ${EXAMPLE}.`);
  }
  const f = rawFilters as Record<string, unknown>;

  const unknownFilter = Object.keys(f).find((k) => !(FILTER_KEYS as readonly string[]).includes(k));
  if (unknownFilter) {
    return fail(
      422,
      "unknown_filter",
      `Unknown filter "${unknownFilter}". Accepted filters are: ${FILTER_KEYS.join(", ")}.`
    );
  }

  const filters: SearchFilters = {};

  // A null filter is the same as an omitted one, as it is for niche.
  for (const [minKey, maxKey, ceiling, rule] of METRIC_RANGES) {
    for (const key of [minKey, maxKey]) {
      if (f[key] == null) continue;
      const n = wholeNumber(f[key], 0, ceiling);
      if (n == null) return invalidFilter(key, rule);
      (filters as Record<string, number>)[key] = n;
    }
    const lo = (filters as Record<string, number | undefined>)[minKey];
    const hi = (filters as Record<string, number | undefined>)[maxKey];
    if (lo != null && hi != null && lo > hi) return invalidFilter(minKey, `cannot be greater than "${maxKey}".`);
  }

  for (const key of ["min_price", "max_price"] as const) {
    if (f[key] == null) continue;
    const v = f[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1_000_000) {
      return invalidFilter(key, "must be a number of US dollars greater than 0.");
    }
    filters[key] = v;
  }
  if (filters.min_price != null && filters.max_price != null && filters.min_price > filters.max_price) {
    return invalidFilter("min_price", 'cannot be greater than "max_price".');
  }

  if (f.country != null) {
    const list = stringList(f.country);
    if (!list) return invalidFilter("country", LIST_RULE);
    const codes: string[] = [];
    for (const raw of list) {
      const code = raw.toUpperCase();
      if (!countryMatchPrefixes(code)) {
        return fail(
          422,
          "invalid_country",
          `"${raw}" is not a country code we recognise. Use ISO 3166-1 alpha-2 codes such as US, GB or DE.`
        );
      }
      if (!codes.includes(code)) codes.push(code);
    }
    filters.country = codes;
  }

  if (f.language != null) {
    const code = typeof f.language === "string" ? f.language.trim().toLowerCase() : "";
    if (!/^[a-z]{2}$/.test(code) || languageMatchValues(code).length === 0) {
      return fail(
        422,
        "invalid_language",
        '"language" must be one ISO 639-1 code such as en, de or es.'
      );
    }
    filters.language = code;
  }

  if (f.tld != null) {
    const list = stringList(f.tld);
    if (!list) return invalidFilter("tld", LIST_RULE);
    const tlds: string[] = [];
    for (const raw of list) {
      const tld = raw.toLowerCase().replace(/^\./, "");
      if (tld.length > 24 || !TLD_SAFE.test(tld)) {
        return fail(422, "invalid_tld", `"${raw}" is not a valid TLD. Send it like de, com or co.uk.`);
      }
      if (!tlds.includes(tld)) tlds.push(tld);
    }
    filters.tld = tlds;
  }

  if (f.category != null) {
    const list = stringList(f.category);
    if (!list) return invalidFilter("category", LIST_RULE);
    const categories: string[] = [];
    for (const raw of list) {
      const category = raw.toLowerCase();
      if (category.length < 2 || category.length > 60 || !CATEGORY_SAFE.test(category)) {
        return fail(
          422,
          "invalid_category",
          `"${raw}" is not a usable category. Send a word or short phrase such as technology, health or travel.`
        );
      }
      if (!categories.includes(category)) categories.push(category);
    }
    filters.category = categories;
  }

  // Blank means "no niche": an empty niche and an omitted one are the same request.
  let niche: NicheId | null = null;
  if (b.niche != null) {
    const trimmed = typeof b.niche === "string" ? b.niche.trim() : null;
    if (trimmed == null) return invalidNiche();
    if (trimmed) {
      niche = resolveNiche(trimmed);
      if (!niche) return invalidNiche();
    }
  }

  // A niche narrows the search on its own: only sites priced for it are
  // candidates. With neither a niche nor a filter the request is almost
  // certainly a mistake, and every result would be charged.
  if (Object.keys(filters).length === 0 && !niche) {
    return fail(
      422,
      "no_filters",
      `Set a niche or at least one filter. Accepted filters are: ${FILTER_KEYS.join(", ")}.`
    );
  }

  let by: SearchSort = "dr";
  if (b.sort != null) {
    if (typeof b.sort !== "string" || !(SEARCH_SORTS as readonly string[]).includes(b.sort)) {
      return fail(422, "invalid_sort", `Invalid sort. Valid values are: ${SEARCH_SORTS.join(", ")}.`);
    }
    by = b.sort as SearchSort;
  }
  // Cheapest first for price, strongest first for a metric — the order
  // someone asking for "sort by price" or "sort by DR" means.
  let order: SearchOrder = by === "price" ? "asc" : "desc";
  if (b.order != null) {
    if (b.order !== "asc" && b.order !== "desc") {
      return fail(422, "invalid_sort", 'Invalid order. Valid values are: asc, desc.');
    }
    order = b.order;
  }

  let limit = MAX_SEARCH_RESULTS;
  if (b.limit != null) {
    const n = wholeNumber(b.limit, 1, MAX_SEARCH_RESULTS);
    if (n == null) {
      return fail(422, "invalid_limit", `"limit" must be a whole number from 1 to ${MAX_SEARCH_RESULTS}.`);
    }
    limit = n;
  }

  return { ok: true, niche, filters, sort: { by, order }, limit };
}

function invalidNiche(): SearchRequestError {
  return fail(422, "invalid_niche", `Invalid niche. Valid values are: ${ACCEPTED_NICHE_VALUES.join(", ")}`);
}

// ─── price ──────────────────────────────────────────────────────────────────

/**
 * The niche whose price a search filters on, sorts by and guarantees is
 * present in every result: the one asked for, or standard.
 */
export function priceNiche(niche: NicheId | null): NicheId {
  return niche ?? "standard";
}

/**
 * The source-price range, in USD, whose fee-inclusive price falls inside the
 * caller's min_price/max_price.
 *
 * The price filter is on `linkpricer.lowest` — what the caller would pay —
 * but the catalogue stores what the sources charge. The fee is the larger of
 * a percentage and a minimum, then rounded, so it cannot be divided back out;
 * it is monotonic, though, so the boundary is found by bisection over cents
 * against withFeeUsd() itself. That keeps this honest by construction: there
 * is no second copy of the fee rule here to drift from the first.
 *
 * `none` is true when no source price can satisfy the filter at all (a
 * max_price below the minimum fee).
 */
export function sourcePriceBounds(
  filters: Pick<SearchFilters, "min_price" | "max_price">,
  feeFloorCents: number
): { min: number | null; max: number | null; none: boolean } {
  const lp = (cents: number) => withFeeUsd(cents / 100, feeFloorCents);
  let min: number | null = null;
  let max: number | null = null;

  if (filters.max_price != null) {
    // Largest source price whose fee-inclusive price is still <= max_price.
    // withFeeUsd(p) > p, so it cannot be above max_price itself.
    let lo = 0;
    let hi = Math.ceil(filters.max_price * 100);
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lp(mid) <= filters.max_price) lo = mid;
      else hi = mid - 1;
    }
    if (lo === 0) return { min: null, max: null, none: true };
    max = lo / 100;
  }

  if (filters.min_price != null) {
    // Smallest source price whose fee-inclusive price reaches min_price.
    let lo = 1;
    let hi = Math.ceil(filters.min_price * 100);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (lp(mid) >= filters.min_price) hi = mid;
      else lo = mid + 1;
    }
    min = lo / 100;
  }

  return { min, max, none: false };
}

// ─── results ────────────────────────────────────────────────────────────────


function inRange(v: number | null, min: number | undefined, max: number | undefined): boolean {
  if (min == null && max == null) return true;
  // A filter on a metric only ever matches sites where that metric is known.
  if (v == null) return false;
  return (min == null || v >= min) && (max == null || v <= max);
}

/** The price a search filters and sorts on, or null when the body has none. */
export function searchPrice(data: PricingBody, niche: NicheId | null): number | null {
  return data.pricing[priceNiche(niche)]?.linkpricer.lowest ?? null;
}

/**
 * Whether a finished pricing body satisfies the search, judged on the numbers
 * it publishes.
 *
 * The database picks the candidates, but it is this check that decides what
 * is returned and charged. The candidate query works row by row, while a
 * published body pools every spelling of a host and keeps one offer per
 * marketplace, so the two can disagree at the margins (a host stored twice
 * with different metrics, say). Checking the body means a caller never
 * receives a result that contradicts the filter they sent.
 *
 * Country, language, TLD and category are matched in the database only: they
 * are either not published or published as free text.
 *
 * `since` (freshSince) drops a site whose price for the niche was last
 * confirmed before that date.
 */
export function matchesSearch(
  data: PricingBody,
  filters: SearchFilters,
  niche: NicheId | null,
  since?: string
): boolean {
  if (!data.found) return false;
  const price = searchPrice(data, niche);
  if (price == null) return false;
  if (since != null) {
    const updated = data.pricing[priceNiche(niche)]?.last_updated;
    if (updated == null || updated < since) return false;
  }
  if (filters.min_price != null && price < filters.min_price) return false;
  if (filters.max_price != null && price > filters.max_price) return false;
  const m = data.metrics;
  return (
    inRange(knownMetric(m.domain_rating, METRIC_FLOOR.domain_rating), filters.min_dr, filters.max_dr) &&
    inRange(knownMetric(m.organic_traffic, METRIC_FLOOR.organic_traffic), filters.min_traffic, filters.max_traffic) &&
    inRange(knownMetric(m.ref_domains, METRIC_FLOOR.ref_domains), filters.min_ref_domains, filters.max_ref_domains)
  );
}

function sortValue(data: PricingBody, by: SearchSort, niche: NicheId | null): number | null {
  switch (by) {
    case "dr":
      return knownMetric(data.metrics.domain_rating, METRIC_FLOOR.domain_rating);
    case "traffic":
      return knownMetric(data.metrics.organic_traffic, METRIC_FLOOR.organic_traffic);
    case "ref_domains":
      return knownMetric(data.metrics.ref_domains, METRIC_FLOOR.ref_domains);
    case "price":
      return searchPrice(data, niche);
  }
}

/**
 * Orders results by the published value of the sort key. An unknown value
 * sorts last in either direction, so missing data never leads an ascending
 * sort; ties fall back to the domain name, which makes the order repeatable.
 */
export function sortResults(
  results: SearchResult[],
  sort: { by: SearchSort; order: SearchOrder },
  niche: NicheId | null
): SearchResult[] {
  const dir = sort.order === "asc" ? 1 : -1;
  return [...results].sort((a, b) => {
    const va = sortValue(a.data, sort.by, niche);
    const vb = sortValue(b.data, sort.by, niche);
    if (va !== vb) {
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    }
    return a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0;
  });
}

export function buildSearchBody(
  parsed: ParsedSearch,
  results: SearchResult[],
  hasMore: boolean,
  usage: BatchUsage
): SearchBody {
  return {
    api_version: "1",
    niche: parsed.niche,
    filters: parsed.filters,
    sort: parsed.sort,
    summary: { returned: results.length, limit: parsed.limit, has_more: hasMore },
    usage,
    results,
  };
}
