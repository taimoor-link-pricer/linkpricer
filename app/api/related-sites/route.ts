import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { searchCatalog, type CatalogSearchFilters, type CatalogSortBy, type CatalogSortDir } from "@/lib/search/catalog-search";

// searchCatalog's Claude rerank alone carries a 20s internal timeout
// (lib/ai/claude-rerank.ts), on top of the SQL prefilter + offers joins —
// observed totals up to ~29s. Without this, the route inherited Vercel's
// platform-default function timeout and 504'd (FUNCTION_INVOCATION_TIMEOUT)
// on any slow Claude response, independent of which filters were applied.
export const maxDuration = 60;

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
}

// Deterministic string form of a value, independent of key insertion order —
// used to compare "the search this request represents" against the last one
// logged, regardless of how the caller happened to build the object.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

// Identifies "the search" independent of sort — two requests that only differ
// by sortBy/sortDir are the same search being re-sorted, not a new one.
function searchSignature(params: { query: string; filters?: CatalogSearchFilters; ownSite?: string; hideLinked?: boolean }): string {
  return stableStringify({
    query: params.query,
    filters: params.filters ?? null,
    ownSite: params.ownSite ?? null,
    hideLinked: !!params.hideLinked,
  });
}

// Atomically reserves one slot against the weekly quota, gated on the same
// row's own related_sites_quota_override — a single UPDATE targeting one
// users row, so Postgres's row lock serializes concurrent requests from the
// same account instead of letting them all read the same pre-search count.
// Without this, N concurrent POSTs (varying the query to dodge the catalog
// cache and this-search's own re-sort dedup) all pass the same stale
// getQuota() read before any of them finishes the ~10-30s search + logs
// usage, blowing straight through the 10/week cap in one burst.
// Returns the row's post-update week_count on success (so the caller can
// derive `remaining` locally instead of paying a second getQuota() round
// trip for a value this UPDATE already computed and returned), or null if
// the slot wasn't reserved (quota exhausted).
async function reserveQuotaSlot(userId: string, weekStartIso: string): Promise<number | null> {
  const result = await db.execute(sql`
    UPDATE users
    SET related_sites_week_count = CASE WHEN related_sites_week_start = ${weekStartIso} THEN related_sites_week_count + 1 ELSE 1 END,
        related_sites_week_start = ${weekStartIso}
    WHERE id = ${userId}
      AND (
        related_sites_week_start IS DISTINCT FROM ${weekStartIso}
        OR related_sites_week_count < COALESCE(related_sites_quota_override, ${WEEKLY_LIMIT})
      )
    RETURNING related_sites_week_count
  `);
  const rows = result.rows ?? result;
  return rows.length > 0 ? Number(rows[0].related_sites_week_count) : null;
}

async function releaseQuotaSlot(userId: string, weekStartIso: string): Promise<void> {
  await db.execute(sql`
    UPDATE users
    SET related_sites_week_count = GREATEST(related_sites_week_count - 1, 0)
    WHERE id = ${userId} AND related_sites_week_start = ${weekStartIso}
  `).catch((err) => console.error("[/api/related-sites] Failed to release quota slot", err));
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

  // Whether this counts against the weekly quota is derived server-side, not
  // taken from the client. It's a genuine re-sort (free) only if it matches
  // the signature of this user's own most recently logged search; anything
  // else — including a client simply claiming countAsSearch:false — counts.
  const signature = searchSignature({ query, filters: body.filters, ownSite: body.ownSite, hideLinked: body.hideLinked });
  const lastSearchRows = await db.execute(sql`
    SELECT metadata FROM user_activity_events
    WHERE user_id = ${userId} AND event_type = ${EVENT_TYPE}
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  const lastMetadata = (lastSearchRows.rows ?? lastSearchRows)[0]?.metadata as { signature?: string } | undefined;
  const countAsSearch = lastMetadata?.signature !== signature;

  const weekStartIso = startOfWeekUTC().toISOString().slice(0, 10);
  let reservedCount: number | null = null;
  if (countAsSearch) {
    reservedCount = await reserveQuotaSlot(userId, weekStartIso);
    if (reservedCount === null) {
      const freshQuota = await getQuota(userId);
      return NextResponse.json({ error: "Weekly search limit reached", ...freshQuota }, { status: 429 });
    }
  }

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
      // A no-hit search doesn't count — release the slot reserved above.
      if (countAsSearch) await releaseQuotaSlot(userId, weekStartIso);
      return NextResponse.json({ results: [], lowRelevance: false, degradedAhrefs, total: 0, ...quota });
    }

    // Log usage against the weekly quota only on a successful, executed
    // search that should actually count (not a sort-only re-fetch). The slot
    // itself is already reserved atomically above; this just records what it
    // was for.
    if (countAsSearch) {
      await db.execute(sql`
        INSERT INTO user_activity_events (user_id, event_type, metadata)
        VALUES (${userId}, ${EVENT_TYPE}, ${JSON.stringify({ query, signature })})
      `);
    }

    // reservedCount is exactly what a fresh getQuota() would read right now —
    // reserveQuotaSlot's UPDATE...RETURNING already gave us the post-reservation
    // count atomically, and `limit`/`resetsAt` can't change within one request —
    // so this avoids a second DB round trip for a value already in hand.
    const updatedQuota = countAsSearch && reservedCount !== null
      ? { used: reservedCount, remaining: Math.max(0, quota.limit - reservedCount), limit: quota.limit, resetsAt: quota.resetsAt }
      : quota;
    return NextResponse.json({ results, lowRelevance, degradedAhrefs, total, ...updatedQuota });
  } catch (err) {
    console.error("[/api/related-sites]", err instanceof Error ? err.message : err);
    // The search never completed — release the reserved slot so a failed
    // attempt doesn't burn the user's weekly quota.
    if (countAsSearch) await releaseQuotaSlot(userId, weekStartIso);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
