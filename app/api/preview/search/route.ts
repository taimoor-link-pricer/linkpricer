import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dominicLiveCatalog } from "@/lib/db/schema";
import { ilike, asc } from "drizzle-orm";

const MAX_SEARCHES = 5;
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

export async function GET(req: NextRequest) {
  const domain = new URL(req.url).searchParams.get("domain")?.trim() ?? "";

  if (domain.length < 2 || domain.length > 100) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const ip = getIp(req);
  const { allowed, remaining } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const results = await db
      .select({
        domain: dominicLiveCatalog.domain,
        price: dominicLiveCatalog.price,
        currency: dominicLiveCatalog.currency,
        dr: dominicLiveCatalog.dr,
        monthlyTraffic: dominicLiveCatalog.monthlyTraffic,
      })
      .from(dominicLiveCatalog)
      .where(ilike(dominicLiveCatalog.domain, `%${domain}%`))
      .orderBy(asc(dominicLiveCatalog.price))
      .limit(3);

    return NextResponse.json({ results, remaining });
  } catch (err) {
    console.error("[/api/preview/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
