import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The marketplace registry, as an admin list.
 *
 * `trusted` is the only editable field here today. It exists because the
 * public API sells anonymized pricing — a buyer never learns which
 * marketplace a price came from, so they have no way to judge it themselves.
 * recommended_price is the API's answer, and it is the cheapest offer among
 * the marketplaces an admin has vetted here.
 *
 * Live offer counts come along so the decision isn't made blind: marking a
 * marketplace with four listings trusted moves almost nothing, marking one
 * with 90,000 moves the recommended price on a large slice of the catalog.
 */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const rows = await db.execute(sql`
      SELECT
        m.id,
        m.name,
        m.display_name,
        m.enabled,
        m.trusted,
        m.affiliate_url IS NOT NULL AS has_affiliate,
        COALESCE(c.offer_count, 0)::int AS offer_count
      FROM marketplaces m
      LEFT JOIN (
        SELECT lower(marketplace_name) AS name, COUNT(*)::int AS offer_count
        FROM marketplace_offers
        WHERE available = true
        GROUP BY lower(marketplace_name)
      ) c ON c.name = lower(m.name)
      ORDER BY m.trusted DESC, offer_count DESC, m.name ASC
    `);
    return NextResponse.json({ marketplaces: rows.rows });
  } catch (err) {
    console.error("[/api/admin/marketplaces GET]", err);
    return NextResponse.json({ error: "Failed to load marketplaces" }, { status: 500 });
  }
}

/** PATCH — set the trusted flag on one marketplace. */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; trusted?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || typeof body.trusted !== "boolean") {
    return NextResponse.json({ error: "id and a boolean trusted are required" }, { status: 400 });
  }

  try {
    const updated = await db.execute(sql`
      UPDATE marketplaces
      SET trusted = ${body.trusted}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, trusted
    `);
    if (updated.rows.length === 0) {
      return NextResponse.json({ error: "Marketplace not found" }, { status: 404 });
    }
    return NextResponse.json({ marketplace: updated.rows[0] });
  } catch (err) {
    console.error("[/api/admin/marketplaces PATCH]", err);
    return NextResponse.json({ error: "Failed to update marketplace" }, { status: 500 });
  }
}
