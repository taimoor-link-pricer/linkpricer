import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search/catalog-search";
import { isOnTopicQuery } from "@/lib/ai/query-intent";

// See app/api/related-sites/route.ts for why this is needed — same
// searchCatalog pipeline, same risk of exceeding the platform-default
// function timeout on a slow Claude rerank.
export const maxDuration = 60;

// Public, unauthenticated search backing the homepage AI chat
// (components/marketing/ai-search-home.tsx). No user session, so quota is
// an in-memory per-IP counter rather than the DB-backed weekly quota
// /api/related-sites uses — same rate-limiting pattern as
// app/api/preview/search/route.ts. Only ever returns the single best match,
// since the chat shows one domain at a time.
const MAX_SEARCHES = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour window

// In-memory rate limiter — good for single-instance; replace with Redis at scale
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Evict expired entries to prevent memory growth
  for (const [key, val] of rateLimit.entries()) {
    if (val.resetAt < now) rateLimit.delete(key);
  }

  const entry = rateLimit.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_SEARCHES - 1 };
  }

  if (entry.count >= MAX_SEARCHES) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_SEARCHES - entry.count };
}

interface HomepageSearchBody {
  query: string;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed, remaining } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: HomepageSearchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  try {
    // Run the on-topic gate and the real search concurrently — a public chat
    // box inevitably gets off-topic input ("can you clean my bathroom",
    // "what is 2+2"), and those can still score real word-overlap matches
    // (e.g. "bathroom" hits actual home-decor domains), so skipping the SQL
    // prefilter isn't reliable on its own. Running both in parallel means
    // legitimate searches never pay extra latency for this check; the search
    // result is simply discarded on the rare off-topic request.
    //
    // Claude already scores the full 25-candidate shortlist regardless of
    // finalResultSize (that param only slices the sorted result afterward),
    // so asking for 5 instead of 1 costs no extra Claude time — just a few
    // more pricing-join rows. The single best match is still all that's ever
    // shown as a "found it" offer; the other 4 exist only so a low-relevance
    // search can suggest categories that are actually in the catalog, rather
    // than leaving the user with only a name-brand-less "no match" message.
    const [onTopic, { results, lowRelevance }] = await Promise.all([
      isOnTopicQuery(query),
      searchCatalog({ query, finalResultSize: 5, claudeShortlistSize: 25 }),
    ]);

    if (!onTopic) {
      return NextResponse.json({ result: null, lowRelevance: false, offTopic: true, remaining });
    }

    let suggestedCategories: string[] | undefined;
    if (lowRelevance) {
      const seen = new Set<string>();
      suggestedCategories = [];
      outer: for (const r of results) {
        for (const cat of r.category.split(",").map((c) => c.trim()).filter(Boolean)) {
          const key = cat.toLowerCase();
          if (key === "general" || seen.has(key)) continue;
          seen.add(key);
          suggestedCategories.push(cat);
          if (suggestedCategories.length >= 3) break outer;
        }
      }
    }

    return NextResponse.json({ result: results[0] ?? null, lowRelevance, suggestedCategories, remaining });
  } catch (err) {
    console.error("[/api/homepage-search]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
