import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getExcludedDomains } from "@/lib/integrations/referring-domains-cache";
import { rerankWithClaude } from "@/lib/ai/claude-rerank";

// ── Weekly search quota ──────────────────────────────────────────────────────
// Reuses the existing generic `user_activity_events` log (eventType +
// userId + timestamp, already indexed) rather than a new table/migration.
//
// Relevance ranking: an ILIKE/word-overlap pass narrows the candidate pool
// (cheap, SQL-side), then a bounded shortlist is reranked by Claude for real
// semantic relevance (see lib/ai/claude-rerank.ts) — not literal keyword
// matching. lp_marketplace_domains/lp_domain_ai_metrics also have an unused
// pgvector `embeddings` column from an earlier, abandoned OpenAI-embeddings
// design; not used here.
const WEEKLY_LIMIT = 10;
const EVENT_TYPE = "related_sites_search";
const CLAUDE_SHORTLIST_SIZE = 80;
const FINAL_RESULT_SIZE = 30;

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

interface RawOffer {
  name: string; type: "API" | "Vendor" | "DB"; updated: string;
  minPrice: number; maxPrice: number; quality: number; delivery: number; tat: number;
  link: string; example: string | null;
}

// Same offers join as /api/analyze — marketplace_offers + supplier_offers +
// domain_examples, keyed by domain — so Related Sites rows can expand into
// the identical compare-offers UI Domain Analysis already uses.
async function fetchOffersForDomains(domains: string[]): Promise<Map<string, RawOffer[]>> {
  const offersMap = new Map<string, RawOffer[]>();
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

function startOfWeekUTC(d = new Date()): Date {
  const day = d.getUTCDay(); // 0 = Sunday
  const diffFromMonday = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffFromMonday, 0, 0, 0, 0));
}

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

async function getQuota(userId: string) {
  const weekStart = startOfWeekUTC();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM user_activity_events
    WHERE user_id = ${userId} AND event_type = ${EVENT_TYPE}
      AND timestamp >= ${weekStart.toISOString()} AND timestamp < ${weekEnd.toISOString()}
  `);
  const used = Number(rows.rows[0]?.n ?? 0);
  return { used, remaining: Math.max(0, WEEKLY_LIMIT - used), limit: WEEKLY_LIMIT, resetsAt: weekEnd.toISOString() };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const quota = await getQuota(userId);
  return NextResponse.json(quota);
}

interface SearchFilters {
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

interface SearchBody {
  query: string;
  filters?: SearchFilters;
  ownSite?: string;
  hideLinked?: boolean;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const quota = await getQuota(userId);
  if (quota.remaining <= 0) {
    return NextResponse.json({ error: "Weekly search limit reached", ...quota }, { status: 429 });
  }

  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const f = body.filters ?? {};

  try {
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
    // before touching pricing/metrics joins or doing any aggregation. The
    // first version of this query ran to_tsvector/ts_rank over every active
    // row in the whole catalog with no pre-filter at all — it hung for 15s+
    // in testing. This bounds the candidate set up front (recall), while
    // final ranking quality (precision) comes from the Claude rerank pass
    // below over the resulting shortlist.
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
          LIMIT 400
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
      body.hideLinked && body.ownSite?.trim()
        ? getExcludedDomains(body.ownSite.trim())
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
      return NextResponse.json({ results: [], lowRelevance: false, degradedAhrefs, ...quota });
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
      .slice(0, CLAUDE_SHORTLIST_SIZE);

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

    const scored = claudeScores
      ? shortlist
          .map((s) => ({
            row: s.row,
            matchPct: Math.round(Math.max(0, Math.min(100, claudeScores.get(s.row.domain as string) ?? 0))),
          }))
          .sort((a, b) => b.matchPct - a.matchPct)
          .slice(0, FINAL_RESULT_SIZE)
      : (() => {
          const top = shortlist.slice(0, FINAL_RESULT_SIZE);
          const maxRel = Math.max(1, ...top.map((s) => s.rel));
          return top.map((s) => ({ row: s.row, matchPct: Math.round((s.rel / maxRel) * 100) }));
        })();

    const offersMap = await fetchOffersForDomains(scored.map((s) => s.row.domain as string));

    const results = scored.map(({ row: r, matchPct }) => {
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
        drTrend: "flat" as const,
        traffic,
        keywords: r.keywords != null ? Number(r.keywords) : 0,
        refDomains: r.ref_domains != null ? Number(r.ref_domains) : 0,
        grade,
        score,
        bestPrice,
        yourPrice: null as number | null,
        offers,
      };
    });

    // Low-relevance flag: even the best word-overlap match only hit a small
    // fraction of the query's words — mirrors the source's separate "weak
    // matches" empty state (distinct from zero results). Based on word
    // overlap regardless of whether Claude reranked, since this signals
    // whether the SQL pre-filter found anything worth ranking at all.
    const bestWordRel = shortlist[0]?.rel ?? 0;
    const lowRelevance = words.length > 1 && bestWordRel / words.length < 0.4;

    // Log usage against the weekly quota only on a successful, executed search.
    await db.execute(sql`
      INSERT INTO user_activity_events (user_id, event_type, metadata)
      VALUES (${userId}, ${EVENT_TYPE}, ${JSON.stringify({ query })})
    `);

    const updatedQuota = await getQuota(userId);
    return NextResponse.json({ results, lowRelevance, degradedAhrefs, ...updatedQuota });
  } catch (err) {
    console.error("[/api/related-sites]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
