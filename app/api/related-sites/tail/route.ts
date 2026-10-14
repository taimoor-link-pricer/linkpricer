import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/verify-session";
import { searchCatalogTail, type CatalogSearchFilters, type CatalogTailAnchor } from "@/lib/search/catalog-search";

// The rest of a Related Sites search: every related site the first page did
// not already return, as ids with an estimated match %. The page calls this
// in the background once the first page is on screen, which is why it is its
// own route — a query nobody has run recently takes 7-27s here (cold index
// pages), and that wait must not sit in front of the results the user is
// already reading.
//
// Unmetered, like every search that does not reach Ahrefs: this runs no model
// and reads the "already links to me" list from cache only, so it cannot
// spend anything the first page's search was not already charged for.
export const maxDuration = 60;

const MAX_EXCLUDE_IDS = 1000;

interface TailBody {
  query?: string;
  filters?: CatalogSearchFilters;
  ownSite?: string;
  hideLinked?: boolean;
  anchor?: CatalogTailAnchor;
  excludeIds?: unknown;
  quick?: unknown;
}

export async function POST(req: NextRequest) {
  const session = (await cookies()).get("session")?.value;
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    await verifySession(session);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: TailBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });
  if (!body.anchor || typeof body.anchor !== "object") {
    return NextResponse.json({ error: "anchor is required" }, { status: 400 });
  }
  const excludeIds = Array.isArray(body.excludeIds)
    ? body.excludeIds.filter((id): id is string => typeof id === "string").slice(0, MAX_EXCLUDE_IDS)
    : [];

  try {
    const tail = await searchCatalogTail({
      query,
      filters: body.filters,
      ownSite: body.ownSite,
      hideLinked: body.hideLinked,
      anchor: body.anchor,
      excludeIds,
      // The page asks twice: a quick first pass (the nearest few hundred, so
      // a count can be shown soon), then the full list if that pass says
      // more remain.
      quick: body.quick === true,
    });
    // null = the list could not be loaded (timeout, connection). Reported as
    // a failure rather than an empty list so the page keeps saying "these
    // are the results we have" instead of "there are no more".
    if (!tail) return NextResponse.json({ error: "More results are unavailable right now" }, { status: 503 });
    return NextResponse.json(tail);
  } catch (err) {
    console.error("[/api/related-sites/tail]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "More results are unavailable right now" }, { status: 500 });
  }
}
