export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";

// Files a request against the existing support_tickets table instead of
// relying on a mailto: link — mailto silently does nothing when the browser
// has no registered mail handler, and even when it works the request never
// lands anywhere queryable on our side.
export async function POST(req: NextRequest) {
  try {
    const session = req.cookies.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const userId = decoded.uid;

    const bodyJson = await req.json() as { topic?: string; subject?: string; message?: string };
    const { topic, subject, message } = bodyJson;

    if (!topic || !subject || !message) {
      return NextResponse.json({ error: "Missing topic, subject, or message." }, { status: 400 });
    }

    const [ticket] = await db
      .insert(supportTickets)
      .values({ userId, topic, subject, message })
      .returning({ id: supportTickets.id });

    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (err) {
    console.error("[/api/developers/support-request]", err);
    return NextResponse.json({ error: "Could not submit request." }, { status: 500 });
  }
}
