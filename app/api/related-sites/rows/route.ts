import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/verify-session";
import { fetchResultRowsByIds } from "@/lib/search/catalog-search";

// One page of Related Sites rows, by id. The search returns the full list of
// related sites as ids (see ../tail/route.ts); the offers, prices and metrics
// for a row are only fetched here, when a page containing it is opened or
// exported. Showing a thousand results therefore costs the joins for the 25
// on screen, not for all of them.
export const maxDuration = 30;

// Four pages' worth — enough for the CSV export to fetch in few round trips,
// small enough that one request cannot be used to pull the whole catalogue.
const MAX_IDS = 100;

export async function POST(req: NextRequest) {
  const session = (await cookies()).get("session")?.value;
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    await verifySession(session);
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
    : [];
  if (ids.length === 0) return NextResponse.json({ rows: [] });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: `At most ${MAX_IDS} ids per request` }, { status: 400 });

  try {
    const rows = await fetchResultRowsByIds(ids);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/related-sites/rows]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load these results" }, { status: 500 });
  }
}
