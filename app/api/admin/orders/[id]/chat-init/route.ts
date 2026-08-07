import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

// Admin-side counterpart to /api/orders/[id]/chat-init — same self-heal
// mirror write, gated by admin session instead of order ownership.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

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
    console.error("[/api/admin/orders/[id]/chat-init POST]", err);
    return NextResponse.json({ error: "Failed to initialize chat" }, { status: 500 });
  }
}
