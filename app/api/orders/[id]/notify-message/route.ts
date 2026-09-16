import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { adminDb } from "@/lib/firebase/admin";
import { notifyOrderMessage } from "@/lib/notifications/orders";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ messageId: z.string().min(1).max(200) });

// Order chat lives in Firestore and is written straight from the browser by
// both sides (app/dashboard/orders/[id]/page.tsx and components/admin/chat-dock.tsx),
// so there is no server code path to hang a notification off. Rather than move
// the chat or add a Cloud Function in the scrapper repo, each sender pings this
// route with the id it just wrote, and the server reads that message back out
// of Firestore before notifying anyone.
//
// Reading the doc back is what makes this safe: the request carries no message
// content, only an id, so a caller cannot make us email a client text they never
// wrote. The senderId on the stored doc must also match the caller — Firestore
// rules already pin it to request.auth.uid on create.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const owns = order.userId === user.uid || (!!user.companyId && order.companyId === user.companyId);
    if (!owns && !user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const snap = await adminDb.collection("orders").doc(id).collection("messages").doc(parsed.data.messageId).get();
    if (!snap.exists) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    const msg = snap.data() as { senderId?: string; senderType?: string; senderName?: string; body?: string };
    if (msg.senderId !== user.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const senderType = msg.senderType === "admin" ? "admin" : "client";
    // An admin-typed message can only come from an admin account, whatever the
    // browser claimed when it wrote the doc.
    if (senderType === "admin" && !user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const origin = req.nextUrl.origin;
    after(() =>
      notifyOrderMessage({
        order,
        messageId: parsed.data.messageId,
        senderType,
        senderName: msg.senderName ?? null,
        preview: msg.body ?? "",
        origin,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/orders/[id]/notify-message POST]", err);
    return NextResponse.json({ error: "Failed to queue message notification" }, { status: 500 });
  }
}
