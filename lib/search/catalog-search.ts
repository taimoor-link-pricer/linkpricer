// Shared semantic search core for the marketplace catalog — extracted from
// app/api/related-sites/route.ts so the same SQL prefilter + Claude rerank +
// pricing-join pipeline can also back the public homepage AI chat
// (app/api/homepage-search/route.ts) without duplicating the Claude call or
// the offers joins.
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { getExcludedDomains, normalizeDomain } from "@/lib/integrations/referring-domains-cache";
import { rerankWithClaude } from "@/lib/ai/claude-rerank";
import { normalizeLanguage, languageDisplayLabel } from "@/lib/search/language-normalize";
import { getUsdRates, toUsd } from "@/lib/currency";

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
  const rates = await getUsdRates();
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
  const outerFilterClauses = [
    f.country ? sql`AND LOWER(country) = LOWER(${f.country})` : sql``,
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
    return sql`(d.category ~* ${pattern} OR d.domain ~* ${pattern} OR ai."semanticCategory" ~* ${pattern} OR ai."semanticSummary" ~* ${pattern})`;
  });
  const matchClause = wordClauses.length
    ? sql`AND (${sql.join(wordClauses, sql` OR `)})`
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
  const tlds = (f.tlds ?? []).map((t) => t.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
  const tldClauses = tlds.map((t) => sql`d.domain ILIKE ${"%." + t}`);
  const tldClause = tldClauses.length
    ? sql`AND (${sql.join(tldClauses, sql` OR `)})`
    : sql``;

  // Main catalog query and the (optional) "already links to me" exclusion
  // lookup are independent — run them concurrently rather than serially.
  const [rows, exclusionResult] = await Promise.all([
    db.execute(sql`
      WITH text_matched AS MATERIALIZED (
        SELECT d.id, d.domain AS w, d.category, d.country_main_traffic AS country,
               d.language_written_in_website AS language,
               d.domain_rating, d.domain_rating_updated_at, d.org_traffic, d.org_keywords, d.ref_domains,
               ai."semanticCategory" AS semantic_category, ai."semanticSummary" AS semantic_summary,
               ai."valueGrade" AS ai_grade, ai."valueScore" AS ai_score
        FROM domains d
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.domain
        WHERE 1 = 1
          ${matchClause}
          ${tldClause}
      ),
      matched AS (
        SELECT t.* FROM text_matched t
        WHERE EXISTS (
          SELECT 1 FROM marketplace_offers mo WHERE mo.domain_id = t.id AND mo.available = true AND mo.min_price::float > 0
          UNION ALL
          SELECT 1 FROM supplier_offers so WHERE so.domain_id = t.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0
        )
        LIMIT ${candidatePoolLimit}
      ),
      aggregated AS (
        SELECT
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

  const shortlist = matchedRows
    .map((r) => ({ row: r, rel: relevance(r.domain as string, (r.raw_category as string) ?? "") }))
    .sort((a, b) => b.rel - a.rel)
    .slice(0, claudeShortlistSize);

  let scored: { row: Record<string, unknown>; matchPct: number }[];
  let total: number;
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
    const claudeScores = await rerankWithClaude(
      query,
      shortlist.map((s) => ({
        domain: s.row.domain as string,
        category: (s.row.raw_category as string) ?? "",
        semanticSummary: s.row.semantic_summary as string | null,
      }))
    );

    total = shortlist.length;
    usedClaudeScoring = !!claudeScores;
    scored = claudeScores
      ? shortlist
          .map((s) => ({
            row: s.row,
            matchPct: Math.round(Math.max(0, Math.min(100, claudeScores.get(s.row.domain as string) ?? 0))),
          }))
          .sort((a, b) => b.matchPct - a.matchPct)
          .slice(0, finalResultSize)
      : (() => {
          const top = shortlist.slice(0, finalResultSize);
          const maxRel = Math.max(1, ...top.map((s) => s.rel));
          return top.map((s) => ({ row: s.row, matchPct: Math.round((s.rel / maxRel) * 100) }));
        })();
  }

  const __tRerank = Date.now();
  const offersMap = await fetchOffersForDomains(scored.map((s) => s.row.domain as string), rates);
  const __tTotal = Date.now() - __t0;
  if (__tTotal > 3000) {
    console.log(
      `[searchCatalog] slow search "${query}": total ${__tTotal}ms ` +
        `(rates ${__tRates - __t0}ms, sql ${__tSql - __tRates}ms/${rows.rows.length} rows, ` +
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
