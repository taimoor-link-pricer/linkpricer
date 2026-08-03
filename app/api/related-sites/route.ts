import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { searchCatalog, type CatalogSearchFilters, type CatalogSortBy, type CatalogSortDir } from "@/lib/search/catalog-search";

// ── Weekly search quota ──────────────────────────────────────────────────────
// Reuses the existing generic `user_activity_events` log (eventType +
// userId + timestamp, already indexed) rather than a new table/migration.
//
// The actual search logic (SQL prefilter + Claude rerank + pricing joins)
// lives in lib/search/catalog-search.ts, shared with the public homepage
// chat's /api/homepage-search route. This file only adds auth + quota.
const WEEKLY_LIMIT = 10;
const EVENT_TYPE = "related_sites_search";
const CLAUDE_SHORTLIST_SIZE = 80;
const FINAL_RESULT_SIZE = 30;
// Plain-column sorts (DR/traffic/price/keywords/refDomains) skip Claude
// entirely, so they can afford to return a much larger, unbounded-feeling
// result set — the frontend paginates over it client-side and the CSV
// export needs "all" of it in the same order that's on screen.
const SORTED_RESULT_SIZE = 500;
const SORTED_CANDIDATE_POOL_LIMIT = 3000;

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
  const [usedRows, overrideRows] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM user_activity_events
      WHERE user_id = ${userId} AND event_type = ${EVENT_TYPE}
        AND timestamp >= ${weekStart.toISOString()} AND timestamp < ${weekEnd.toISOString()}
    `),
    db.execute(sql`
      SELECT related_sites_quota_override AS n FROM users WHERE id = ${userId}
    `),
  ]);
  const used = Number(usedRows.rows[0]?.n ?? 0);
  const overrideRaw = overrideRows.rows[0]?.n;
  const limit = overrideRaw != null ? Number(overrideRaw) : WEEKLY_LIMIT;
  return { used, remaining: Math.max(0, limit - used), limit, resetsAt: weekEnd.toISOString() };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const quota = await getQuota(userId);
  return NextResponse.json(quota);
}

interface SearchBody {
  query: string;
  filters?: CatalogSearchFilters;
  ownSite?: string;
  hideLinked?: boolean;
  sortBy?: CatalogSortBy;
  sortDir?: CatalogSortDir;
  // Re-sorting an already-run search (clicking a column header) doesn't
  // consume a weekly quota unit — only the initial "Search" click, and any
  // change to the query/filters/own-site inputs, does. The quota gate still
  // blocks the request outright once exhausted (see below), it just doesn't
  // additionally decrement on sort-only refinements.
  countAsSearch?: boolean;
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

  const sortBy = body.sortBy ?? "match";
  const isPlainSort = sortBy !== "match";
  const countAsSearch = body.countAsSearch !== false;

  try {
    const { results, lowRelevance, degradedAhrefs, total } = await searchCatalog({
      query,
      filters: body.filters,
      ownSite: body.ownSite,
      hideLinked: body.hideLinked,
      claudeShortlistSize: CLAUDE_SHORTLIST_SIZE,
      finalResultSize: isPlainSort ? SORTED_RESULT_SIZE : FINAL_RESULT_SIZE,
      candidatePoolLimit: isPlainSort ? SORTED_CANDIDATE_POOL_LIMIT : undefined,
      sortBy,
      sortDir: body.sortDir,
    });

    if (results.length === 0) {
      return NextResponse.json({ results: [], lowRelevance: false, degradedAhrefs, total: 0, ...quota });
    }

    // Log usage against the weekly quota only on a successful, executed
    // search that should actually count (not a sort-only re-fetch).
    if (countAsSearch) {
      await db.execute(sql`
        INSERT INTO user_activity_events (user_id, event_type, metadata)
        VALUES (${userId}, ${EVENT_TYPE}, ${JSON.stringify({ query })})
      `);
    }

    const updatedQuota = countAsSearch ? await getQuota(userId) : quota;
    return NextResponse.json({ results, lowRelevance, degradedAhrefs, total, ...updatedQuota });
  } catch (err) {
    console.error("[/api/related-sites]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
