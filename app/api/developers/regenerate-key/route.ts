export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";

export async function POST(req: NextRequest) {
  try {
    // Read the cookie off the request directly — see /api/developers/me for why.
    const session = req.cookies.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const userId = decoded.uid;

    const existingRows = await db.execute(sql`
      SELECT name, daily_limit, per_minute_limit
      FROM api_keys
      WHERE user_id = ${userId} AND is_active = true
      LIMIT 1
    `);
    const existing = (existingRows.rows ?? existingRows)[0] as any;
    if (!existing) {
      return NextResponse.json({ error: "No active API key to regenerate." }, { status: 404 });
    }

    const { plain, hash } = generateApiKey();

    await db.execute(sql`
      UPDATE api_keys SET is_active = false WHERE user_id = ${userId} AND is_active = true
    `);

    await db.execute(sql`
      INSERT INTO api_keys (user_id, key_hash, name, daily_limit, per_minute_limit, is_active, plain_key_temp)
      VALUES (${userId}, ${hash}, ${existing.name}, ${existing.daily_limit}, ${existing.per_minute_limit}, true, ${plain})
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/developers/regenerate-key]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
