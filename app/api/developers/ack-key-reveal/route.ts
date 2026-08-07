export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Clears the one-time plaintext key reveal once the client has durably shown
// it to the user. This used to happen as a side effect of GET /developers/me,
// but that endpoint is read repeatedly (initial load, checkout-completion
// polling, manual "refresh usage") — any one of those reads could race the
// others and clear the key before the intended reveal ever rendered, leaving
// the user with only the masked key. Clearing is now a deliberate, explicit
// action instead of an accidental side effect of a GET.
export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const userId = decoded.uid;

    await db.execute(sql`
      UPDATE api_keys SET plain_key_temp = NULL
      WHERE user_id = ${userId} AND is_active = true
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/developers/ack-key-reveal]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
