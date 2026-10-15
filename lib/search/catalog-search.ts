// Shared semantic search core for the marketplace catalog — extracted from
// app/api/related-sites/route.ts so the same SQL prefilter + Claude rerank +
// pricing-join pipeline can also back the public homepage AI chat
// (app/api/homepage-search/route.ts) without duplicating the Claude call or
// the offers joins.
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getExcludedDomains, getCachedExcludedDomains, normalizeDomain } from "@/lib/integrations/referring-domains-cache";
import { rerankWithClaude } from "@/lib/ai/claude-rerank";
import { rerankWithOpenAI } from "@/lib/ai/openai-rerank";
import { normalizeLanguage, languageDisplayLabel, languageMatchValues } from "@/lib/search/language-normalize";
import { countryMatchRules } from "@/lib/search/country-normalize";
import { getUsdRates, toUsd } from "@/lib/currency";
import { embedQuery, embeddingForDomain } from "@/lib/search/query-embedding";
import { vectorCandidates, headVectorCandidates, deepVectorCandidates, type DeepCandidate, type VectorCandidate } from "@/lib/search/vector-candidates";

const DEFAULT_CLAUDE_SHORTLIST_SIZE = 80;
const DEFAULT_FINAL_RESULT_SIZE = 30;
const DEFAULT_CANDIDATE_POOL_LIMIT = 400;

// The SQL prefilter (ILIKE across 596K domains, joined + aggregated with
// per-row price subqueries) plus the Claude rerank call together take
// 0.6-10s depending on how common the search word is and cache warmth —
// there's no index that helps once a word matches a large fraction of the
// table (Postgres correctly prefers a seq scan over the trigram indexes at
// that selectivity; verified via EXPLAIN ANALYZE). Search results aren't
// required to be second-fresh — actual price/availability is re-verified
// authoritatively at checkout time (resolveOffer in lib/orders/pricing.ts)
// — so a short in-memory TTL cache, same pattern as getUsdRates() in
// lib/currency.ts, turns repeat/popular searches (this is what a public,
// unauthenticated homepage search realistically gets) into a cache hit
// instead of paying the full DB+LLM cost every time. Bounded size with
// oldest-first eviction since query text has effectively unbounded
// cardinality and a warm serverless instance could otherwise grow this
// unboundedly over its lifetime.
const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, { result: CatalogSearchOutput; cachedAt: number }>();

// Folds a multi-select list plus its legacy single-value field into one
// trimmed, de-duplicated, sorted list. Sorting is what makes the cache key
// order-independent; de-duplication keeps a repeated value from widening the
// generated OR clause for no reason.
export function normalizeFilterList(list: string[] | undefined, single: string | undefined): string[] {
  const all = [...(list ?? []), ...(single ? [single] : [])].map((v) => v.trim()).filter(Boolean);
  return [...new Set(all)].sort();
}

function searchCacheKey(opts: CatalogSearchOptions): string {
  const f = opts.filters ?? {};
  return JSON.stringify([
    opts.query.trim().toLowerCase(),
    // Country/category go in as their normalized, sorted list form so that
    // {country:"US"} and {countries:["US"]} — the same filter expressed two
    // ways — share one cache entry, and so click order never splits the key.
    normalizeFilterList(f.countries, f.country),
    f.language ?? null, f.minTraffic ?? null, f.maxTraffic ?? null,
    f.minDr ?? null, f.maxDr ?? null, f.minPrice ?? null, f.maxPrice ?? null,
    normalizeFilterList(f.categories, f.category), f.grade ?? null,
    // Sorted so ["com","de"] and ["de","com"] (same filter, different UI
    // click order) hit the same cache entry instead of missing each other.
    (f.tlds && f.tlds.length ? [...f.tlds].map((t) => t.toLowerCase()).sort() : null),
    opts.ownSite?.trim().toLowerCase() ?? null, opts.hideLinked ?? false,
    opts.claudeShortlistSize ?? DEFAULT_CLAUDE_SHORTLIST_SIZE,
    opts.finalResultSize ?? DEFAULT_FINAL_RESULT_SIZE,
    opts.sortBy ?? "match", opts.sortDir ?? "desc",
    opts.candidatePoolLimit ?? DEFAULT_CANDIDATE_POOL_LIMIT,
    opts.deep ?? false,
  ]);
}

// marketplace_offers/supplier_offers store prices in whatever currency the
// source quotes (mostly EUR, some USD, a handful of GBP — confirmed live:
// 1,485,337 EUR / 576,550 USD / 3 GBP rows). Every price comparison/filter/
// MIN() done in SQL must convert to USD first, or it silently ranks/filters
// on raw mismatched-currency numbers (e.g. treats "205" EUR as cheaper than
// "220" USD without ever checking they're not the same unit). Same `rates`
// source /api/analyze already uses (lib/currency.ts, admin-configurable,
// falls back to defaults, 5-min cache) — built into a SQL CASE expression
// here since this file (unlike /api/analyze) needs to filter/sort by price
// *inside* SQL, before results ever reach JS.
// Neon's HTTP driver infers a parameterized CASE expression's type from
// context — with an untyped `ELSE 1` literal, it decided the whole CASE was
// `integer` and then rejected the bound rate parameters ("invalid input
// syntax for type integer: \"1.14\""). Explicit ::float casts on every
// branch (including ELSE) make the type unambiguous regardless of driver.
function usdCaseExpr(priceExpr: SQL, currencyExpr: SQL, rates: Record<string, number>): SQL {
  const whens = Object.entries(rates)
    .filter(([cur]) => cur !== "USD")
    .map(([cur, rate]) => sql`WHEN ${cur} THEN ${rate}::float`);
  return sql`(${priceExpr} * (CASE UPPER(${currencyExpr}) ${whens.length ? sql.join(whens, sql` `) : sql``} ELSE 1::float END))`;
}

export type CatalogSortBy = "match" | "dr" | "traffic" | "price" | "keywords" | "refDomains";
export type CatalogSortDir = "asc" | "desc";

// Column extractors for server-side (non-Claude) sorting — used when the
// caller asks to sort by a plain metric instead of "best match". Null/NaN
// always sorts last regardless of direction, so missing data never floats
// to the top of an ascending sort.
const SORT_EXTRACTORS: Partial<Record<CatalogSortBy, (r: Record<string, unknown>) => number | null>> = {
  dr: (r) => (r.dr != null ? Number(r.dr) : null),
  traffic: (r) => (r.traffic != null ? Number(r.traffic) : null),
  price: (r) => (r.best_price != null ? Number(r.best_price) : null),
  keywords: (r) => (r.keywords != null ? Number(r.keywords) : null),
  refDomains: (r) => (r.ref_domains != null ? Number(r.ref_domains) : null),
};

// Ordinal ranking for the "grade" filter's "X & above" semantics (A+ is the
// only exact-match option; A/B+/B are thresholds). Mirrors the same DR
// fallback used to compute each row's displayed grade below, so filtering
// and display never disagree.
const GRADE_RANK: Record<string, number> = { B: 1, "B+": 2, A: 3, "A+": 4 };

