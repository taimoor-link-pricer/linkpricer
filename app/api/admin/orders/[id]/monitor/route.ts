import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { upsertLinkMonitor } from "@/lib/orders/monitor";

export const dynamic = "force-dynamic";

// Manual "Start monitoring" action — idempotent recovery path for when the
// automatic bootstrap (on transition to 'published') didn't run or the monitor
// row was deleted. Requires the order to already have a published URL set.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.liveUrl) {
      return NextResponse.json({ error: "Set the published URL on this order before starting monitoring" }, { status: 400 });
    }

    const monitor = await upsertLinkMonitor(order, order.liveUrl);
    return NextResponse.json({ monitor });
  } catch (err) {
    console.error("[/api/admin/orders/[id]/monitor POST]", err);
    return NextResponse.json({ error: "Failed to start monitoring" }, { status: 500 });
  }
}
