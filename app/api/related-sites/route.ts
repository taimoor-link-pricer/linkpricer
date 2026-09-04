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
// The quota exists to cap *Ahrefs spend*, not search volume. Ahrefs is only
// ever called for the "hide sites that already link to me" exclusion
// (lib/integrations/referring-domains-cache.ts -> lib/integrations/ahrefs.ts),
// which fires only when the user supplies their own site AND turns the toggle
// on. Every other search — plain, filtered, re-sorted — is DB + Claude only
// and costs us nothing per-Ahrefs, so it is unmetered and must never be
// blocked by an exhausted quota. See isBillableSearch() below.
//
// The counter of record is users.related_sites_week_count / related_sites_
// week_start (a date-only 'YYYY-MM-DD' Monday marker). It is the same row the
// atomic reservation UPDATE touches, so the number we display and the number
// we enforce can never disagree. `user_activity_events` is still written for
// every search, but purely as an analytics/dedup log — never as a counter.
//
// The actual search logic (SQL prefilter + Claude rerank + pricing joins)
// lives in lib/search/catalog-search.ts, shared with the public homepage
// chat's /api/homepage-search route. This file only adds auth + quota.
const WEEKLY_LIMIT = 10;
const EVENT_TYPE = "related_sites_search";
// 160, not 80. The rerank now replies with positional scores instead of
// {domain, score} objects, which cut its latency roughly threefold
// (lib/ai/openai-rerank.ts), and that headroom buys candidates rather than
// speed alone: at 80 the cut was measurably discarding sites the model then
// scored 90+ when it could see them.
const CLAUDE_SHORTLIST_SIZE = 160;
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

// users.related_sites_week_start is a varchar holding the Monday as
// 'YYYY-MM-DD'. Derived in one place so the reserve, release and read paths
// can never key off subtly different strings.
function weekStartKey(d: Date = startOfWeekUTC()): string {
  return d.toISOString().slice(0, 10);
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

// Reads `used` off the exact same users row (and the exact same week marker)
// that reserveQuotaSlot's UPDATE writes and gates on. This deliberately does
// NOT count user_activity_events rows: that log is written for every search
// including the unmetered ones, and even when it was filtered to metered
// searches it was a second, independently-drifting counter — live prod data
// already showed accounts whose event count and week_count disagreed, so the
// figure on screen was not the figure being enforced.
async function getQuota(userId: string) {
  const weekStart = startOfWeekUTC();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekStartIso = weekStartKey(weekStart);
  const rows = await db.execute(sql`
    SELECT
      related_sites_quota_override AS override,
      CASE WHEN related_sites_week_start = ${weekStartIso}
           THEN COALESCE(related_sites_week_count, 0) ELSE 0 END AS used
    FROM users WHERE id = ${userId}
  `);
  const row = rows.rows[0];
  const used = Number(row?.used ?? 0);
  const overrideRaw = row?.override;
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

// True only for searches that actually reach Ahrefs' paid refdomains endpoint:
// the exclusion is applied in catalog-search.ts under exactly this condition
// (`opts.hideLinked && opts.ownSite?.trim()`), and nothing else in the
// pipeline spends Ahrefs units. Kept in lockstep with that call site — if the
// exclusion ever gains another trigger, it has to be mirrored here or we stop
// metering spend we are actually incurring.
//
// Note this bills on *use of the feature*, not on a cache miss.
// referring-domains-cache.ts serves the same target domain from Postgres for
// 30 days, so a repeat exclusion search for the same site costs nothing — but
// metering on cache-miss would make the counter move unpredictably from the
// user's point of view (identical actions, different price), so the feature
// flag is the billing unit.
function isBillableSearch(body: { ownSite?: string; hideLinked?: boolean }): boolean {
  return !!body.hideLinked && !!body.ownSite?.trim();
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

  let body: SearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  // Parsed before the quota gate, unlike before: whether the quota applies at
  // all depends on the body, so an exhausted quota must not 429 a plain search
  // that never touches Ahrefs.
  const billable = isBillableSearch(body);

  const quota = await getQuota(userId);
  if (billable && quota.remaining <= 0) {
    return NextResponse.json({ error: "Weekly search limit reached", ...quota }, { status: 429 });
  }

  const sortBy = body.sortBy ?? "match";
  const isPlainSort = sortBy !== "match";

  // Whether this counts against the weekly quota is derived server-side, not
  // taken from the client. Two conditions, both required:
  //   1. it spends Ahrefs units at all (`billable`), and
  //   2. it isn't this user's own most recently metered search being re-run
  //      or re-sorted.
  // A client claiming countAsSearch:false is still ignored — that field is
  // read from the body nowhere in this file.
  const signature = searchSignature({ query, filters: body.filters, ownSite: body.ownSite, hideLinked: body.hideLinked });
  // Matched against the last *metered* event, not the last event of any kind.
  // Unmetered searches are still logged (below) for analytics, and comparing
  // against those would make an A -> B -> A sequence charge for the second A
  // even though its Ahrefs lookup is already cached.
  const lastSearchRows = billable
    ? await db.execute(sql`
        SELECT metadata FROM user_activity_events
        WHERE user_id = ${userId} AND event_type = ${EVENT_TYPE}
          AND metadata->>'billable' = 'true'
        ORDER BY timestamp DESC
        LIMIT 1
      `)
    : null;
  const lastMetadata = lastSearchRows
    ? ((lastSearchRows.rows ?? lastSearchRows)[0]?.metadata as { signature?: string } | undefined)
    : undefined;
  const countAsSearch = billable && lastMetadata?.signature !== signature;

  const weekStartIso = weekStartKey();
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

    // Every successful search is logged for analytics, metered or not — the
    // log is no longer a counter, so writing unmetered rows to it can't
    // inflate anyone's usage. `billable` is what the dedup query above reads
    // back; `metered` records whether this specific request actually consumed
    // a slot (a repeat of the same billable search is billable but free).
    // Best-effort: a logging failure must not fail a search the user has
    // already paid a quota slot for.
    await db.execute(sql`
      INSERT INTO user_activity_events (user_id, event_type, metadata)
      VALUES (${userId}, ${EVENT_TYPE}, ${JSON.stringify({ query, signature, billable, metered: countAsSearch })})
    `).catch((err) => console.error("[/api/related-sites] Failed to log search event", err));

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