function fmtUpdated(ts: string | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export interface CatalogSearchOffer {
  name: string;
  type: "API" | "Vendor" | "DB";
  updated: string;
  minPrice: number;
  maxPrice: number;
  // `quality` is a real buyer-submitted average (1-5) only when
  // hasEnoughRatings is true — never a fabricated/default number. UI must
  // gate display on hasEnoughRatings, not just check `quality` truthiness.
  quality: number;
  ratingCount: number;
  hasEnoughRatings: boolean;
  delivery: number;
  tat: number;
  link: string;
  example: string | null;
}

// Below this many submitted ratings, an average isn't shown — see the
// "New" pill in components/dashboard/results-shared.tsx's RatingBadge.
const MIN_RATINGS_FOR_DISPLAY = 3;

export interface CatalogSearchFilters {
  country?: string;
  language?: string;
  minTraffic?: number;
  maxTraffic?: number;
  minDr?: number;
  maxDr?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  grade?: string;
  // Multi-select variants of `country` / `category`. Both are OR sets — a
  // domain matches if it is in ANY selected country / ANY selected niche,
  // the same semantics as `tlds` above. The singular fields stay for the
  // public homepage caller (and older clients), and are folded into these
  // lists at query time so there is exactly one code path building the SQL.
  countries?: string[];
  categories?: string[];
  // Domain extension(s), no leading dot ("com", not ".com") — a domain
  // matches if it ends in ANY of these (OR, not AND — a domain only has one
  // TLD, so "must match every selected TLD" would always return nothing).
  tlds?: string[];
}

export interface CatalogSearchResult {
  // domains.id — what tail entries and fetchResultRowsByIds are keyed on.
  id: string;
  domain: string;
  matchPct: number;
  country: string;
  lang: string;
  category: string;
  dr: number;
  drUpdatedAt: string | null;
  drTrend: "flat";
  traffic: number;
  keywords: number;
  refDomains: number;
  grade: string;
  score: number;
  bestPrice: number | null;
  yourPrice: number | null;
  offers: CatalogSearchOffer[];
}

export interface CatalogSearchOptions {
  query: string;
  filters?: CatalogSearchFilters;
  ownSite?: string;
  hideLinked?: boolean;
  claudeShortlistSize?: number;
  finalResultSize?: number;
  // When sortBy is "match" (default/omitted), ranking is the existing
  // Claude semantic rerank over the word-overlap shortlist. Any other
  // sortBy skips Claude entirely and orders the full candidate pool by
  // that plain SQL column instead — cheaper and unbounded by shortlist size.
  sortBy?: CatalogSortBy;
  sortDir?: CatalogSortDir;
  candidatePoolLimit?: number;
  // Paginated mode. Returns every site the reranker scored (the whole
  // shortlist, not the best `finalResultSize` of it) plus `tail`, the handle
  // for loading the rest of the related sites with searchCatalogTail. Off by
  // default so the public homepage search, which shows a single result, is
  // unchanged.
  deep?: boolean;
}

// What the first page of a deep search hands to searchCatalogTail so the
// rest of the list is scored on the same scale. Display-only: it shapes the
// estimated match % and nothing else, so it is safe to round-trip through
// the client.
export interface CatalogTailAnchor {
  // Best similarity in the search — the reference the relevance floor is a
  // fraction of.
  simTop: number;
  // A similarity and the match % the model gave sites at that similarity.
  anchorSim: number;
  anchorPct: number;
  // Upper bound on any estimated match %.
  pctCap: number;
}

// One row of the tail: enough to count, order and re-sort it. The full row
// (offers, prices) is fetched per page through fetchResultRowsByIds.
export interface CatalogTailEntry {
  id: string;
  matchPct: number;
  dr: number;
  traffic: number;
  keywords: number;
}

export interface CatalogTailOutput {
  entries: CatalogTailEntry[];
  // True when the list did not reach the relevance floor — i.e. more related
  // sites may exist than were returned.
  capped: boolean;
  // Only ever true on a `quick` answer: the quick pass did not reach the
  // relevance floor, so the full list has to be asked for to finish the job.
  partial: boolean;
}

export interface CatalogSearchOutput {
  results: CatalogSearchResult[];
  lowRelevance: boolean;
  degradedAhrefs: boolean;
  total: number;
  // Present only in `deep` mode on a match-sorted search that reached the
  // vector index: pass it to searchCatalogTail to load the rest of the list.
  tail?: CatalogTailAnchor;
}

// Same offers join as /api/analyze — marketplace_offers + supplier_offers +
// domain_examples, keyed by domain — so results can expand into the
// identical compare-offers UI Domain Analysis already uses.
async function fetchOffersForDomains(domains: string[], rates: Record<string, number>): Promise<Map<string, CatalogSearchOffer[]>> {
  const offersMap = new Map<string, CatalogSearchOffer[]>();
  if (domains.length === 0) return offersMap;
  const domainList = sql.join(domains.map((d) => sql`${d}`), sql`, `);

  // Buyer-submitted ratings aggregated live (order_ratings stays small — no
  // precomputed metrics table needed). Marketplace/DB offers are rated by
  // marketplace name (orders.snapshot_marketplace_name, always populated at
  // order creation); vendor offers are rated by vendor user id, snapshotted
  // into orders.snapshot_offer_metadata->>'vendorUserId' at order creation
  // (see app/api/orders/route.ts) since supplier_offers rows can change or
  // be deleted after the order was placed.
  //
  // These 3 queries are logically independent, but bundled into ONE round
  // trip (json_agg per subquery, one row of 3 JSON columns) instead of 3
  // separate awaited db.execute() calls — even run concurrently via
  // Promise.all, each still pays its own full HTTP request/response latency
  // against Neon's serverless (neon-http) driver, which has no persistent
  // connection to amortize that cost across calls. Measured locally: a bare
  // `SELECT 1` round trip alone costs 300ms-2s+ depending on connection
  // warmth, independent of query complexity — so 3 concurrent round trips
  // cost close to 3x a single round trip's latency floor, not free just
  // because they're parallel. Each inner subquery's SELECT/JOIN/WHERE/ORDER
  // is byte-identical to the original 3 separate queries — only the
  // transport (1 combined round trip vs 3) changed.
  const combined = (await db.execute(sql`
    SELECT
      (SELECT json_agg(row_to_json(mp)) FROM (
        SELECT LOWER(d.domain) AS domain, mo.marketplace_name AS name, mo.min_price, mo.max_price, mo.currency,
               mo.delivery_time_days, mo.link_type, mo.tat, mo.updated_at,
               rt.avg_rating, rt.rating_count
        FROM marketplace_offers mo
        JOIN domains d ON d.id = mo.domain_id
        LEFT JOIN (
          SELECT marketplace_name, AVG(rating)::float AS avg_rating, COUNT(*)::int AS rating_count
          FROM (
            -- Buyer reviews: attributed via the order they actually completed.
            SELECT LOWER(o.snapshot_marketplace_name) AS marketplace_name, orr.rating
            FROM order_ratings orr
            JOIN orders o ON o.id = orr.order_id
            WHERE orr.order_id IS NOT NULL AND o.snapshot_marketplace_name IS NOT NULL
            UNION ALL
            -- Admin reviews: no order to attach to, marketplace set directly
            -- (see app/api/admin/reviews/marketplaces/route.ts).
            SELECT LOWER(orr.marketplace_name) AS marketplace_name, orr.rating
            FROM order_ratings orr
            WHERE orr.order_id IS NULL AND orr.marketplace_name IS NOT NULL
          ) combined
          GROUP BY marketplace_name
        ) rt ON rt.marketplace_name = LOWER(mo.marketplace_name)
        WHERE mo.available = true AND mo.min_price::float > 0 AND LOWER(d.domain) IN (${domainList})
        ORDER BY mo.min_price::float ASC
      ) mp) AS marketplace_json,
      (SELECT json_agg(row_to_json(vd)) FROM (
        SELECT LOWER(so.domain) AS domain, COALESCE(u.vendor_name, CONCAT(u.first_name, ' ', u.last_name), u.email) AS vendor_name,
               so.min_price, so.max_price, so.currency, so.delivery_time_days, so.updated_at, so.status,
               rt.avg_rating, rt.rating_count
        FROM supplier_offers so
        JOIN users u ON u.id = so.vendor_user_id
        LEFT JOIN (
          SELECT o.snapshot_offer_metadata->>'vendorUserId' AS vendor_user_id,
                 AVG(orr.rating)::float AS avg_rating, COUNT(*)::int AS rating_count
          FROM order_ratings orr
          JOIN orders o ON o.id = orr.order_id
          WHERE o.snapshot_offer_metadata->>'vendorUserId' IS NOT NULL
          GROUP BY o.snapshot_offer_metadata->>'vendorUserId'
        ) rt ON rt.vendor_user_id = so.vendor_user_id
        WHERE so.status = 'active' AND so.is_active = true AND so.min_price::float > 0 AND LOWER(so.domain) IN (${domainList})
        ORDER BY so.min_price::float ASC
      ) vd) AS vendor_json,
      (SELECT json_agg(row_to_json(ex)) FROM (
        SELECT domain, example_url, example_title FROM domain_examples
        WHERE domain IN (${domainList}) AND example_url IS NOT NULL AND example_url != ''
      ) ex) AS example_json
  `)).rows[0];

  type MarketplaceRow = { domain: string; name: string | null; min_price: unknown; max_price: unknown; currency: string | null; delivery_time_days: unknown; link_type: string | null; tat: unknown; updated_at: string | null; avg_rating: unknown; rating_count: unknown };
  type VendorRow = { domain: string; vendor_name: string | null; min_price: unknown; max_price: unknown; currency: string | null; delivery_time_days: unknown; updated_at: string | null; status: string | null; avg_rating: unknown; rating_count: unknown };
  type ExampleRow = { domain: string; example_url: string; example_title: string | null };

  // json_agg over zero matching rows returns SQL NULL, not an empty JSON
  // array — normalize to [] to match the original .rows-based empty-array
  // behavior exactly.
  const marketplaceRowsArr = (combined.marketplace_json as MarketplaceRow[] | null) ?? [];
  const vendorRowsArr = (combined.vendor_json as VendorRow[] | null) ?? [];
  const exampleRowsArr = (combined.example_json as ExampleRow[] | null) ?? [];

  const exampleMap = new Map<string, string>();
  for (const r of exampleRowsArr) exampleMap.set(r.domain, r.example_url);

  for (const r of marketplaceRowsArr) {
    const domain = r.domain as string;
    if (!offersMap.has(domain)) offersMap.set(domain, []);
    const minUsd = toUsd(Number(r.min_price ?? 0), r.currency as string | null, rates) ?? 0;
    const maxUsd = toUsd(Number(r.max_price ?? r.min_price ?? 0), r.currency as string | null, rates) ?? minUsd;
    const ratingCount = Number(r.rating_count ?? 0);
    const hasEnoughRatings = ratingCount >= MIN_RATINGS_FOR_DISPLAY;
    offersMap.get(domain)!.push({
      name: (r.name as string) ?? "Marketplace", type: "DB", updated: fmtUpdated(r.updated_at as string | null),
      minPrice: minUsd, maxPrice: maxUsd,
      quality: hasEnoughRatings ? Number(r.avg_rating) : 0, ratingCount, hasEnoughRatings,
      delivery: Number(r.delivery_time_days ?? 14),
      tat: Number(r.tat ?? r.delivery_time_days ?? 14), link: (r.link_type as string) ?? "Dofollow",
      example: exampleMap.get(domain) ?? null,
    });
  }
  for (const r of vendorRowsArr) {
    const domain = r.domain as string;
    if (!offersMap.has(domain)) offersMap.set(domain, []);
    const minUsd = toUsd(Number(r.min_price ?? 0), r.currency as string | null, rates) ?? 0;
    const maxUsd = toUsd(Number(r.max_price ?? r.min_price ?? 0), r.currency as string | null, rates) ?? minUsd;
    const ratingCount = Number(r.rating_count ?? 0);
    const hasEnoughRatings = ratingCount >= MIN_RATINGS_FOR_DISPLAY;
    offersMap.get(domain)!.push({
      name: `Vendor: ${r.vendor_name as string}`, type: "Vendor", updated: fmtUpdated(r.updated_at as string | null),
      minPrice: minUsd, maxPrice: maxUsd,
      quality: hasEnoughRatings ? Number(r.avg_rating) : 0, ratingCount, hasEnoughRatings,
      delivery: Number(r.delivery_time_days ?? 14), tat: Number(r.delivery_time_days ?? 14),
      link: "Dofollow", example: exampleMap.get(domain) ?? null,
    });
  }
  for (const offers of offersMap.values()) offers.sort((a, b) => a.minPrice - b.minPrice);
  return offersMap;
}

// One aggregated catalogue row (as selected by the search query or by
// fetchResultRowsByIds) plus its offers, in the shape the results table
// renders. Shared so a row looks the same whichever path produced it.
function toResult(r: Record<string, unknown>, matchPct: number, offers: CatalogSearchOffer[]): CatalogSearchResult {
  const domain = r.domain as string;
  const dr = r.dr != null ? Number(r.dr) : 0;
  const traffic = r.traffic != null ? Number(r.traffic) : 0;
  const grade = (r.ai_grade as string) ?? (dr >= 70 ? "A+" : dr >= 55 ? "A" : dr >= 40 ? "B+" : "B");
  const score = r.ai_score != null ? Math.round(Number(r.ai_score)) : Math.round(Math.min(dr, 100) * 0.7 + Math.min(traffic / 100000, 30));
  const lpBestPrice = r.best_price != null ? Number(r.best_price) : null;
  const offerMin = offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null;
  // Prefer marketplace_offers (kept fresh by the scraper fleet) over
  // lp_domain_price, a legacy table most connectors stopped writing to
  // (frozen ~March 2026 for 44/46 marketplaces). Math.min let a months-stale
  // number beat today's real price. lp is fallback-only for domains with no
  // offers coverage yet.
  const bestPrice = offerMin ?? lpBestPrice;
  return {
    id: String(r.id),
    domain,
    matchPct,
    country: (r.country as string) ?? "US",
    lang: languageDisplayLabel(r.lang as string | null),
    category: (r.raw_category as string) ?? (r.semantic_category as string) ?? "General",
    dr,
    drUpdatedAt: (r.dr_updated_at as string | null) ?? null,
    drTrend: "flat",
    traffic,
    keywords: r.keywords != null ? Number(r.keywords) : 0,
    refDomains: r.ref_domains != null ? Number(r.ref_domains) : 0,
    grade,
    score,
    bestPrice,
    yourPrice: null,
    offers,
  };
}

/**
 * Full result rows for the given domain ids, in the order asked for — the
 * per-page fetch behind the tail. `matchPct` is 0 here: the score belongs to
 * a particular search and travels with its tail entry, so the caller fills
 * it in from there.
 *
 * Ids that no longer exist are simply absent from the result. A domain whose
 * offers have all gone since the search ran is still returned, with an empty
 * offer list, so the caller decides what a now-unsellable row means.
 */
export async function fetchResultRowsByIds(ids: string[], knownRates?: Record<string, number>): Promise<CatalogSearchResult[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const rates = knownRates ?? (await getUsdRates());
  const rows = (await db.execute(sql`
    SELECT d.id, LOWER(d.domain) AS domain, d.category AS raw_category,
           d.country_main_traffic AS country, d.language_written_in_website AS lang,
           d.domain_rating::float AS dr, d.domain_rating_updated_at AS dr_updated_at,
           d.org_traffic AS traffic, d.org_keywords AS keywords, d.ref_domains,
           ${bestPriceUsdExpr(rates)} AS best_price,
           COALESCE(d.semantic_category, ai."semanticCategory") AS semantic_category,
           ai."valueGrade" AS ai_grade, ai."valueScore"::float AS ai_score
    FROM domains d
    LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.domain
    WHERE d.id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})
  `)).rows as Record<string, unknown>[];

  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) if (!byId.has(String(r.id))) byId.set(String(r.id), r);
  const offersMap = await fetchOffersForDomains([...byId.values()].map((r) => r.domain as string), rates);
  return unique
    .map((id) => byId.get(id))
    .filter((r): r is Record<string, unknown> => !!r)
    .map((r) => toResult(r, 0, offersMap.get(r.domain as string) ?? []));
}

