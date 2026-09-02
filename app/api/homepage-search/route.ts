import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { searchCatalog } from "@/lib/search/catalog-search";
import { isOnTopicQuery } from "@/lib/ai/query-intent";
import { verifySession } from "@/lib/auth/verify-session";

// See app/api/related-sites/route.ts for why this is needed — same
// searchCatalog pipeline, same risk of exceeding the platform-default
// function timeout on a slow Claude rerank.
export const maxDuration = 60;

// Search backing the homepage AI chat (components/marketing/ai-search-home.tsx).
//
// Open to signed-out visitors, so quota is an in-memory per-IP counter rather
// than the DB-backed weekly quota /api/related-sites uses — same rate-limiting
// pattern as app/api/preview/search/route.ts. Signed-in callers skip it
// entirely: the cap is a sign-up nudge, and the homepage chat is a real app
// surface once you have an account, not a teaser to be metered.
//
// Only ever returns the single best match, since the chat shows one domain at
// a time — for signed-in users too, deliberately: opening that up is a change
// to the chat's result shape, not just an ungating.
const MAX_SEARCHES = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour window

// How many retrieved candidates the semantic rerank is allowed to see —
// deliberately the same number /api/related-sites uses (CLAUDE_SHORTLIST_SIZE
// there), because it is the same catalogue and the same question: the two
// surfaces should not name different "best" sites for an identical query.
//
// This used to be 25, which quietly threw away most of the retrieval it had
// already paid for. searchCatalog pulls 150 nearest neighbours by embedding,
// but only ~60% of the shortlist is reserved for them (VECTOR_SEAT_SHARE),
// so a 25-slot shortlist ranked about 15 of those 150 and discarded the rest
// unseen — and this chat then shows the single top row, so anything cut is
// invisible rather than merely demoted.
//
// Measured on five live queries, top-1 at 25 vs at 160, with 25-vs-26 run as
// the noise floor (that only ever reshuffled the same domains, never
// introduced a new one):
//
//   "SaaS website about VPN"          thevpnexperts.com     -> expressvpn.com
//   "enterprise cybersecurity"        (thehackernews.com unseen at 25) -> #2
//   "vegan recipes and plant based…"  cleancookingcaitlin   -> vegetariantimes.com
//   "sites about electric cars…"      ev.com                -> insideevs.com
//   "personal finance for young…"     yourpfpro.com         -> juststartinvesting.com
//
// Every one of those winners was retrieved by the vector branch and cut
// before ranking. It costs no latency: the reranker splits the shortlist into
// concurrent 40-candidate batches, so 160 measured 3.4-4.6s against 3.4-6.7s
// at 25.
const RERANK_SHORTLIST_SIZE = 160;

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

/**
 * Whether this request carries a usable session. Only ever relaxes the free
 * rate limit — it grants no access to anything, so a verification failure
 * degrading to "signed out" costs the caller a quota slot at worst.
 */
async function isSignedIn(): Promise<boolean> {
  try {
    const session = (await cookies()).get("session")?.value;
    if (!session) return false;
    await verifySession(session);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signedIn = await isSignedIn();
  const ip = getIp(req);
  const { allowed, remaining } = signedIn
    ? { allowed: true, remaining: MAX_SEARCHES }
    : checkRateLimit(ip);
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
    // The reranker already scores the whole shortlist regardless of
    // finalResultSize (that param only slices the sorted result afterward),
    // so asking for 5 instead of 1 costs no extra model time — just a few
    // more pricing-join rows. The single best match is still all that's ever
    // shown as a "found it" offer; the other 4 exist only so a low-relevance
    // search can suggest categories that are actually in the catalog, rather
    // than leaving the user with only a name-brand-less "no match" message.
    const [onTopic, { results, lowRelevance }] = await Promise.all([
      isOnTopicQuery(query),
      searchCatalog({ query, finalResultSize: 5, claudeShortlistSize: RERANK_SHORTLIST_SIZE }),
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
