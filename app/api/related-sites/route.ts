import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { searchCatalog, type CatalogSearchFilters } from "@/lib/search/catalog-search";

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

interface SearchBody {
  query: string;
  filters?: CatalogSearchFilters;
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

  try {
    const { results, lowRelevance, degradedAhrefs } = await searchCatalog({
      query,
      filters: body.filters,
      ownSite: body.ownSite,
      hideLinked: body.hideLinked,
      claudeShortlistSize: CLAUDE_SHORTLIST_SIZE,
      finalResultSize: FINAL_RESULT_SIZE,
    });

    if (results.length === 0) {
      return NextResponse.json({ results: [], lowRelevance: false, degradedAhrefs, ...quota });
    }

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
