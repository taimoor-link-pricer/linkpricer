import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";

// ── Weekly search quota ──────────────────────────────────────────────────────
// Reuses the existing generic `user_activity_events` log (eventType +
// userId + timestamp, already indexed) rather than a new table/migration.
// No embeddings API key is configured in this environment (lp_marketplace_domains
// and lp_domain_ai_metrics both have a pgvector `embeddings` column, clearly meant
// for real semantic search — but generating a query embedding needs an
// OPENAI_API_KEY that isn't set up here). Until that's wired in, relevance is
// computed with Postgres full-text search (ts_rank) over each domain's
// category / semantic-category / semantic-summary text — a real, working
// ranked search over the real catalog, just not true vector similarity yet.
const WEEKLY_LIMIT = 10;
const EVENT_TYPE = "related_sites_search";

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
  maxPrice?: number;
  category?: string;
  grade?: string;
}

interface SearchBody {
  query: string;
  filters?: SearchFilters;
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
      f.maxPrice != null ? sql`AND best_price <= ${f.maxPrice}` : sql``,
      f.category ? sql`AND LOWER(raw_category) LIKE LOWER(${"%" + f.category + "%"})` : sql``,
    ];

    // Split into words and pre-filter on the *narrow* text columns (category,
    // domain name) with ILIKE before touching pricing/metrics joins or doing
    // any aggregation. The first version of this query ran to_tsvector/ts_rank
    // over every active row in the whole catalog with no pre-filter at all —
    // it hung for 15s+ in testing. This bounds the candidate set up front
    // instead. Real fix long-term is a trigram/GIN index (or the pgvector
    // embeddings columns already on these tables, once an embeddings API key
    // is configured) — this is the fast-enough interim version.
    const words = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    const wordClauses = words.map(
      (w) => sql`(d.category ILIKE ${"%" + w + "%"} OR d.w ILIKE ${"%" + w + "%"})`
    );
    const matchClause = wordClauses.length
      ? sql`AND (${sql.join(wordClauses, sql` OR `)})`
      : sql``;

    const rows = await db.execute(sql`
      WITH matched AS (
        SELECT d.id, d.w, d.category, d.country, d.language
        FROM lp_marketplace_domains d
        JOIN lp_domain_price p ON p."domainId" = d.id
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
          MAX(m."domainRating"::float) AS dr,
          MAX(m."orgTraffic") AS traffic,
          MAX(m."orgKeywords") AS keywords,
          MAX(m."refDomains") AS ref_domains,
          MIN(p.price::float) AS best_price,
          MAX(ai."semanticCategory") AS semantic_category,
          MAX(ai."valueGrade") AS ai_grade,
          MAX(ai."valueScore"::float) AS ai_score
        FROM matched d
        JOIN lp_domain_price p ON p."domainId" = d.id
        LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id
        LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.w
        GROUP BY d.w
      )
      SELECT * FROM aggregated
      WHERE 1 = 1
        ${sql.join(outerFilterClauses, sql``)}
    `);

    if (rows.rows.length === 0) {
      return NextResponse.json({ results: [], ...quota });
    }

    // Simple relevance score: how many query words appear in this domain's
    // category or name. Computed here (not in SQL) now that the candidate
    // set is already small. Sort by it and take the top 30 — the SQL LIMIT
    // 400 above only bounds the candidate pool, it isn't the final ranking.
    function relevance(domain: string, category: string): number {
      const hay = `${category} ${domain}`.toLowerCase();
      return words.filter((w) => hay.includes(w)).length;
    }

    const scored = rows.rows
      .map((r) => ({ row: r, rel: relevance(r.domain as string, (r.raw_category as string) ?? "") }))
      .sort((a, b) => b.rel - a.rel)
      .slice(0, 30);
    const maxRel = Math.max(1, ...scored.map((s) => s.rel));

    const results = scored.map(({ row: r, rel }) => {
      const dr = r.dr != null ? Number(r.dr) : 0;
      const traffic = r.traffic != null ? Number(r.traffic) : 0;
      const grade = (r.ai_grade as string) ?? (dr >= 70 ? "A+" : dr >= 55 ? "A" : dr >= 40 ? "B+" : "B");
      const score = r.ai_score != null ? Math.round(Number(r.ai_score)) : Math.round(Math.min(dr, 100) * 0.7 + Math.min(traffic / 100000, 30));
      const matchPct = Math.round((rel / maxRel) * 100);
      return {
        domain: r.domain as string,
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
        bestPrice: r.best_price != null ? Number(r.best_price) : null,
      };
    });

    // Log usage against the weekly quota only on a successful, executed search.
    await db.execute(sql`
      INSERT INTO user_activity_events (user_id, event_type, metadata)
      VALUES (${userId}, ${EVENT_TYPE}, ${JSON.stringify({ query })})
    `);

    const updatedQuota = await getQuota(userId);
    return NextResponse.json({ results, ...updatedQuota });
  } catch (err) {
    console.error("[/api/related-sites]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