// How many nearest neighbours to pull from the HNSW index. Kept in step with
// EF_SEARCH in vector-candidates.ts — asking for more than ef_search returns
// silently fewer rows, not an error. These are then narrowed by the "has a
// live offer" check and the user's filters, so the surviving count is
// materially smaller than this.
const VECTOR_CANDIDATE_LIMIT = 150;

// Ceiling on rows the keyword branch may feed into the offer-existence
// check. Generous enough that narrow queries are unaffected, low enough that
// a generic word cannot turn one search into a full-table scan.
const KEYWORD_SCAN_LIMIT = 4000;

// How many related sites paginated ("deep") mode ranks in total. The
// reranked shortlist is the head of this list; the rest follows in order of
// similarity. 1,000 is pgvector's ef_search ceiling, i.e. the most the index
// returns in a single pass, and at 25 a page it is forty pages — past the
// point anyone reads to, but enough that a filtered search never runs dry
// while related sites still exist.
const DEEP_CANDIDATE_LIMIT = 1000;

// The quick first pass of the same list (searchCatalogTail with `quick`).
// What makes the deep read slow is not the query but the vector index being
// fetched from storage page by page on a search nobody has run lately, and
// that cost grows with how many neighbours are asked for. So the page asks
// for this many first, shows a count, and only then — and only if the list
// did not already end inside them — for the full thousand. 400 because the
// nearest ~150 are the shortlist the first page already shows, leaving about
// 250 new sites: ten more pages, for well under half the read.
const TAIL_QUICK_LIMIT = 400;
// Index tuples the quick pass may visit looking for those rows. Under a
// filter every tuple visited is a row fetched to test it, and cold that is
// the whole cost — so the budget, not the row limit, is what keeps the quick
// pass quick when the filter is selective. 3,000 fills the 400 rows for a
// broad filter (a large country) and stops a narrow one at a few seconds'
// work; the full read then goes the distance.
const TAIL_QUICK_SCAN_TUPLES = 3000;

// Sites past the shortlist were never read by the reranker, so they have no
// judged score. Their match % is estimated from similarity instead: the
// score the model gave sites at the edge of the shortlist (the anchor),
// scaled by how much less similar this site is.
//
// Proportional on purpose. Checked by having the reranker score 30 tail
// sites per search in one batch with 10 sites it had already scored (so both
// are on the same scale), 600 tail sites over 20 searches: this estimate was
// off by 10.6 points on average. The model disagrees with *itself* by 9.0
// when it re-scores the same shortlisted sites, so that is about as close as
// an estimate can get. A steeper fall-off (similarity to the 5th power, the
// first version) was off by 21.6 and scored the tail 18 points too low.
//
// Estimates never reach the "strong match" band the UI colours green (60+):
// that band should mean a model read the site and agreed.
const TAIL_PCT_CAP = 59;

// Where the list stops: at TAIL_MIN_RATIO of the best match's similarity,
// or sooner if the estimate falls below TAIL_MIN_PCT first. Both from the
// same 600 graded sites, counting a site as on topic when the model scored
// it 40+ (the line the "only weak matches" notice already uses):
//
//   similarity ratio 0.80+      98% on topic
//   ratio 0.70-0.80             88-94%
//   ratio 0.65-0.70             85%
//   ratio 0.60-0.65             75%
//   ratio 0.55-0.60             49%
//
// Together the two limits kept 95% on-topic sites with 2% clear misses
// (scored under 25).
//
// The ratio does the work on an ordinary search, which matters for more than
// tidiness: it depends only on similarities, so the same search returns the
// same number of results every time. The estimate depends on the model's
// scores, which wobble between runs, and a cut-off resting on it made one
// search report 693 results on one run and 909 on the next. It is kept for
// the case the ratio cannot see — a narrow search ("methylene blue
// supplements") whose shortlist has already run out of real matches. There
// the model scores the shortlist's edge at 40, so the estimate ends the list
// almost at once, where the ratio alone would add sites that merely sit near
// the query. 50 and not lower: at 45 that search listed 16 more sites and the
// model called 10 of them clear misses; at 50 it lists one.
const TAIL_MIN_RATIO = 0.7;
const TAIL_MIN_PCT = 50;

// Top of the estimated scale when no model scored anything in this request
// (the rerank being unavailable). The top of the amber band, one short of the
// 60 the UI colours green, and it makes the cut-off above work out to 85% of
// the best similarity — stricter than a judged search gets, because there is
// no judgement to lean on.
const UNJUDGED_TOP_PCT = TAIL_PCT_CAP;

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}

// The similarity every cut-off is a fraction of: the best match's — but not
// the query's own. A catalogue domain typed in as the query is searched by
// its own stored vector (resolveQueryVector), so it comes back as its own
// nearest neighbour at similarity 1.0. Measured against that, "70% of the
// best match" stops being relative at all and becomes a flat 0.70, which
// very few sites reach: the same topic typed as words would list hundreds
// more. So a perfect self-match is stepped over.
const SELF_MATCH_SIMILARITY = 0.9999;
function topSimilarity(hits: { similarity: number }[]): number {
  for (const h of hits) if (h.similarity < SELF_MATCH_SIMILARITY) return h.similarity;
  // Empty, or nothing but the query's own row: unknown, not 1.0.
  return 0;
}

// What the model would probably score a site it has not read, from its
// similarity alone. Unrounded and uncapped: this is the estimate itself, used
// for the cut-off; what is displayed goes through estimateMatchPct or, for a
// whole tail, the rescaling in searchCatalogTail.
function rawEstimate(similarity: number, anchor: CatalogTailAnchor): number {
  return anchor.anchorSim > 0 ? (anchor.anchorPct * similarity) / anchor.anchorSim : 0;
}

// Displayed match % for a single unread site.
function estimateMatchPct(similarity: number, anchor: CatalogTailAnchor): number {
  return Math.max(1, Math.min(anchor.pctCap, Math.round(rawEstimate(similarity, anchor))));
}

// The similarity below which a site is no longer listed (see TAIL_MIN_RATIO).
function tailFloorSimilarity(anchor: CatalogTailAnchor): number {
  const byEstimate = anchor.anchorPct > 0 ? (anchor.anchorSim * TAIL_MIN_PCT) / anchor.anchorPct : Infinity;
  return Math.max(anchor.simTop * TAIL_MIN_RATIO, byEstimate);
}

// Cheapest live offer for the domain aliased `d`, in USD. One definition so
// the price a row is filtered on, sorted on and shown with cannot drift
// between the queries that need it. NULL means nothing is for sale.
function bestPriceUsdExpr(rates: Record<string, number>): SQL {
  return sql`(SELECT MIN(price) FROM (
             SELECT ${usdCaseExpr(sql`mo.min_price::float`, sql`mo.currency`, rates)} AS price FROM marketplace_offers mo WHERE mo.domain_id = d.id AND mo.available = true AND mo.min_price::float > 0
             UNION ALL
             SELECT ${usdCaseExpr(sql`so.min_price::float`, sql`so.currency`, rates)} AS price FROM supplier_offers so WHERE so.domain_id = d.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0
           ) prices)`;
}

// Prefers a stored vector when the query is a catalog domain (free, and
// built from that site's real content), otherwise embeds the query text.
async function resolveQueryVector(query: string): Promise<number[] | null> {
  return (await embeddingForDomain(query)) ?? (await embedQuery(query));
}

