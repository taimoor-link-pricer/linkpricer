import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { ORDER_STATUSES } from "@/lib/orders/types";
import { recordOrderEvent, ORDER_EVENT_TYPES, type OrderStatusChangedMeta } from "@/lib/orders/events";
import { getOrderMetaExt, withOrderMetaExt } from "@/lib/orders/metadata";
import { upsertLinkMonitor } from "@/lib/orders/monitor";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(ORDER_STATUSES),
  publishedUrl: z.string().url().optional(),
  pendingPriceAmount: z.number().positive().optional(),
  pendingPriceReason: z.string().optional(),
  note: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    const data = parsed.data;

    const effectivePublishedUrl = data.publishedUrl ?? order.liveUrl ?? undefined;
    if (data.status === "published" && !effectivePublishedUrl) {
      return NextResponse.json({ error: "publishedUrl is required to mark an order as published" }, { status: 400 });
    }
    if (data.status === "price_increase_requested" && data.pendingPriceAmount == null) {
      return NextResponse.json({ error: "pendingPriceAmount is required for price_increase_requested" }, { status: 400 });
    }

    const patch: Partial<typeof order> = { status: data.status };
    if (data.publishedUrl) patch.liveUrl = data.publishedUrl;
    if (data.note) patch.reviewNotes = data.note;
    if (data.status === "price_increase_requested") {
      patch.snapshotOfferMetadata = withOrderMetaExt(order.snapshotOfferMetadata, {
        pendingPriceAmount: data.pendingPriceAmount,
        pendingPriceReason: data.pendingPriceReason ?? null,
      });
    } else if (getOrderMetaExt(order.snapshotOfferMetadata).pendingPriceAmount != null) {
      // Moving to any other status — including an admin picking a status
      // directly rather than going through the client's own
      // accept_price_increase action — leaves a stale proposed price
      // sitting in ext forever otherwise, and dashboard/orders/page.tsx
      // renders `order.newPrice ?? order.price` unconditionally, so the
      // customer would keep seeing that stale/rejected amount as their
      // order total indefinitely even though totalAmount never changed.
      patch.snapshotOfferMetadata = withOrderMetaExt(order.snapshotOfferMetadata, {
        pendingPriceAmount: null,
        pendingPriceReason: null,
      });
    }

    const [updated] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();

    const eventMeta: OrderStatusChangedMeta = {
      orderId: id,
      fromStatus: order.status,
      toStatus: data.status,
      actorId: admin.uid,
      actorRole: "admin",
      note: data.note ?? null,
    };
    await recordOrderEvent(db, {
      orderOwnerUserId: order.userId ?? admin.uid,
      eventType: ORDER_EVENT_TYPES.statusChanged,
      metadata: eventMeta,
    });

    let monitor = null;
    if (data.status === "published" && effectivePublishedUrl) {
      monitor = await upsertLinkMonitor(updated, effectivePublishedUrl);
    }

    return NextResponse.json({ order: updated, monitor });
  } catch (err) {
    console.error("[/api/admin/orders/[id]/status PATCH]", err);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
