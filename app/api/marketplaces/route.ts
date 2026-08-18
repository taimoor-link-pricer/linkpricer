import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Full marketplace registry for the Domain Analysis filter panel (see
// ResultsTable in dashboard/search/page.tsx) — every marketplace_name that
// has ever appeared in marketplace_offers, independent of whether the
// currently-searched domain(s) happen to have a live offer there. Kept as
// its own endpoint (rather than derived from the current search results)
// so the filter panel can list all ~57 registered marketplaces up front and
// let a user's selection persist across searches, instead of rebuilding
// itself — and silently dropping deselections — every time a new result
// set comes back.
export async function GET() {
  const result = await db.execute(
    sql`SELECT DISTINCT marketplace_name FROM marketplace_offers ORDER BY marketplace_name`
  );
  const marketplaces = result.rows.map((r) => r.marketplace_name as string);
  return NextResponse.json(
    { marketplaces },
    { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } }
  );
}
