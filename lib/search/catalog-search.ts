// Shared semantic search core for the marketplace catalog — extracted from
// app/api/related-sites/route.ts so the same SQL prefilter + Claude rerank +
// pricing-join pipeline can also back the public homepage AI chat
// (app/api/homepage-search/route.ts) without duplicating the Claude call or
// the offers joins.
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getExcludedDomains, normalizeDomain } from "@/lib/integrations/referring-domains-cache";
import { rerankWithClaude } from "@/lib/ai/claude-rerank";
import { rerankWithOpenAI } from "@/lib/ai/openai-rerank";
import { normalizeLanguage, languageDisplayLabel } from "@/lib/search/language-normalize";
import { countryMatchPrefixes } from "@/lib/search/country-normalize";
import { getUsdRates, toUsd } from "@/lib/currency";
import { embedQuery, embeddingForDomain } from "@/lib/search/query-embedding";
import { vectorCandidates } from "@/lib/search/vector-candidates";

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

function searchCacheKey(opts: CatalogSearchOptions): string {
  const f = opts.filters ?? {};
  return JSON.stringify([
    opts.query.trim().toLowerCase(),
    f.country ?? null, f.language ?? null, f.minTraffic ?? null, f.maxTraffic ?? null,
    f.minDr ?? null, f.maxDr ?? null, f.minPrice ?? null, f.maxPrice ?? null,
    f.category ?? null, f.grade ?? null,
    // Sorted so ["com","de"] and ["de","com"] (same filter, different UI
    // click order) hit the same cache entry instead of missing each other.
    (f.tlds && f.tlds.length ? [...f.tlds].map((t) => t.toLowerCase()).sort() : null),
    opts.ownSite?.trim().toLowerCase() ?? null, opts.hideLinked ?? false,
    opts.claudeShortlistSize ?? DEFAULT_CLAUDE_SHORTLIST_SIZE,
    opts.finalResultSize ?? DEFAULT_FINAL_RESULT_SIZE,
    opts.sortBy ?? "match", opts.sortDir ?? "desc",
    opts.candidatePoolLimit ?? DEFAULT_CANDIDATE_POOL_LIMIT,
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
  // Domain extension(s), no leading dot ("com", not ".com") — a domain
  // matches if it ends in ANY of these (OR, not AND — a domain only has one
  // TLD, so "must match every selected TLD" would always return nothing).
  tlds?: string[];
}

export interface CatalogSearchResult {
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
}

export interface CatalogSearchOutput {
  results: CatalogSearchResult[];
  lowRelevance: boolean;
  degradedAhrefs: boolean;
  total: number;
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

// Prefers a stored vector when the query is a catalog domain (free, and
// built from that site's real content), otherwise embeds the query text.
async function resolveQueryVector(query: string): Promise<number[] | null> {
  return (await embeddingForDomain(query)) ?? (await embedQuery(query));
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

  // Only fetched for sortBy "match" above: a plain-column sort (DR, price,
  // ...) skips the Claude rerank entirely and orders by a SQL column, so
  // paying for an embedding there would buy nothing.
  const vectorHits = queryVector ? await vectorCandidates(queryVector, VECTOR_CANDIDATE_LIMIT) : [];
  const vectorSimById = new Map(vectorHits.map((v) => [v.id, v.similarity]));
  const __tVector = Date.now();

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
  const outerFilterClauses = [
    f.minTraffic != null ? sql`AND COALESCE(traffic, 0) >= ${f.minTraffic}` : sql``,
    f.maxTraffic != null ? sql`AND COALESCE(traffic, 0) <= ${f.maxTraffic}` : sql``,
    f.minDr != null ? sql`AND COALESCE(dr, 0) >= ${f.minDr}` : sql``,
    f.maxDr != null ? sql`AND COALESCE(dr, 0) <= ${f.maxDr}` : sql``,
    f.minPrice != null ? sql`AND best_price >= ${f.minPrice}` : sql``,
    f.maxPrice != null ? sql`AND best_price <= ${f.maxPrice}` : sql``,
    f.category ? sql`AND LOWER(raw_category) LIKE LOWER(${"%" + f.category + "%"})` : sql``,
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
  // The vector branch is OR'd into the same prefilter rather than run as a
  // separate query: a domain qualifies if it matches the query's *words* or
  // its *meaning*. This is the hybrid part, and both halves are needed —
  // embeddings are weak on exact tokens (brand names, a specific TLD, a
  // domain typed in verbatim), which is precisely where the word match is
  // strong, and vice versa.
  const vectorIdClause = vectorHits.length
    ? sql`d.id IN (${sql.join(vectorHits.map((v) => sql`${v.id}`), sql`, `)})`
    : null;
  const recallClauses = [
    ...(wordClauses.length ? [sql`(${sql.join(wordClauses, sql` OR `)})`] : []),
    ...(vectorIdClause ? [vectorIdClause] : []),
  ];
  const matchClause = recallClauses.length
    ? sql`AND (${sql.join(recallClauses, sql` OR `)})`
    : sql``;

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
    f.category ? sql`AND LOWER(d.category) LIKE LOWER(${"%" + f.category + "%"})` : sql``,
  ];
  const poolFilters = sql.join(poolFilterClauses, sql` `);

  // Country is filtered here, inside the candidate CTEs, for the same reason
  // the TLD filter is (see below): the pool carries a LIMIT with no ORDER BY,
  // so anything filtered *after* it is filtered against an arbitrary,
  // plan-dependent slice. Applied as an outer filter, "supplements" + US
  // returned zero results while the unfiltered search returned thirty —
  // there were plenty of US domains, just none that happened to survive the
  // cut. Filtering early builds the pool from that country instead.
  const countryPrefixes = f.country ? countryMatchPrefixes(f.country) : null;
  const countryClause = countryPrefixes?.length
    ? sql`AND (${sql.join(
        countryPrefixes.map(
          (p) => sql`btrim(regexp_replace(regexp_replace(lower(d.country_main_traffic), '\(the\)|\ythe\y', ' ', 'g'), '[^a-z ]+', ' ', 'g')) LIKE ${p + "%"}`,
        ),
        sql` OR `,
      )})`
    : sql``;

  const tlds = (f.tlds ?? []).map((t) => t.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
  const tldClauses = tlds.map((t) => sql`d.domain ILIKE ${"%." + t}`);
  const tldClause = tldClauses.length
    ? sql`AND (${sql.join(tldClauses, sql` OR `)})`
    : sql``;

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
          ${poolFilters}
        -- Bound the keyword scan. The word-boundary regex has no index, so a
        -- broad query ("football news") matches tens of thousands of rows and
        -- each one then pays two EXISTS offer-checks — measured between 7s and
        -- 48s of SQL for the same query, and the slow end blows the
        -- serverless timeout. Vector hits are already capped at
        -- VECTOR_CANDIDATE_LIMIT and are OR'd in by primary key, so they are
        -- unaffected by this cap; it only stops the keyword arm from
        -- scanning the whole catalogue on generic words.
        LIMIT ${KEYWORD_SCAN_LIMIT}
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
        (SELECT * FROM sellable WHERE is_vector LIMIT ${VECTOR_CANDIDATE_LIMIT})
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
          (SELECT MIN(price) FROM (
             SELECT ${usdCaseExpr(sql`mo.min_price::float`, sql`mo.currency`, rates)} AS price FROM marketplace_offers mo WHERE mo.domain_id = d.id AND mo.available = true AND mo.min_price::float > 0
             UNION ALL
             SELECT ${usdCaseExpr(sql`so.min_price::float`, sql`so.currency`, rates)} AS price FROM supplier_offers so WHERE so.domain_id = d.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0
           ) prices) AS best_price,
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
    opts.hideLinked && opts.ownSite?.trim()
      ? getExcludedDomains(opts.ownSite.trim())
      : Promise.resolve({ excluded: new Set<string>(), degraded: false }),
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
          .slice(0, finalResultSize)
      : (() => {
          const top = shortlist.slice(0, finalResultSize);
          const maxRel = Math.max(1, ...top.map((s) => s.rel));
          return top.map((s) => ({ row: s.row, matchPct: Math.round((s.rel / maxRel) * 100) }));
        })();
    total = claudeScores ? claudeScores.size : shortlist.length;
  }

  const __tRerank = Date.now();
  // Already in flight alongside the rerank on the "match" path; only the
  // plain-column sorts, which skip the rerank entirely and so have no
  // latency to hide behind, pay for it here.
  const offersMap = offersPromise
    ? await offersPromise
    : await fetchOffersForDomains(scored.map((s) => s.row.domain as string), rates);
  const __tTotal = Date.now() - __t0;
  if (__tTotal > 3000) {
    console.log(
      `[searchCatalog] slow search "${query}": total ${__tTotal}ms ` +
        `(rates ${__tRates - __t0}ms, vector ${__tVector - __tRates}ms/${vectorHits.length} hits, ` +
        `sql ${__tSql - __tVector}ms/${rows.rows.length} rows, ` +
        `rerank ${__tRerank - __tSql}ms, offers ${__tTotal - (__tRerank - __t0)}ms)`
    );
  }

  const results: CatalogSearchResult[] = scored.map(({ row: r, matchPct }) => {
    const domain = r.domain as string;
    const dr = r.dr != null ? Number(r.dr) : 0;
    const traffic = r.traffic != null ? Number(r.traffic) : 0;
    const grade = (r.ai_grade as string) ?? (dr >= 70 ? "A+" : dr >= 55 ? "A" : dr >= 40 ? "B+" : "B");
    const score = r.ai_score != null ? Math.round(Number(r.ai_score)) : Math.round(Math.min(dr, 100) * 0.7 + Math.min(traffic / 100000, 30));
    const offers = offersMap.get(domain) ?? [];
    const lpBestPrice = r.best_price != null ? Number(r.best_price) : null;
    const offerMin = offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null;
    // Prefer marketplace_offers (kept fresh by the scraper fleet) over
    // lp_domain_price, a legacy table most connectors stopped writing to
    // (frozen ~March 2026 for 44/46 marketplaces). Math.min let a months-stale
    // number beat today's real price. lp is fallback-only for domains with no
    // offers coverage yet.
    const bestPrice = offerMin ?? lpBestPrice;
    return {
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
  });

  // Low-relevance flag, distinct from zero results — signals "we found
  // rows, but even the best one is a weak match" so the UI can say so
  // instead of presenting a table of 2-5%-match results as if they were
  // normal ones. Prefers Claude's own semantic score when we have one: word
  // overlap alone can look fine (e.g. "linen websites" overlapping on the
  // generic word "websites", shared by huge swaths of unrelated categories)
  // while every actual semantic score comes back in single digits — word
  // overlap is only the fallback signal for when Claude wasn't invoked
  // (a plain column sort) or came back null.
  const bestWordRel = shortlist[0]?.rel ?? 0;
  const bestMatchPct = results.length > 0 ? Math.max(...results.map((r) => r.matchPct)) : 0;
  const lowRelevance = usedClaudeScoring
    ? bestMatchPct < 40
    : words.length > 1 && bestWordRel / words.length < 0.4;

  const output: CatalogSearchOutput = { results, lowRelevance, degradedAhrefs, total };

  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, { result: output, cachedAt: Date.now() });

  return output;
}
