import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { recordOrderEvent, getOrderEvents, ORDER_EVENT_TYPES, type OrderMessageMeta } from "@/lib/orders/events";

export const dynamic = "force-dynamic";

async function loadOwnedOrder(orderId: string, user: { uid: string; companyId: string | null }) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const owns = order.userId === user.uid || (!!user.companyId && order.companyId === user.companyId);
  if (!owns) return "forbidden" as const;
  return order;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const order = await loadOwnedOrder(id, user);
    if (order === null) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const events = await getOrderEvents(id, ORDER_EVENT_TYPES.message);
    const messages = events.map((e) => ({ id: e.id, createdAt: e.timestamp, ...(e.metadata as OrderMessageMeta) }));

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[/api/orders/[id]/messages GET]", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

const bodySchema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const order = await loadOwnedOrder(id, user);
    if (order === null) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const meta: OrderMessageMeta = {
      orderId: id,
      senderType: "client",
      senderId: user.uid,
      senderName: user.email,
      body: parsed.data.body,
    };
    const event = await recordOrderEvent(db, {
      orderOwnerUserId: order.userId ?? user.uid,
      eventType: ORDER_EVENT_TYPES.message,
      metadata: meta,
    });

    return NextResponse.json({ message: { id: event.id, createdAt: event.timestamp, ...meta } }, { status: 201 });
  } catch (err) {
    console.error("[/api/orders/[id]/messages POST]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
