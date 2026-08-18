import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// Stamps "the owning client has seen this order's chat up to now" on the
// same Firestore orders/{id} mirror doc the admin chat dock stamps
// adminLastReadAt on (components/admin/chat-dock.tsx) — read by
// /api/orders/unread-summary to decide the unread badge shown in the
// dashboard nav and orders list. The admin dock writes its half of this
// directly from the client, which only works because firestore.rules grants
// admins blanket update on any order; clients have no such permission (and
// shouldn't — see the rule's own comment on why `create`/`update` are closed
// to them). Going through the Admin SDK here — same as chat-init and
// mirrorOrderToFirestore already do — gets the same result without opening
// a new client-writable field in firestore.rules for this. The ownership
// check itself still has to happen somewhere trusted: reuses the exact
// userId/companyId check already used by loadOwnedOrder in
// app/api/orders/[id]/route.ts and the chat-init routes.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const [order] = await db.select({ userId: orders.userId, companyId: orders.companyId }).from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const owns = order.userId === user.uid || (!!user.companyId && order.companyId === user.companyId);
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await adminDb.collection("orders").doc(id).set(
      { clientLastReadAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/orders/[id]/mark-read POST]", err);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