// The filters that can be tested on a plain `domains` column, as SQL clauses
// against the alias `d`. Built in one place because three queries must agree
// on them exactly: the candidate CTEs in searchCatalog, the nearest-neighbour
// scan that feeds them, and the deep list in searchCatalogTail. Price and
// grade are not here — both are computed from joins and are applied to rows
// after they are fetched.
export function candidateFilterClauses(f: CatalogSearchFilters) {
  const categories = normalizeFilterList(f.categories, f.category);

  // TLD filter — applied here, inside text_matched (before the `matched`
  // CTE's candidatePoolLimit LIMIT), not as an outer post-aggregation
  // filter. The `matched` CTE below has no ORDER BY before its LIMIT, so
  // whatever gets past text_matched is an arbitrary plan-dependent subset —
  // filtering by TLD *after* that LIMIT would silently starve the result
  // set for any TLD that happened not to survive the cut, even when plenty
  // of matching domains exist in the full (pre-LIMIT) candidate set.
  // ILIKE + a literal ".tld" suffix, not a bare substring match — LIKE
  // '%.com' can only match a string that actually ENDS in ".com"
  // ("example.company" does not, since it ends in "pany"), same anchoring
  // principle as the word-boundary regex above.
  // DR, traffic and category are filtered inside the candidate CTEs for the
  // same reason as country and TLD: the pool carries a LIMIT with no ORDER
  // BY, so a filter applied afterwards runs against an arbitrary slice and
  // silently returns fewer rows than match. Country was the visible case (0
  // results where 30 existed); these degrade less obviously but identically.
  //
  // Price and grade cannot move here — both are computed during aggregation
  // from the offer joins, so they have no column to test at this stage and
  // stay as outer filters.
  const poolFilterClauses = [
    f.minDr != null ? sql`AND COALESCE(d.domain_rating, 0) >= ${f.minDr}` : sql``,
    f.maxDr != null ? sql`AND COALESCE(d.domain_rating, 0) <= ${f.maxDr}` : sql``,
    f.minTraffic != null ? sql`AND COALESCE(d.org_traffic, 0) >= ${f.minTraffic}` : sql``,
    f.maxTraffic != null ? sql`AND COALESCE(d.org_traffic, 0) <= ${f.maxTraffic}` : sql``,
  ];
  const poolFilters = sql.join(poolFilterClauses, sql` `);

  // Country is filtered here, inside the candidate CTEs, for the same reason
  // the TLD filter is (see below): the pool carries a LIMIT with no ORDER BY,
  // so anything filtered *after* it is filtered against an arbitrary,
  // plan-dependent slice. Applied as an outer filter, "supplements" + US
  // returned zero results while the unfiltered search returned thirty —
  // there were plenty of US domains, just none that happened to survive the
  // cut. Filtering early builds the pool from that country instead.
  const countryRules = [...new Set(normalizeFilterList(f.countries, f.country))]
    .map((c) => countryMatchRules(c))
    .filter((r): r is NonNullable<typeof r> => r != null);
  // Backslashes doubled on purpose. A tagged template hands the tag the
  // *cooked* string, so a single-backslash '\(the\)|\ythe\y' reached Postgres
  // as '(the)|ythey' — a pattern that deletes every "the" inside a word.
  // "netherlands" became "ne rlands" and matched nothing: the Netherlands
  // filter returned zero sites, always (as did anything else with "the" in
  // its name, e.g. the "northern ireland" alias). The intent, and what
  // normalize() in country-normalize.ts does on the JS side, is to drop only
  // a standalone "the" / "(the)". The outermost replace collapses the runs
  // of spaces the first two leave behind ("saint vincent and   grenadines"),
  // as normalize() does; without it such names never matched their own prefix.
  const normCountry = sql`btrim(regexp_replace(regexp_replace(regexp_replace(lower(d.country_main_traffic), '\\(the\\)|\\ythe\\y', ' ', 'g'), '[^a-z ]+', ' ', 'g'), ' +', ' ', 'g'))`;
  // Whole words only (countryValueMatches is the JS twin): "uk" must match
  // "uk" and "uk something", never "ukraine". Prefixes are letters and
  // spaces only, so they carry no LIKE wildcards.
  const startsWithWords = (p: string) => sql`(${normCountry} = ${p} OR ${normCountry} LIKE ${p + " %"})`;
  const countryClause = countryRules.length
    ? sql`AND (${sql.join(
        countryRules.map(
          (r) => sql`(${sql.join(r.prefixes.map(startsWithWords), sql` OR `)})${
            r.excludes.length ? sql` AND NOT (${sql.join(r.excludes.map(startsWithWords), sql` OR `)})` : sql``
          }`,
        ),
        sql` OR `,
      )})`
    : sql``;

  // Niche/category, like country and TLD, must be applied inside the
  // candidate CTEs rather than after the pool LIMIT — see the comment above.
  // Multiple selections are OR'd: a domain carries one category string, so
  // AND-ing them would always return nothing.
  const categoryClause = categories.length
    ? sql`AND (${sql.join(
        categories.map((c) => sql`LOWER(d.category) LIKE LOWER(${"%" + c + "%"})`),
        sql` OR `,
      )})`
    : sql``;

  const tlds = (f.tlds ?? []).map((t) => t.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
  const tldClauses = tlds.map((t) => sql`d.domain ILIKE ${"%." + t}`);
  const tldClause = tldClauses.length
    ? sql`AND (${sql.join(tldClauses, sql` OR `)})`
    : sql``;

  // Language, narrowed in SQL for the same reason as country: applied only
  // to the candidates already cut, "German" kept whichever of the nearest
  // 150 sites happened to be German. The raw column is messy free text, so
  // this selects exactly the spellings normalizeLanguage maps to the wanted
  // code (languageMatchValues is its inverse) and the JS check further down
  // remains the authority on what counts as a match.
  const languageValues = f.language ? languageMatchValues(f.language) : [];
  const languageClause = languageValues.length
    // Trimmed with a whitespace class rather than btrim(): btrim() strips
    // spaces only, while normalizeLanguage trims tabs and line ends too, and
    // a value the JS check accepts must not be dropped here first.
    ? sql`AND lower(regexp_replace(split_part(d.language_written_in_website, ',', 1), '^[[:space:]]+|[[:space:]]+$', '', 'g')) IN (${sql.join(languageValues.map((v) => sql`${v}`), sql`, `)})`
    : sql``;

  // Everything the vector queries can test. These are the same clauses the
  // candidate CTEs apply, pushed one level further down: into the
  // nearest-neighbour scan itself. Applied only in the CTEs, they ran against
  // the nearest 150 sites *of the whole catalogue* — so "sport" limited to
  // the US kept the 22 of those 150 that happened to be American and reported
  // that as the answer, while over a thousand US sport sites sat one filter
  // away.
  const vectorFilter = sql.join([tldClause, countryClause, languageClause, categoryClause, poolFilters], sql` `);
  // Whether any of them is actually set. An unfiltered vector read is a
  // different (much cheaper) thing from a filtered one, and callers choose
  // between them on this.
  const hasFilters = countryRules.length > 0 || categories.length > 0 || tlds.length > 0 || languageValues.length > 0
    || f.minDr != null || f.maxDr != null || f.minTraffic != null || f.maxTraffic != null;

  return { tldClause, countryClause, languageClause, categoryClause, poolFilters, vectorFilter, hasFilters };
}

/**
 * Runs the marketplace catalog semantic search: SQL ILIKE/category prefilter
 * (recall) -> word-overlap shortlist -> Claude rerank (precision) -> real
 * pricing joins. Shared by the authenticated /api/related-sites route and
 * the public /api/homepage-search route.
 */
export async function searchCatalog(opts: CatalogSearchOptions): Promise<CatalogSearchOutput> {
  const __t0 = Date.now();
  const cacheKey = searchCacheKey(opts);
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) return cached.result;

  const query = opts.query.trim();
  const f = opts.filters ?? {};
  const claudeShortlistSize = opts.claudeShortlistSize ?? DEFAULT_CLAUDE_SHORTLIST_SIZE;
  const finalResultSize = opts.finalResultSize ?? DEFAULT_FINAL_RESULT_SIZE;
  const candidatePoolLimit = opts.candidatePoolLimit ?? DEFAULT_CANDIDATE_POOL_LIMIT;
  const sortBy: CatalogSortBy = opts.sortBy ?? "match";
  const sortDir: CatalogSortDir = opts.sortDir ?? "desc";

  // Needed before the main query is built — best_price (used for SQL-level
  // min/max price filtering below, and for the sortBy:"price" column sort)
  // is computed in that query, and must already be USD-converted there. See
  // usdCaseExpr's comment above for why this can't just be a JS-side toUsd()
  // call the way /api/analyze does it.
  // Vector retrieval runs concurrently with the FX rates fetch — they are
  // independent, and the embedding call is the one piece of new latency on
  // this path (~100-300ms), so it should overlap with work already happening.
  // Both degrade to the previous behavior on failure: no rates is already
  // handled below, and no vector simply means keyword-only retrieval.
  const [rates, queryVector] = await Promise.all([
    getUsdRates(),
sortBy === "match" && process.env.SEARCH_RETRIEVAL_MODE !== "keyword"
      ? resolveQueryVector(query)
      : Promise.resolve(null),
  ]);
  const __tRates = Date.now();

  // Outer filters apply to the *aggregated* result (after GROUP BY), since
  // that's the layer that actually has country/lang/dr/traffic/best_price
  // as plain column aliases to filter on.
  // Note: `language` is deliberately NOT filtered here in SQL. The raw
  // `lang` column is messy scraped free text ("Spanish", "Español", "es",
  // "Spain", ...) with no consistent format, so a SQL string-equality
  // comparison against the filter's ISO code would silently match almost
  // nothing (see normalizeLanguage in lib/search/language-normalize.ts for
  // the full story). It's applied in JS against matchedRows below instead,
  // after normalizing both sides to the same ISO 639-1 code.
  // Selected niches, folded from the multi-select list + the legacy single
  // field. Used both here and in the candidate CTEs below.
  const categories = normalizeFilterList(f.categories, f.category);

  const outerFilterClauses = [
    f.minTraffic != null ? sql`AND COALESCE(traffic, 0) >= ${f.minTraffic}` : sql``,
    f.maxTraffic != null ? sql`AND COALESCE(traffic, 0) <= ${f.maxTraffic}` : sql``,
    f.minDr != null ? sql`AND COALESCE(dr, 0) >= ${f.minDr}` : sql``,
    f.maxDr != null ? sql`AND COALESCE(dr, 0) <= ${f.maxDr}` : sql``,
    f.minPrice != null ? sql`AND best_price >= ${f.minPrice}` : sql``,
    f.maxPrice != null ? sql`AND best_price <= ${f.maxPrice}` : sql``,
    categories.length
      ? sql`AND (${sql.join(categories.map((c) => sql`LOWER(raw_category) LIKE LOWER(${"%" + c + "%"})`), sql` OR `)})`
      : sql``,
    f.grade && GRADE_RANK[f.grade] != null
      ? sql`AND (CASE COALESCE(ai_grade, CASE WHEN COALESCE(dr, 0) >= 70 THEN 'A+' WHEN COALESCE(dr, 0) >= 55 THEN 'A' WHEN COALESCE(dr, 0) >= 40 THEN 'B+' ELSE 'B' END)
            WHEN 'A+' THEN 4 WHEN 'A' THEN 3 WHEN 'B+' THEN 2 ELSE 1 END) >= ${GRADE_RANK[f.grade]}`
      : sql``,
  ];

  // Split into words and pre-filter on the *narrow* text columns (category,
  // domain name, plus the AI-labeled semantic category/summary) with a
  // word-boundary match before touching pricing/metrics joins or doing any
  // aggregation. This bounds the candidate set up front (recall), while
  // final ranking quality (precision) comes from the Claude rerank pass
  // below over the shortlist.
  //
  // Word-boundary (\y...\y), not a bare ILIKE '%word%' substring match: a
  // plain substring search for "linen" matched "onLINEnomad.nl",
  // "headLINEnation.co.uk" and "onLINEnachrichtheute.de" — none remotely
  // about linen, all just containing "line" immediately followed by a word
  // starting with "n". "line" alone is one of the most common substrings in
  // web/tech domains and category text ("online", "headline", "deadline",
  // "timeline", ...), so this wasn't a rare edge case — it was a systematic
  // false-positive source feeding junk straight into the Claude shortlist,
  // displacing genuinely-relevant candidates that could have taken those
  // slots instead. \y matches PostgreSQL's regex word-boundary (word chars
  // are [A-Za-z0-9_], so punctuation like the dots/hyphens in a domain name
  // still count as boundaries — "linen-shop.com" or "shop.linencompany.com"
  // still match cleanly).
  // Generic terms like "website"/"niche" show up in nearly every domain's
  // category/summary text, so on their own (via the word-boundary OR clause
  // below) they can admit huge swaths of unrelated domains into the prefilter
  // — e.g. "linen websites" only needed to match the word "websites" to pull
  // in domains with nothing to do with linen. Stripping terms too generic to
  // mean anything on their own keeps the OR clause meaningful without
  // requiring every word to match (which would tank recall on legitimate
  // multi-word queries).
  const SEARCH_STOPWORDS = new Set([
    "website", "websites", "site", "sites", "niche", "niches",
    "blog", "blogs", "domain", "domains", "page", "pages",
    "backlink", "backlinks", "link", "links",
  ]);
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !SEARCH_STOPWORDS.has(w))
    .slice(0, 6);
  const wordBoundaryPattern = (w: string) => `\\y${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\y`;
  const wordClauses = words.map((w) => {
    const pattern = wordBoundaryPattern(w);
    // Deliberately NOT matching against d.semantic_summary here. It is a
    // 700-900 char page description on 282K rows with no text index, so a
    // regex over it forces a sequential scan and measured 14.8s on a search
    // that is otherwise ~1s. The short category labels are cheap by
    // comparison, and the *meaning* carried by those long summaries is
    // already retrieved far better by the vector branch — which is built
    // from exactly that text. The summaries are still SELECTed below and
    // still reach the Claude rerank; they just don't drive the prefilter.
    // Domain name only, matched by indexed prefix rather than regex.
    //
    // The niche/category columns were dropped from this clause: matching a
    // word *inside* a short label ("health" in "Health - Well-being") cannot
    // use an index, so every search read all 607K rows — measured at 4-19s,
    // and the single largest cost in the request. Meaning is now retrieved by
    // the vector branch, which does that job far better than a one-or-two-
    // word label ever could; over 42,000 domains are labelled "General" or
    // "Generalist" and matched nothing useful anyway.
    //
    // What this clause still exists for is the case embeddings are weak at:
    // someone typing a site's name. LIKE 'word%' can use the existing unique
    // index on domains.domain, so it is a lookup instead of a scan. It only
    // matches from the start of the domain, which is the shape a name query
    // takes ("moneycontrol" -> moneycontrol.com).
    //
    // Domains without a description are reachable only by name until they
    // get one; that is the accepted trade for the latency, and it reverses
    // itself as the backfill runs.
    return sql`(d.domain LIKE ${w + "%"} OR d.domain LIKE ${"www." + w + "%"})`;
  });
  const { tldClause, countryClause, languageClause, categoryClause, poolFilters, vectorFilter, hasFilters } = candidateFilterClauses(f);

  // Started before the candidates are cut rather than alongside the main
  // query only so the two do not wait on each other.
  const exclusionPromise = opts.hideLinked && opts.ownSite?.trim()
    ? getExcludedDomains(opts.ownSite.trim())
    : Promise.resolve({ excluded: new Set<string>(), degraded: false });
  // It is awaited further down, after the vector read. A rejection arriving
  // before then would otherwise count as unhandled; this claims it without
  // swallowing it — the Promise.all below still rejects with the same error.
  exclusionPromise.catch(() => {});

  // Price, grade and "hide sites that already link to me" cannot run inside
  // the vector scan: the first two are computed from joins, the third is a
  // set of thousands of domains held in JS. They still cut the candidates
  // after the nearest-neighbour limit, so with one of them on the limit is
  // tripled — the nearest 150 sites under $50 are not the under-$50 sites
  // among the nearest 150, and asking for 450 leaves room for the filter to
  // take its share and still fill the shortlist.
  const hasPostFilters = f.minPrice != null || f.maxPrice != null
    || (!!f.grade && GRADE_RANK[f.grade] != null)
    || !!(opts.hideLinked && opts.ownSite?.trim());
  const vectorLimit = hasPostFilters ? VECTOR_CANDIDATE_LIMIT * 3 : VECTOR_CANDIDATE_LIMIT;

  // Only fetched for sortBy "match": a plain-column sort (DR, price, ...)
  // skips the Claude rerank entirely and orders by a SQL column, so paying
  // for an embedding there would buy nothing.
  //
  // With filters on, the read is hedged (headVectorCandidates): the filtered
  // neighbours when they arrive in time, the unfiltered ones when they do
  // not. `headFiltered` records which it was. The candidate CTEs below apply
  // the filters either way, so unfiltered hits are only ever a shorter
  // shortlist — what this search returned before filters moved into the
  // scan — never a wrong one.
  let vectorHits: VectorCandidate[] = [];
  let headFiltered = true;
  if (queryVector) {
    if (hasFilters) {
      const head = await headVectorCandidates(queryVector, vectorLimit, vectorFilter);
      vectorHits = head.hits;
      headFiltered = head.filtered;
    } else {
      vectorHits = await vectorCandidates(queryVector, vectorLimit);
    }
  }
  const vectorSimById = new Map(vectorHits.map((v) => [v.id, v.similarity]));
  const __tVector = Date.now();

  // We asked for neighbours and got none. Unfiltered, that is never a real
  // answer: the query returns `limit` rows or it failed (timeout, connection
  // reset — vectorCandidates swallows both and returns []). The search still
  // completes on the keyword branch, which is the intended degradation, but
  // the result is materially worse and must not be written to the cache
  // below: observed live, one failed vector read pinned "SaaS website about
  // VPN" to vpn-test.no (DR 6, 1 monthly visit) for the full 3-minute TTL,
  // served to every visitor who searched it, long after the connection had
  // recovered. Serving one degraded answer is the cost of a blip; serving it
  // for three minutes is a bug. With filters an empty list can also be the
  // truth (nothing in that country), and the two cannot be told apart here;
  // not caching a genuinely empty answer only costs a repeat lookup.
  const vectorDegraded = queryVector !== null && vectorHits.length === 0;

  // The vector branch is OR'd into the same prefilter rather than run as a
  // separate query: a domain qualifies if it matches the query's *words* or
  // its *meaning*. This is the hybrid part, and both halves are needed —
  // embeddings are weak on exact tokens (brand names, a specific TLD, a
  // domain typed in verbatim), which is precisely where the word match is
  // strong, and vice versa.
  const vectorIdClause = vectorHits.length
    ? sql`d.id IN (${sql.join(vectorHits.map((v) => sql`${v.id}`), sql`, `)})`
    : null;

  // How many name matches the keyword arm reads. Only `candidatePoolLimit`
  // of them survive the cut further down, so reading the full
  // KEYWORD_SCAN_LIMIT for the default pool of 400 was nine rows fetched —
  // and offer-checked — for every one kept. On a common word that is the
  // slowest part of a cold search: "sport" spent 12.7 of its 20.6 seconds in
  // this query, "houseplant care guide" 24 of 32. Half as many again as the
  // pool covers the names that turn out to have nothing for sale (about one
  // in six); a caller that asks for a bigger pool still gets the full scan.
  const keywordScanLimit = Math.min(KEYWORD_SCAN_LIMIT, Math.ceil(candidatePoolLimit * 1.5));

  // Main catalog query and the (optional) "already links to me" exclusion
  // lookup are independent — run them concurrently rather than serially.
  const [rows, exclusionResult] = await Promise.all([
    db.execute(sql`
      WITH keyword_matched AS MATERIALIZED (
        SELECT d.id, d.domain AS w, d.category, d.country_main_traffic AS country,
               d.language_written_in_website AS language,
               d.domain_rating, d.domain_rating_updated_at, d.org_traffic, d.org_keywords, d.ref_domains,
               -- domains.semantic_summary covers ~265K sellable domains with
               -- full page-content descriptions; lp_domain_ai_metrics covers
               -- ~51K. Preferring the former (falling back to the latter)
               -- widens the text the keyword prefilter and the Claude rerank
               -- can both see by roughly 5x, independently of embeddings.
               false AS is_vector,
               COALESCE(d.semantic_category, ai."semanticCategory") AS semantic_category,
               COALESCE(d.semantic_summary, ai."semanticSummary") AS semantic_summary,
               ai."valueGrade" AS ai_grade, ai."valueScore" AS ai_score
        FROM domains d
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.domain
        WHERE 1 = 1
          ${wordClauses.length ? sql`AND (${sql.join(wordClauses, sql` OR `)})` : sql`AND false`}
          ${tldClause}
          ${countryClause}
          ${languageClause}
          ${categoryClause}
          ${poolFilters}
        -- Bound the keyword scan. The word-boundary regex has no index, so a
        -- broad query ("football news") matches tens of thousands of rows and
        -- each one then pays two EXISTS offer-checks — measured between 7s and
        -- 48s of SQL for the same query, and the slow end blows the
        -- serverless timeout. Vector hits are already capped at
        -- VECTOR_CANDIDATE_LIMIT and are OR'd in by primary key, so they are
        -- unaffected by this cap; it only stops the keyword arm from
        -- scanning the whole catalogue on generic words.
        LIMIT ${keywordScanLimit}
      ),
      -- The vector arm is a separate CTE, deliberately outside the keyword
      -- LIMIT above. Applying one cap to the combined set silently dropped
      -- the vector hits: with no ORDER BY, Postgres returns an arbitrary
      -- 4000 rows, and on a broad query the keyword matches crowd out the
      -- ~150 semantic ones. Measured, serfel.fr ranked #1 by cosine distance
      -- and never appeared in the results at all. Vector rows are already
      -- bounded by VECTOR_CANDIDATE_LIMIT and are selected by primary key,
      -- so they need no cap of their own.
      vector_matched AS MATERIALIZED (
        SELECT d.id, d.domain AS w, d.category, d.country_main_traffic AS country,
               d.language_written_in_website AS language,
               d.domain_rating, d.domain_rating_updated_at, d.org_traffic, d.org_keywords, d.ref_domains,
               true AS is_vector,
               COALESCE(d.semantic_category, ai."semanticCategory") AS semantic_category,
               COALESCE(d.semantic_summary, ai."semanticSummary") AS semantic_summary,
               ai."valueGrade" AS ai_grade, ai."valueScore" AS ai_score
        FROM domains d
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.domain
        WHERE ${vectorIdClause ?? sql`false`}
          ${tldClause}
          ${countryClause}
          ${languageClause}
          ${categoryClause}
          ${poolFilters}
      ),
      text_matched AS (
        SELECT * FROM keyword_matched
        UNION
        SELECT * FROM vector_matched
      ),
      sellable AS (
        SELECT t.* FROM text_matched t
        WHERE EXISTS (
          SELECT 1 FROM marketplace_offers mo WHERE mo.domain_id = t.id AND mo.available = true AND mo.min_price::float > 0
          UNION ALL
          SELECT 1 FROM supplier_offers so WHERE so.domain_id = t.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0
        )
      ),
      -- Two independently-bounded arms rather than one ORDER BY + LIMIT.
      -- Vector hits must survive the candidate cap — on a broad query the
      -- thousands of keyword rows would otherwise displace them wholesale
      -- and the semantic branch would contribute nothing. But expressing
      -- that as ORDER BY is_vector DESC + LIMIT made Postgres materialise
      -- and sort *every* matching row before taking n: measured 57s of SQL
      -- on "football news", enough to blow the serverless timeout. Giving
      -- each arm its own LIMIT keeps the guarantee and lets both stop early.
      matched AS (
        (SELECT * FROM sellable WHERE is_vector LIMIT ${vectorLimit})
        UNION
        (SELECT * FROM sellable WHERE NOT is_vector LIMIT ${candidatePoolLimit})
      ),
      aggregated AS (
        SELECT
          d.id AS id,
          bool_or(d.is_vector) AS is_vector,
          LOWER(d.w) AS domain,
          MAX(d.category) AS raw_category,
          MAX(d.country) AS country,
          MAX(d.language) AS lang,
          MAX(d.domain_rating)::float AS dr,
          MAX(d.domain_rating_updated_at) AS dr_updated_at,
          MAX(d.org_traffic) AS traffic,
          MAX(d.org_keywords) AS keywords,
          MAX(d.ref_domains) AS ref_domains,
          ${bestPriceUsdExpr(rates)} AS best_price,
          MAX(d.semantic_category) AS semantic_category,
          MAX(d.semantic_summary) AS semantic_summary,
          MAX(d.ai_grade) AS ai_grade,
          MAX(d.ai_score::float) AS ai_score
        FROM matched d
        GROUP BY d.id, d.w
      )
      SELECT * FROM aggregated
      WHERE 1 = 1
        ${sql.join(outerFilterClauses, sql` `)}
    `),
    exclusionPromise,
  ]);
  const degradedAhrefs = exclusionResult.degraded;
  const __tSql = Date.now();

  // Filtering in JS against a Set (not a SQL NOT IN) is deliberate: the
  // candidate pool is already bounded to <=400 rows above, so this is
  // cheap and avoids building a huge SQL NOT IN(...) list from what could
  // be 1000s of referring domains.
  // normalizeDomain (not just .toLowerCase()) so a www.-prefixed host from
  // Ahrefs still matches the catalog's bare-domain rows, or vice versa —
  // see the comment on normalizeDomain in referring-domains-cache.ts.
  let matchedRows = exclusionResult.excluded.size
    ? rows.rows.filter((r) => !exclusionResult.excluded.has(normalizeDomain(r.domain as string)))
    : rows.rows;

  // Language filter, applied here (not in SQL) against the normalized code —
  // see the comment on outerFilterClauses above for why.
  if (f.language) {
    const wanted = f.language.toLowerCase();
    matchedRows = matchedRows.filter((r) => normalizeLanguage(r.lang as string | null) === wanted);
  }

  if (matchedRows.length === 0) {
    // Nothing for the first page. If that is because the head read fell back
    // to unfiltered neighbours and none of them passed the filters, it says
    // nothing about what the filters would find — a narrow filter on a cold
    // search lands here every time. The deep read is filtered and has the
    // time the first page did not, so hand back a handle to it (with no
    // similarity in it: searchCatalogTail then anchors on its own list)
    // instead of reporting "no results" for sites that exist.
    if (opts.deep && sortBy === "match" && queryVector && !headFiltered) {
      return {
        results: [], lowRelevance: false, degradedAhrefs, total: 0,
        tail: { simTop: 0, anchorSim: 0, anchorPct: UNJUDGED_TOP_PCT, pctCap: UNJUDGED_TOP_PCT },
      };
    }
    return { results: [], lowRelevance: false, degradedAhrefs, total: 0 };
  }

  // Word-boundary, matching the SQL prefilter above (and for the same
  // reason: hay.includes(w) would count "linen" as present in "onlinenomad"
  // via the exact same false-positive this whole file's fix is about — a
  // domain that only cleared the SQL stage by matching a *different* query
  // word would otherwise still get incorrectly boosted here for "matching"
  // this one too).
  const wordBoundaryRe = new Map(words.map((w) => [w, new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")]));

  // Simple relevance score: how many query words appear in this domain's
  // category or name. Used to cut a shortlist for the Claude rerank pass
  // below, and as the fallback ranking if that call fails or is skipped.
  function relevance(domain: string, category: string): number {
    const hay = `${category} ${domain}`;
    return words.filter((w) => wordBoundaryRe.get(w)!.test(hay)).length;
  }

  // Shortlist ordering has to see both retrieval branches or the vector half
  // is wasted: a domain found purely by meaning matches zero query words, so
  // on word-overlap alone it sorts to the bottom and never reaches the
  // Claude rerank.
  //
  // Reciprocal rank fusion rather than adding the two scores together. The
  // naive sum (wordCount + cosine) is broken by scale: word count runs 0-N
  // with N the query length while cosine is bounded at 1.0, so on a 5-word
  // query any domain matching two words outranked a near-perfect semantic
  // match. Measured case: "french television listings and streaming guides"
  // ranked programme-tv.net #3 by pure vector distance, yet keyword matches
  // pushed it out of the top 40 entirely.
  //
  // RRF compares *positions* instead of scores, so the two branches combine
  // without either's units dominating. K softens the top: with K=60 the gap
  // between rank 1 and 2 is small relative to the gap between rank 1 and 50,
  // which keeps a single branch from monopolizing the shortlist.
  const RRF_K = 60;
  // Relative pull of each retrieval branch inside the fusion. Vector is
  // weighted above keyword because meaning-matching is the stronger signal
  // on the natural-language queries this search actually receives; keyword
  // is kept in the mix rather than switched off because embeddings are
  // measurably weak on exact tokens — a brand name, a specific TLD, or a
  // domain typed in verbatim — where a literal match is the correct answer
  // and semantic similarity is not.
  //
  // Override with SEARCH_RETRIEVAL_MODE for A/B measurement:
  //   "vector"  vector only    "keyword" keyword only    (default: hybrid)
  const mode = process.env.SEARCH_RETRIEVAL_MODE ?? "hybrid";
  const KEYWORD_WEIGHT = mode === "vector" ? 0 : 0.6;
  const VECTOR_WEIGHT = mode === "keyword" ? 0 : 1;
  const keywordRank = new Map<string, number>();
  [...matchedRows]
    .map((r) => ({ id: String(r.id), rel: relevance(r.domain as string, (r.raw_category as string) ?? "") }))
    .filter((e) => e.rel > 0)
    .sort((a, b) => b.rel - a.rel)
    .forEach((e, i) => keywordRank.set(e.id, i + 1));
  const vectorRank = new Map(vectorHits.map((v, i) => [v.id, i + 1]));

  // An exact hit on the *domain name* is a different, much stronger signal
  // than a hit anywhere in the descriptive text, and neither retrieval
  // branch expresses it: "moneycontrol" is one keyword match among many by
  // rank, and semantically it is just another finance site, so 150 plausible
  // finance vectors bury the site the user actually named. Measured, it sat
  // at #91 on pure RRF and never made the results.
  //
  // The bonus is scaled by how much of the query the domain name accounts
  // for, so a single-word lookup ("moneycontrol") wins outright while an
  // incidental match inside a longer descriptive query ("television" in
  // programme-television.org) is only a light nudge. 0.05 sits an order of
  // magnitude above any achievable RRF score (~0.026 for rank 1 in both
  // branches), so a full domain-name match reliably takes the top.
  // Fires only when the domain name accounts for *every* query word — the
  // "the user named this site" case. Scaling it by a partial fraction was
  // measurably worse: on "receitas caseiras brasileiras para o jantar" every
  // domain containing "receitas" collected a bonus larger than any RRF
  // score, pushing recipe-named domains above the genuinely best semantic
  // match (tudogostoso.com.br fell from #2 to #18). Partial name overlap is
  // already represented in the keyword branch and does not need a second,
  // stronger voice.
  const DOMAIN_MATCH_BONUS = 0.05;
  function domainNameBonus(domain: string): number {
    if (!words.length) return 0;
    const hit = words.filter((w) => wordBoundaryRe.get(w)!.test(domain)).length;
    return hit === words.length ? DOMAIN_MATCH_BONUS : 0;
  }

  function combinedRelevance(row: Record<string, unknown>): number {
    const id = String(row.id);
    const kw = keywordRank.get(id);
    const vec = vectorRank.get(id);
    return (kw ? KEYWORD_WEIGHT / (RRF_K + kw) : 0)
      + (vec ? VECTOR_WEIGHT / (RRF_K + vec) : 0)
      + domainNameBonus(row.domain as string);
  }

  // Seats on the shortlist reserved for the strongest vector hits, taken by
  // vector rank before the RRF cut runs.
  //
  // Without this the two branches compete for every seat, and the keyword
  // branch wins the middle of the list: a keyword hit at rank 20 scores
  // 0.6/(60+20) = 0.0075, which beats a vector hit at rank 75 on
  // 1/(60+75) = 0.0074. Measured consequence — thehackernews.com was
  // retrieved correctly at vector rank 75 with a description and an
  // embedding, and was still cut before the rerank ever saw it, on a search
  // for "enterprise cybersecurity". Widening the shortlist to 160 surfaced
  // 19 such domains across 8 queries, every one of them scored 90+ by the
  // model once it could actually see them.
  //
  // Membership is guaranteed here; ordering is still RRF below, so the
  // fallback path (rerank unavailable) keeps its existing behavior.
  //
  // A share rather than a fixed count, because callers size the shortlist
  // very differently — /api/related-sites asks for 160, the homepage chat
  // for 25 (app/api/homepage-search/route.ts). A fixed 100 would hand the
  // homepage's entire shortlist to the vector branch and leave the keyword
  // branch no seats at all, which is precisely the failure this is meant to
  // fix, only pointed the other way: a site typed in by name that is not
  // also a close semantic match would stop being findable.
  const VECTOR_SEAT_SHARE = 0.6;
  const VECTOR_GUARANTEED_SEATS = Math.round(claudeShortlistSize * VECTOR_SEAT_SHARE);

  const ranked = matchedRows.map((r) => ({ row: r, rel: combinedRelevance(r) }));
  const seated = new Set<string>();
  const shortlist: typeof ranked = [];

  if (VECTOR_WEIGHT > 0) {
    for (const e of ranked
      .filter((e) => vectorRank.has(String(e.row.id)))
      .sort((a, b) => vectorRank.get(String(a.row.id))! - vectorRank.get(String(b.row.id))!)
      .slice(0, Math.min(VECTOR_GUARANTEED_SEATS, claudeShortlistSize))) {
      shortlist.push(e);
      seated.add(String(e.row.id));
    }
  }
  for (const e of [...ranked].sort((a, b) => b.rel - a.rel)) {
    if (shortlist.length >= claudeShortlistSize) break;
    if (seated.has(String(e.row.id))) continue;
    shortlist.push(e);
    seated.add(String(e.row.id));
  }
  shortlist.sort((a, b) => b.rel - a.rel);

  let scored: { row: Record<string, unknown>; matchPct: number }[];
  let total: number;
  let offersPromise: Promise<Map<string, CatalogSearchOffer[]>> | null = null;
  // True only when matchPct below actually came from Claude's semantic
  // judgment, not the word-overlap fallback (Claude unavailable/timed
  // out/unparseable, or sortBy skipped it entirely) — see lowRelevance below.
  let usedClaudeScoring = false;

  if (sortBy !== "match") {
    // Plain-column sort: skip Claude entirely and order the *full* matched
    // candidate pool (not just the shortlist) directly by that SQL column.
    // matchPct is still computed (cheap word-overlap) purely for display —
    // it does not drive ordering in this mode.
    const extractor = SORT_EXTRACTORS[sortBy]!;
    const dir = sortDir === "asc" ? 1 : -1;
    // Relevance over the *full* matched pool, not just the claudeShortlist —
    // that shortlist is capped (default 80) for the Claude-rerank path, but
    // a plain-column sort can return up to `finalResultSize` (e.g. 500) rows
    // pulled from a much larger pool. Using the shortlist's relevance map
    // here meant any row outside the top 80 fell back to matchPct=0 even
    // when it genuinely matched the query.
    const relEntries = matchedRows.map((r) => ({ domain: r.domain as string, rel: relevance(r.domain as string, (r.raw_category as string) ?? "") }));
    const relByDomain = new Map(relEntries.map((e) => [e.domain, e.rel]));
    const maxRel = Math.max(1, ...relEntries.map((e) => e.rel));
    const sortedRows = [...matchedRows].sort((a, b) => {
      const av = extractor(a);
      const bv = extractor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
    total = sortedRows.length;
    scored = sortedRows.slice(0, finalResultSize).map((row) => ({
      row,
      matchPct: Math.round(((relByDomain.get(row.domain as string) ?? 0) / maxRel) * 100),
    }));
  } else {
    // Real semantic ranking over the shortlist. Falls back to the word-overlap
    // ranking above (unchanged behavior) if Claude is unavailable, times out,
    // or returns something unparseable — this call must never fail the search.
    // Provider switch. Defaults to OpenAI: Related Sites already runs on
    // OpenAI for retrieval (embeddings), so this makes the feature
    // single-vendor, and the org's data-sharing tier covers ordinary search
    // volume — whereas the Anthropic key has no credit, which meant every
    // live search was silently falling back to word-overlap ranking.
    // Set SEARCH_RERANK_PROVIDER=claude to switch back once it is funded.
    // SEARCH_RERANK_PROVIDER=none disables the LLM pass entirely and drops
    // through to the RRF fallback below. That is the A/B control for the
    // question "does the rerank earn its 5-6s over pure retrieval order?" —
    // same measurement hook as SEARCH_RETRIEVAL_MODE above.
    const rerank = process.env.SEARCH_RERANK_PROVIDER === "claude"
      ? rerankWithClaude
      : process.env.SEARCH_RERANK_PROVIDER === "none"
        ? async (): Promise<Map<string, number> | null> => null
        : rerankWithOpenAI;

    // Kick the offers lookup off *before* awaiting the rerank. The two are
    // independent (one is Postgres, one is OpenAI) and were previously
    // sequential, so the offers round trip — measured 1.2-2.0s — was pure
    // added latency waiting behind a call that takes seconds anyway.
    //
    // It has to cover the whole shortlist rather than the final 30, because
    // which 30 survive is exactly what the rerank is still deciding. That is
    // a wider query than before; it stays worth it only while it finishes
    // inside the rerank's own latency, which is what the timing log below
    // reports.
    offersPromise = fetchOffersForDomains(shortlist.map((s) => s.row.domain as string), rates);

    const claudeScores = await rerank(
      query,
      shortlist.map((s) => ({
        domain: s.row.domain as string,
        category: (s.row.raw_category as string) ?? "",
        semanticSummary: s.row.semantic_summary as string | null,
      }))
    );

    usedClaudeScoring = !!claudeScores;
    // A partially-failed rerank returns only the domains it actually scored
    // (see rerankWithOpenAI). Those are filtered out rather than defaulted to
    // 0: a zero is a claim the model judged the site irrelevant, which it
    // never did, and it would park unscored rows at the bottom of the list
    // displaying "0% match".
    scored = claudeScores
      ? shortlist
          .filter((s) => claudeScores.has(s.row.domain as string))
          .map((s) => ({
            row: s.row,
            matchPct: Math.round(Math.max(0, Math.min(100, claudeScores.get(s.row.domain as string)!))),
          }))
          .sort((a, b) => b.matchPct - a.matchPct)
      : (() => {
          const maxRel = Math.max(1, ...shortlist.map((s) => s.rel));
          return shortlist.map((s) => ({ row: s.row, matchPct: Math.round((s.rel / maxRel) * 100) }));
        })();
    // Deep mode keeps every scored row: they are the head of the ranking,
    // not a pool to take the best `finalResultSize` from.
    if (!opts.deep) scored = scored.slice(0, finalResultSize);
    total = claudeScores ? claudeScores.size : shortlist.length;
  }

  const __tRerank = Date.now();
  // Already in flight alongside the rerank on the "match" path; only the
  // plain-column sorts, which skip the rerank entirely and so have no
  // latency to hide behind, pay for it here.
  const offersMap = offersPromise
    ? await offersPromise
    : await fetchOffersForDomains(scored.map((s) => s.row.domain as string), rates);

  // ── Deep mode: hand over what the tail needs ───────────────────────────────
  // `scored` is the head of the full ranking: the shortlist, read and scored
  // by the model. Everything else that is related comes from
  // searchCatalogTail, which no model reads, so those rows need a match %
  // estimated from similarity. The anchor says where that estimate starts:
  // what the model made of the *least*-similar third of the sites it did
  // read — the edge of the shortlist, which is exactly where the tail begins.
  let tail: CatalogTailAnchor | undefined;
  // No tail without vector hits: there is then no similarity to anchor a
  // cut-off or an estimate on (the read failed, or a filter left it empty,
  // and the shortlist is name matches only).
  if (opts.deep && sortBy === "match" && queryVector && vectorHits.length > 0) {
    // The best similarity among sites that pass the filters. When the head
    // read was the unfiltered fallback, that is the best of the hits the
    // filters let through (if a passing site were closer than those, it
    // would have been among the hits too) — or unknown, 0, if none did, in
    // which case searchCatalogTail takes it from its own filtered read.
    const simTop = headFiltered
      ? topSimilarity(vectorHits)
      : topSimilarity(
          matchedRows
            .map((r) => ({ similarity: vectorSimById.get(String(r.id)) }))
            .filter((e): e is { similarity: number } => e.similarity != null)
            .sort((a, b) => b.similarity - a.similarity),
        );
    tail = { simTop, anchorSim: simTop, anchorPct: UNJUDGED_TOP_PCT, pctCap: UNJUDGED_TOP_PCT };
    if (usedClaudeScoring) {
      const judged = scored
        .map((s) => ({ sim: vectorSimById.get(String(s.row.id)), pct: s.matchPct }))
        .filter((e): e is { sim: number; pct: number } => e.sim != null)
        .sort((a, b) => a.sim - b.sim);
      if (judged.length >= 9) {
        const edge = judged.slice(0, Math.ceil(judged.length / 3));
        tail.anchorSim = median(edge.map((e) => e.sim));
        tail.anchorPct = median(edge.map((e) => e.pct));
      }
      tail.pctCap = TAIL_PCT_CAP;
    } else {
      // The rerank was unavailable, and its fallback above scores the head
      // on a different scale (a few percent at best) — which would sink the
      // whole shortlist beneath a tail estimated out of 90. Put the head on
      // the tail's scale instead: similarity when the vector branch found
      // the site, word overlap when only its name matched.
      const anchor = tail;
      scored = scored
        .map((s) => {
          const sim = vectorSimById.get(String(s.row.id));
          const wordPct = words.length
            ? Math.round((relevance(s.row.domain as string, (s.row.raw_category as string) ?? "") / words.length) * UNJUDGED_TOP_PCT)
            : 0;
          return { row: s.row, matchPct: Math.max(sim != null ? estimateMatchPct(sim, anchor) : 1, wordPct) };
        })
        .sort((a, b) => b.matchPct - a.matchPct);
    }

    // No tail to load when the candidates already reach below the relevance
    // floor and every one above it was scored: the deep list could only
    // return sites that are about to be discarded. Worth checking, because
    // that is the usual shape of a narrowly filtered search (one smaller
    // country, a high DR floor) and the read it saves is the slow one.
    const floor = tailFloorSimilarity(tail);
    const lastSim = vectorHits[vectorHits.length - 1]?.similarity ?? 0;
    const scoredIds = new Set(scored.map((s) => String(s.row.id)));
    // "Could be listed" means it survived the filters and has something for
    // sale — i.e. it is in matchedRows. A hit that is not would be dropped by
    // the tail too, so it must not keep the deep read alive.
    const listable = new Set(matchedRows.map((r) => String(r.id)));
    const unscoredAboveFloor = vectorHits.some((v) => v.similarity >= floor && listable.has(v.id) && !scoredIds.has(v.id));
    // Only when the hits were the filtered ones: unfiltered fallback hits say
    // nothing about how far the filtered list goes.
    if (headFiltered && lastSim < floor && !unscoredAboveFloor) tail = undefined;
  }

  const results: CatalogSearchResult[] = scored.map(({ row, matchPct }) =>
    toResult(row, matchPct, offersMap.get(row.domain as string) ?? []));

  const __tTotal = Date.now() - __t0;
  if (__tTotal > 3000) {
    console.log(
      `[searchCatalog] slow search "${query}": total ${__tTotal}ms ` +
        `(rates ${__tRates - __t0}ms, vector ${__tVector - __tRates}ms/${vectorHits.length} hits, ` +
        `sql ${__tSql - __tVector}ms/${rows.rows.length} rows, ` +
        `rerank ${__tRerank - __tSql}ms, offers ${__tTotal - (__tRerank - __t0)}ms)`
    );
  }

  // Low-relevance flag, distinct from zero results — signals "we found
  // rows, but even the best one is a weak match" so the UI can say so
  // instead of presenting a table of 2-5%-match results as if they were
  // normal ones. Prefers Claude's own semantic score when we have one: word
  // overlap alone can look fine (e.g. "linen websites" overlapping on the
  // generic word "websites", shared by huge swaths of unrelated categories)
  // while every actual semantic score comes back in single digits — word
  // overlap is only the fallback signal for when Claude wasn't invoked
  // (a plain column sort) or came back null.
  //
  // Deep mode does not use that fallback. `rel` stopped being a word count
  // when the shortlist moved to rank fusion (it is now a score near 0.02),
  // so `bestWordRel / words.length < 0.4` is true for every multi-word
  // query: re-sorting "sports betting" by DR replaced a full table with the
  // "only weak matches" notice. Without a model score there is no basis for
  // the claim, so it is not made.
  const bestWordRel = shortlist[0]?.rel ?? 0;
  const bestMatchPct = results.length > 0 ? Math.max(...results.map((r) => r.matchPct)) : 0;
  const lowRelevance = usedClaudeScoring
    ? bestMatchPct < 40
    : !opts.deep && words.length > 1 && bestWordRel / words.length < 0.4;

  const output: CatalogSearchOutput = { results, lowRelevance, degradedAhrefs, total, ...(tail ? { tail } : {}) };

  // Same for a head that fell back to unfiltered neighbours: the next run of
  // this search will most likely get the filtered ones, and should.
  if (!vectorDegraded && headFiltered) {
    if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey !== undefined) searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, { result: output, cachedAt: Date.now() });
  }

  return output;
}

// Deep lists are cached like searches are, and for the same reason: the read
// is the expensive part (seconds, cold) and nothing in it changes minute to
// minute. What is cached is the raw candidate list — the caller's anchor and
// already-shown ids are applied afterwards, so they do not split the key.
const tailCache = new Map<string, { rows: DeepCandidate[]; cachedAt: number }>();
// Reads in progress, by the same key, so a request for a list that is already
// being read waits for that read instead of starting a second identical one.
const tailInflight = new Map<string, Promise<DeepCandidate[] | null>>();

// Everything that changes which rows the deep read returns. Price bounds and
// the grade wanted are not in here — they are applied to the rows afterwards
// — only whether the read has to carry prices and grades at all.
function tailCacheKey(query: string, f: CatalogSearchFilters): string {
  return JSON.stringify([
    query.trim().toLowerCase(),
    normalizeFilterList(f.countries, f.country), f.language ?? null,
    f.minTraffic ?? null, f.maxTraffic ?? null, f.minDr ?? null, f.maxDr ?? null,
    normalizeFilterList(f.categories, f.category),
    (f.tlds && f.tlds.length ? [...f.tlds].map((t) => t.toLowerCase()).sort() : null),
    f.minPrice != null || f.maxPrice != null,
    !!f.grade && GRADE_RANK[f.grade] != null,
  ]);
}

/**
 * The raw deep list for a search, `limit` rows deep: cached, in progress, or
 * freshly read. Resolves to null when the list could not be read; never
 * rejects.
 *
 * This is deliberately NOT started early from searchCatalog, alongside the
 * first page. That was built and measured on searches nobody had run before.
 * The read is slow because the database is fetching index pages from
 * storage, the first page is slow for the same reason at the same moment,
 * and the two cold reads slowed each other down: a full read given a ~17s
 * head start still needed another 17-27s under a country filter, against
 * 17-22s started afterwards on its own. With the quick pass below, a head
 * start made no measurable difference either (count after 5.5s vs 3-6s
 * unfiltered, 4.7s vs 6.3s filtered; 8 searches per arm, inside the noise).
 * So it buys nothing and puts a second heavy query on the first page's path.
 * What did shorten the wait is asking for fewer rows first (TAIL_QUICK_LIMIT).
 */
function loadTailRows(query: string, f: CatalogSearchFilters, limit: number, knownVector?: number[]): Promise<DeepCandidate[] | null> {
  const fresh = (k: string) => {
    const hit = tailCache.get(k);
    return hit && Date.now() - hit.cachedAt < SEARCH_CACHE_TTL_MS ? hit.rows : null;
  };
  const base = tailCacheKey(query, f);
  const key = `${limit}:${base}`;
  // A quick pass that the full list already covers is answered from it —
  // checked before the quick pass's own cache entry. The full read is the
  // more exact of the two, and this keeps the quick list a strict prefix of
  // the full one whenever both are in hand.
  if (limit < DEEP_CANDIDATE_LIMIT) {
    const full = fresh(`${DEEP_CANDIDATE_LIMIT}:${base}`);
    if (full) return Promise.resolve(full.slice(0, limit));
  }
  const cached = fresh(key);
  if (cached) return Promise.resolve(cached);
  const running = tailInflight.get(key);
  if (running) return running;

  const needPrice = f.minPrice != null || f.maxPrice != null;
  const withGrade = !!f.grade && GRADE_RANK[f.grade] != null;
  const read = (async () => {
    const [queryVector, rates] = await Promise.all([
      knownVector ?? resolveQueryVector(query),
      needPrice ? getUsdRates() : Promise.resolve(null),
    ]);
    if (!queryVector) return null;
    const rows = await deepVectorCandidates(queryVector, limit, {
      filter: candidateFilterClauses(f).vectorFilter,
      bestPriceUsd: rates ? bestPriceUsdExpr(rates) : undefined,
      withGrade,
      maxScanTuples: limit < DEEP_CANDIDATE_LIMIT ? TAIL_QUICK_SCAN_TUPLES : undefined,
    });
    if (rows) {
      if (tailCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
        const oldestKey = tailCache.keys().next().value;
        if (oldestKey !== undefined) tailCache.delete(oldestKey);
      }
      tailCache.set(key, { rows, cachedAt: Date.now() });
    }
    return rows;
  })()
    .catch((err) => {
      console.error("[loadTailRows] failed:", err);
      return null;
    })
    .finally(() => {
      tailInflight.delete(key);
    });
  tailInflight.set(key, read);
  return read;
}

export interface CatalogTailOptions {
  query: string;
  filters?: CatalogSearchFilters;
  ownSite?: string;
  hideLinked?: boolean;
  // From the first page's `tail` (see CatalogSearchOutput).
  anchor: CatalogTailAnchor;
  // Sites the first page already returned — never repeated here.
  excludeIds?: string[];
  // The quick first pass: the nearest TAIL_QUICK_LIMIT sites only. Check
  // `partial` on the answer to know whether the full list is still needed.
  quick?: boolean;
}

/**
 * The rest of a deep search: every related site the first page did not
 * already return, nearest first, each with an estimated match %.
 *
 * No model call, and nothing joined beyond what filtering needs — a row here
 * is an id and four numbers. That is what keeps "show everything" affordable:
 * the reranker still reads only the shortlist, and offers are fetched for the
 * page being viewed (fetchResultRowsByIds), not for a thousand rows nobody
 * may scroll to.
 *
 * Returns null when the list could not be loaded; the caller keeps the first
 * page as the whole result in that case rather than reporting "no more".
 */
export async function searchCatalogTail(opts: CatalogTailOptions): Promise<CatalogTailOutput | null> {
  const query = opts.query.trim();
  if (!query) return { entries: [], capped: false, partial: false };
  const f = opts.filters ?? {};
  const ownSite = opts.hideLinked ? opts.ownSite?.trim() : undefined;
  const needPrice = f.minPrice != null || f.maxPrice != null;
  const wantedGradeRank = f.grade ? GRADE_RANK[f.grade] ?? null : null;
  const wantedLanguage = f.language ? f.language.toLowerCase() : null;

  const limit = opts.quick ? TAIL_QUICK_LIMIT : DEEP_CANDIDATE_LIMIT;
  // The exclusion list is read from cache only: the first page's search has
  // already fetched (and been metered for) it, and this follow-up must not
  // be a second, unmetered way to reach Ahrefs. If that read fails, so does
  // this call — answering with the sites un-hidden while the toggle says
  // they are hidden would be worse than answering late.
  const [rows, excluded] = await Promise.all([
    loadTailRows(query, f, limit),
    ownSite ? getCachedExcludedDomains(ownSite) : Promise.resolve(new Set<string>()),
  ]);
  if (!rows) return null;

  // The anchor comes back from the client, so it is clamped rather than
  // trusted. It only ever shapes a displayed percentage.
  const fin = (v: unknown, lo: number, hi: number, dflt: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
  const simTop = Math.max(topSimilarity(rows), fin(opts.anchor?.simTop, 0, 1, 0));
  // No usable similarity in the anchor (missing, or 0 because the first page
  // had no vector hit to take one from) means nothing was judged: fall back
  // to the unjudged scale, anchored on this list's own best match.
  const givenSim = fin(opts.anchor?.anchorSim, 0, 1, 0);
  const anchor: CatalogTailAnchor = givenSim > 0
    ? {
        simTop,
        anchorSim: givenSim,
        anchorPct: fin(opts.anchor?.anchorPct, 1, 100, UNJUDGED_TOP_PCT),
        pctCap: fin(opts.anchor?.pctCap, 1, 100, TAIL_PCT_CAP),
      }
    : { simTop, anchorSim: simTop, anchorPct: UNJUDGED_TOP_PCT, pctCap: TAIL_PCT_CAP };

  const floor = tailFloorSimilarity(anchor);
  const skip = new Set(opts.excludeIds ?? []);
  const kept: DeepCandidate[] = [];
  for (const r of rows) {
    // Sorted nearest-first, so the first row under the floor ends the list.
    if (r.similarity < floor) break;
    if (skip.has(r.id) || !r.sellable) continue;
    skip.add(r.id); // also de-duplicates: the grade join can return a domain twice
    if (needPrice) {
      if (r.bestPrice == null) continue;
      if (f.minPrice != null && r.bestPrice < f.minPrice) continue;
      if (f.maxPrice != null && r.bestPrice > f.maxPrice) continue;
    }
    if (wantedGradeRank != null) {
      // Same fallback as the SQL grade filter: the AI grade when there is
      // one, otherwise a grade derived from DR.
      const dr = r.dr ?? 0;
      const grade = r.aiGrade ?? (dr >= 70 ? "A+" : dr >= 55 ? "A" : dr >= 40 ? "B+" : "B");
      if ((GRADE_RANK[grade] ?? 1) < wantedGradeRank) continue;
    }
    if (wantedLanguage && normalizeLanguage(r.lang) !== wantedLanguage) continue;
    if (excluded.size && excluded.has(normalizeDomain(r.domain))) continue;
    kept.push(r);
  }

  // Displayed match %. Where the best tail site's estimate is over the cap,
  // the whole tail is scaled down so that site lands exactly on it, instead
  // of each estimate being clipped separately. Clipping was the first
  // version, and on an ordinary search — where the model scores the
  // shortlist's edge in the 60s — it left the first several hundred tail
  // sites all reading "59%", in an order nothing on screen explained. Scaled,
  // the percentage keeps falling as similarity does. It reads lower than the
  // estimate, which is the right direction to be wrong in for a site nobody
  // has checked.
  const top = kept.length ? rawEstimate(kept[0].similarity, anchor) : 0;
  const scale = top > anchor.pctCap ? anchor.pctCap / top : 1;
  const entries: CatalogTailEntry[] = kept.map((r) => ({
    id: r.id,
    matchPct: Math.max(1, Math.min(anchor.pctCap, Math.round(rawEstimate(r.similarity, anchor) * scale))),
    dr: r.dr ?? 0,
    traffic: r.traffic ?? 0,
    keywords: r.keywords ?? 0,
  }));

  // Did the read get as far as the floor? Rows come nearest-first, so it did
  // exactly when its last row is under it. If not, the list was cut short —
  // by its row limit, or (under a filter) by the scan budget that goes with
  // that limit — and related sites may remain beyond it.
  const reachedFloor = rows.length > 0 && rows[rows.length - 1].similarity < floor;
  if (opts.quick) {
    // Short of the floor, the quick pass cannot say the list is complete,
    // whatever stopped it; the full read can.
    return { entries, capped: !reachedFloor, partial: !reachedFloor };
  }
  // The full list is the last word. Short of the floor it is "capped" — more
  // may exist — when it filled its row limit, and also under a filter, where
  // stopping early can mean the scan budget ran out rather than the sites.
  // (Unfiltered, the read always fills its limit, so that case cannot arise.)
  const { hasFilters } = candidateFilterClauses(f);
  return { entries, capped: !reachedFloor && (rows.length >= DEEP_CANDIDATE_LIMIT || hasFilters), partial: false };
}
