// Shared semantic search core for the marketplace catalog — extracted from
// app/api/related-sites/route.ts so the same SQL prefilter + Claude rerank +
// pricing-join pipeline can also back the public homepage AI chat
// (app/api/homepage-search/route.ts) without duplicating the Claude call or
// the offers joins.
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getExcludedDomains } from "@/lib/integrations/referring-domains-cache";
import { rerankWithClaude } from "@/lib/ai/claude-rerank";

const DEFAULT_CLAUDE_SHORTLIST_SIZE = 80;
const DEFAULT_FINAL_RESULT_SIZE = 30;
const DEFAULT_CANDIDATE_POOL_LIMIT = 400;

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
  quality: number;
  delivery: number;
  tat: number;
  link: string;
  example: string | null;
}

export interface CatalogSearchFilters {
  country?: string;
  language?: string;
  minTraffic?: number;
  minDr?: number;
  maxDr?: number;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  grade?: string;
}

export interface CatalogSearchResult {
  domain: string;
  matchPct: number;
  country: string;
  lang: string;
  category: string;
  dr: number;
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
async function fetchOffersForDomains(domains: string[]): Promise<Map<string, CatalogSearchOffer[]>> {
  const offersMap = new Map<string, CatalogSearchOffer[]>();
  if (domains.length === 0) return offersMap;
  const domainList = sql.join(domains.map((d) => sql`${d}`), sql`, `);

  const [marketplaceRows, vendorRows, exampleRows] = await Promise.all([
    db.execute(sql`
      SELECT LOWER(d.domain) AS domain, mo.marketplace_name AS name, mo.min_price, mo.max_price,
             mo.delivery_time_days, mo.quality_score, mo.link_type, mo.tat, mo.updated_at
      FROM marketplace_offers mo
      JOIN domains d ON d.id = mo.domain_id
      WHERE mo.available = true AND LOWER(d.domain) IN (${domainList})
      ORDER BY mo.min_price::float ASC
    `),
    db.execute(sql`
      SELECT LOWER(so.domain) AS domain, COALESCE(u.vendor_name, CONCAT(u.first_name, ' ', u.last_name), u.email) AS vendor_name,
             so.min_price, so.max_price, so.delivery_time_days, so.updated_at, so.status
      FROM supplier_offers so
      JOIN users u ON u.id = so.vendor_user_id
      WHERE so.status = 'active' AND so.is_active = true AND LOWER(so.domain) IN (${domainList})
      ORDER BY so.min_price::float ASC
    `),
    db.execute(sql`
      SELECT domain, example_url, example_title FROM domain_examples
      WHERE domain IN (${domainList}) AND example_url IS NOT NULL AND example_url != ''
    `),
  ]);

  const exampleMap = new Map<string, string>();
  for (const r of exampleRows.rows) exampleMap.set(r.domain as string, r.example_url as string);

  for (const r of marketplaceRows.rows) {
    const domain = r.domain as string;
    if (!offersMap.has(domain)) offersMap.set(domain, []);
    offersMap.get(domain)!.push({
      name: (r.name as string) ?? "Marketplace", type: "DB", updated: fmtUpdated(r.updated_at as string | null),
      minPrice: Number(r.min_price ?? 0), maxPrice: Number(r.max_price ?? r.min_price ?? 0),
      quality: Math.min(5, Math.max(1, Number(r.quality_score ?? 3))), delivery: Number(r.delivery_time_days ?? 14),
      tat: Number(r.tat ?? r.delivery_time_days ?? 14), link: (r.link_type as string) ?? "Dofollow",
      example: exampleMap.get(domain) ?? null,
    });
  }
  for (const r of vendorRows.rows) {
    const domain = r.domain as string;
    if (!offersMap.has(domain)) offersMap.set(domain, []);
    offersMap.get(domain)!.push({
      name: `Vendor: ${r.vendor_name as string}`, type: "Vendor", updated: fmtUpdated(r.updated_at as string | null),
      minPrice: Number(r.min_price ?? 0), maxPrice: Number(r.max_price ?? r.min_price ?? 0),
      quality: 3, delivery: Number(r.delivery_time_days ?? 14), tat: Number(r.delivery_time_days ?? 14),
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
  const query = opts.query.trim();
  const f = opts.filters ?? {};
  const claudeShortlistSize = opts.claudeShortlistSize ?? DEFAULT_CLAUDE_SHORTLIST_SIZE;
  const finalResultSize = opts.finalResultSize ?? DEFAULT_FINAL_RESULT_SIZE;
  const candidatePoolLimit = opts.candidatePoolLimit ?? DEFAULT_CANDIDATE_POOL_LIMIT;
  const sortBy: CatalogSortBy = opts.sortBy ?? "match";
  const sortDir: CatalogSortDir = opts.sortDir ?? "desc";

  // Outer filters apply to the *aggregated* result (after GROUP BY), since
  // that's the layer that actually has country/lang/dr/traffic/best_price
  // as plain column aliases to filter on.
  const outerFilterClauses = [
    f.country ? sql`AND LOWER(country) = LOWER(${f.country})` : sql``,
    f.language ? sql`AND LOWER(lang) = LOWER(${f.language})` : sql``,
    f.minTraffic != null ? sql`AND COALESCE(traffic, 0) >= ${f.minTraffic}` : sql``,
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
  // domain name, plus the AI-labeled semantic category/summary) with ILIKE
  // before touching pricing/metrics joins or doing any aggregation. This
  // bounds the candidate set up front (recall), while final ranking quality
  // (precision) comes from the Claude rerank pass below over the shortlist.
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const wordClauses = words.map(
    (w) =>
      sql`(d.category ILIKE ${"%" + w + "%"} OR d.w ILIKE ${"%" + w + "%"} OR ai."semanticCategory" ILIKE ${"%" + w + "%"} OR ai."semanticSummary" ILIKE ${"%" + w + "%"})`
  );
  const matchClause = wordClauses.length
    ? sql`AND (${sql.join(wordClauses, sql` OR `)})`
    : sql``;

  // Main catalog query and the (optional) "already links to me" exclusion
  // lookup are independent — run them concurrently rather than serially.
  const [rows, exclusionResult] = await Promise.all([
    db.execute(sql`
      WITH matched AS (
        SELECT DISTINCT d.id, d.w, d.category, d.country, d.language
        FROM lp_marketplace_domains d
        JOIN lp_domain_price p ON p."domainId" = d.id
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.w
        WHERE d."isActive" = true AND p."isActive" = true AND d."deletedAt" IS NULL
          ${matchClause}
        LIMIT ${candidatePoolLimit}
      ),
      aggregated AS (
        SELECT
          LOWER(d.w) AS domain,
          MAX(d.category) AS raw_category,
          MAX(d.country) AS country,
          MAX(d.language) AS lang,
          COALESCE(MAX(ads."domain_rating"::float), MAX(m."domainRating"::float)) AS dr,
          MAX(m."orgTraffic") AS traffic,
          MAX(m."orgKeywords") AS keywords,
          MAX(m."refDomains") AS ref_domains,
          MIN(p.price::float) AS best_price,
          MAX(ai."semanticCategory") AS semantic_category,
          MAX(ai."semanticSummary") AS semantic_summary,
          MAX(ai."valueGrade") AS ai_grade,
          MAX(ai."valueScore"::float) AS ai_score
        FROM matched d
        JOIN lp_domain_price p ON p."domainId" = d.id
        LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id
        LEFT JOIN lp_ahrefs_dr_staging ads ON ads.domain = LOWER(d.w)
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.w
        GROUP BY d.w
      )
      SELECT * FROM aggregated
      WHERE 1 = 1
        ${sql.join(outerFilterClauses, sql``)}
    `),
    opts.hideLinked && opts.ownSite?.trim()
      ? getExcludedDomains(opts.ownSite.trim())
      : Promise.resolve({ excluded: new Set<string>(), degraded: false }),
  ]);
  const degradedAhrefs = exclusionResult.degraded;

  // Filtering in JS against a Set (not a SQL NOT IN) is deliberate: the
  // candidate pool is already bounded to <=400 rows above, so this is
  // cheap and avoids building a huge SQL NOT IN(...) list from what could
  // be 1000s of referring domains.
  const matchedRows = exclusionResult.excluded.size
    ? rows.rows.filter((r) => !exclusionResult.excluded.has((r.domain as string).toLowerCase()))
    : rows.rows;

  if (matchedRows.length === 0) {
    return { results: [], lowRelevance: false, degradedAhrefs, total: 0 };
  }

  // Simple relevance score: how many query words appear in this domain's
  // category or name. Used to cut a shortlist for the Claude rerank pass
  // below, and as the fallback ranking if that call fails or is skipped.
  function relevance(domain: string, category: string): number {
    const hay = `${category} ${domain}`.toLowerCase();
    return words.filter((w) => hay.includes(w)).length;
  }

  const shortlist = matchedRows
    .map((r) => ({ row: r, rel: relevance(r.domain as string, (r.raw_category as string) ?? "") }))
    .sort((a, b) => b.rel - a.rel)
    .slice(0, claudeShortlistSize);

  let scored: { row: Record<string, unknown>; matchPct: number }[];
  let total: number;

  if (sortBy !== "match") {
    // Plain-column sort: skip Claude entirely and order the *full* matched
    // candidate pool (not just the shortlist) directly by that SQL column.
    // matchPct is still computed (cheap word-overlap) purely for display —
    // it does not drive ordering in this mode.
    const extractor = SORT_EXTRACTORS[sortBy]!;
    const dir = sortDir === "asc" ? 1 : -1;
    const relByDomain = new Map(shortlist.map((s) => [s.row.domain as string, s.rel]));
    const maxRel = Math.max(1, ...shortlist.map((s) => s.rel));
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

  const offersMap = await fetchOffersForDomains(scored.map((s) => s.row.domain as string));

  const results: CatalogSearchResult[] = scored.map(({ row: r, matchPct }) => {
    const domain = r.domain as string;
    const dr = r.dr != null ? Number(r.dr) : 0;
    const traffic = r.traffic != null ? Number(r.traffic) : 0;
    const grade = (r.ai_grade as string) ?? (dr >= 70 ? "A+" : dr >= 55 ? "A" : dr >= 40 ? "B+" : "B");
    const score = r.ai_score != null ? Math.round(Number(r.ai_score)) : Math.round(Math.min(dr, 100) * 0.7 + Math.min(traffic / 100000, 30));
    const offers = offersMap.get(domain) ?? [];
    const lpBestPrice = r.best_price != null ? Number(r.best_price) : null;
    const offerMin = offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null;
    const bestPrice = lpBestPrice != null && offerMin != null ? Math.min(lpBestPrice, offerMin) : (lpBestPrice ?? offerMin);
    return {
      domain,
      matchPct,
      country: (r.country as string) ?? "US",
      lang: (r.lang as string) ?? "en",
      category: (r.raw_category as string) ?? (r.semantic_category as string) ?? "General",
      dr,
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

  // Low-relevance flag: even the best word-overlap match only hit a small
  // fraction of the query's words — distinct from zero results. Based on
  // word overlap regardless of whether Claude reranked, since this signals
  // whether the SQL pre-filter found anything worth ranking at all.
  const bestWordRel = shortlist[0]?.rel ?? 0;
  const lowRelevance = words.length > 1 && bestWordRel / words.length < 0.4;

  return { results, lowRelevance, degradedAhrefs, total };
}
