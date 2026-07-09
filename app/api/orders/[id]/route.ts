import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, linkMonitors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { CLIENT_ORDER_ACTIONS, CLIENT_ACTION_TRANSITIONS, type OrderStatus } from "@/lib/orders/types";
import { recordOrderEvent, getOrderEvents, ORDER_EVENT_TYPES, type OrderStatusChangedMeta } from "@/lib/orders/events";
import { getOrderMetaExt, withOrderMetaExt } from "@/lib/orders/metadata";

export const dynamic = "force-dynamic";

async function loadOwnedOrder(orderId: string, user: { uid: string; companyId: string | null }) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const owns = order.userId === user.uid || (!!user.companyId && order.companyId === user.companyId);
  if (!owns) return "forbidden" as const;
  return order;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const order = await loadOwnedOrder(id, user);
    if (order === null) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [monitor] = await db.select().from(linkMonitors).where(eq(linkMonitors.orderId, id)).limit(1);
    const statusHistory = await getOrderEvents(id, ORDER_EVENT_TYPES.statusChanged);

    return NextResponse.json({ order, monitor: monitor ?? null, statusHistory });
  } catch (err) {
    console.error("[/api/orders/[id] GET]", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

const patchSchema = z.object({
  action: z.enum(CLIENT_ORDER_ACTIONS),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const order = await loadOwnedOrder(id, user);
    if (order === null) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const transition = CLIENT_ACTION_TRANSITIONS[parsed.data.action];
    if (!transition.from.includes(order.status as OrderStatus)) {
      return NextResponse.json(
        { error: `Cannot perform '${parsed.data.action}' while order is '${order.status}'` },
        { status: 409 }
      );
    }

    const ext = getOrderMetaExt(order.snapshotOfferMetadata);
    const patch: Partial<typeof order> = { status: transition.to };

    if (parsed.data.action === "accept_price_increase") {
      if (!ext.pendingPriceAmount) {
        return NextResponse.json({ error: "No pending price increase on this order" }, { status: 409 });
      }
      patch.selectedPrice = String(ext.pendingPriceAmount);
      patch.totalAmount = String(ext.pendingPriceAmount);
      patch.snapshotOfferMetadata = withOrderMetaExt(order.snapshotOfferMetadata, {
        pendingPriceAmount: null,
        pendingPriceReason: null,
      });
    }
    if (parsed.data.action === "cancel" || parsed.data.action === "decline") {
      patch.snapshotOfferMetadata = withOrderMetaExt(patch.snapshotOfferMetadata ?? order.snapshotOfferMetadata, {
        cancelledReason: `Cancelled by client (${parsed.data.action})`,
      });
    }

    const [updated] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();

    const eventMeta: OrderStatusChangedMeta = {
      orderId: id,
      fromStatus: order.status,
      toStatus: transition.to,
      actorId: user.uid,
      actorRole: "client",
    };
    await recordOrderEvent(db, {
      orderOwnerUserId: order.userId ?? user.uid,
      eventType: ORDER_EVENT_TYPES.statusChanged,
      metadata: eventMeta,
    });

    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("[/api/orders/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
