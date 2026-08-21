import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { db } from "@/lib/db";
import { marketplaces, marketplaceClicks, domains } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// "Buy direct" destination resolver for the checkout/analyze flow.
//
// The redirect target is looked up server-side and never sent to the browser,
// for three reasons:
//   1. Most destinations are revenue-bearing affiliate links. Shipping them
//      in the search response would let anyone scrape the whole referral set
//      out of the page, or strip the ref code before visiting.
//   2. The click has to be recorded (marketplace_clicks) at the moment of
//      intent. Doing that here makes logging guaranteed rather than a
//      fire-and-forget beacon the browser may drop on unload.
//   3. Because this is a real <a href> navigation rather than a scripted
//      window.open() after an await, it can't be eaten by a popup blocker.
//
// NOTE: this is deliberately NOT an open redirect. The destination comes only
// from the `marketplaces` table, keyed by name -- a caller cannot supply a URL,
// only pick which known marketplace to be sent to.

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    // Bounce through login and come back, so a signed-out click doesn't
    // silently dead-end on a JSON 401 in a fresh tab.
    const back = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?redirect=${back}`, req.url));
  }

  const name = req.nextUrl.searchParams.get("marketplace")?.trim();
  const domain = req.nextUrl.searchParams.get("domain")?.trim() ?? null;

  if (!name) {
    return NextResponse.json({ error: "marketplace is required" }, { status: 400 });
  }

  const [row] = await db
    .select({
      name: marketplaces.name,
      homepageUrl: marketplaces.homepageUrl,
      affiliateUrl: marketplaces.affiliateUrl,
      enabled: marketplaces.enabled,
    })
    .from(marketplaces)
    .where(eq(marketplaces.name, name))
    .limit(1);

  if (!row || !row.enabled) {
    return NextResponse.json({ error: `Unknown marketplace: ${name}` }, { status: 404 });
  }

  // Affiliate link when we have a deal (30 of 57 today), plain homepage
  // otherwise -- both are curated values from the registry, never derived
  // from the hostname, which is wrong often enough to matter (ereferer.com
  // only resolves as en.ereferer.com, cp.adsy.com pays out via ref.adsy.com).
  const destination = row.affiliateUrl ?? row.homepageUrl;

  // Defense in depth: the destination is admin-controlled, not user-supplied,
  // but a malformed row must not turn this into an open redirect to
  // javascript: or a relative path that lands back inside the app.
  let parsed: URL;
  try {
    parsed = new URL(destination);
  } catch {
    return NextResponse.json({ error: "Marketplace has an invalid destination URL" }, { status: 500 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Marketplace has an invalid destination URL" }, { status: 500 });
  }

  // Click logging is best-effort: a logging failure must never cost the user
  // their redirect (or, worse, the affiliate conversion behind it).
  try {
    let domainId: string | null = null;
    if (domain) {
      const [d] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(sql`LOWER(${domains.domain}) = ${domain.toLowerCase()}`)
        .limit(1);
      domainId = d?.id ?? null;
    }
    await db.insert(marketplaceClicks).values({
      userId: user.uid,
      domainId,
      domain: domain ?? "",
      marketplaceName: row.name,
      marketplaceUrl: parsed.toString(),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });
  } catch (err) {
    console.error("[marketplace-redirect] click logging failed", err);
  }

  return NextResponse.redirect(parsed.toString(), { status: 302 });
}
