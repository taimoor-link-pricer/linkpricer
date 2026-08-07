import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

// Idempotent: ensures the Firestore orders/{id} mirror doc exists before the
// client attaches a real-time listener for that order's chat. Needed both
// for freshly created orders (creation already mirrors, so this is a no-op)
// and for orders placed before Firestore chat existed — those self-heal the
// first time their chat is opened, no manual backfill required.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const owns = order.userId === user.uid || (!!user.companyId && order.companyId === user.companyId);
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await adminDb
      .collection("orders")
      .doc(id)
      .set(
        {
          userId: order.userId,
          companyId: order.companyId,
          domain: order.snapshotDomain,
          title: order.articleTitle,
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/orders/[id]/chat-init POST]", err);
    return NextResponse.json({ error: "Failed to initialize chat" }, { status: 500 });
  }
}
