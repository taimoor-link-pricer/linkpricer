export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { parseAdminKeyFields } from "@/lib/api-keys";

// PATCH — change a key's limits or expiry, or block / unblock it. Only fields
// present in the body are touched.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseAdminKeyFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  if (body.blocked !== undefined && typeof body.blocked !== "boolean") {
    return NextResponse.json({ error: "blocked must be true or false." }, { status: 400 });
  }

  const sets: SQL[] = [];
  if (f.name !== undefined) sets.push(sql`name = ${f.name}`);
  if (f.monthlyLimit !== undefined) {
    sets.push(sql`monthly_limit = ${f.monthlyLimit}`, sql`daily_limit = ${Math.ceil(f.monthlyLimit / 30)}`);
  }
  if (f.perMinuteLimit !== undefined) sets.push(sql`per_minute_limit = ${f.perMinuteLimit}`);
  if (f.expiresAt !== undefined) sets.push(sql`expires_at = ${f.expiresAt}`);
  // COALESCE keeps the original block time if an already-blocked key is blocked again.
  if (body.blocked === true) sets.push(sql`blocked_at = COALESCE(blocked_at, NOW())`);
  if (body.blocked === false) sets.push(sql`blocked_at = NULL`);

  if (sets.length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  try {
    // Revoked rows are history (a rotated or lapsed key); editing one would
    // change nothing a caller can observe.
    const updated = await db.execute(sql`
      UPDATE api_keys SET ${sql.join(sets, sql`, `)}
      WHERE id = ${id} AND is_active = true
      RETURNING id
    `);
    if (updated.rows.length === 0) {
      const exists = await db.execute(sql`SELECT 1 FROM api_keys WHERE id = ${id}`);
      return exists.rows.length === 0
        ? NextResponse.json({ error: "API key not found." }, { status: 404 })
        : NextResponse.json({ error: "This key has been revoked and can't be changed. Create a new key for this user instead." }, { status: 409 });
    }
    console.log(`[/api/admin/api-keys/${id}] updated by admin ${admin.uid}: ${Object.keys(body).join(", ")}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/api-keys/:id PATCH]", err);
    return NextResponse.json({ error: "Failed to update the API key." }, { status: 500 });
  }
}
