import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search/catalog-search";

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
    const { results, lowRelevance } = await searchCatalog({ query, finalResultSize: 1 });
    return NextResponse.json({ result: results[0] ?? null, lowRelevance, remaining });
  } catch (err) {
    console.error("[/api/homepage-search]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
