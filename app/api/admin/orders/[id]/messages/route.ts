import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { recordOrderEvent, ORDER_EVENT_TYPES, type OrderMessageMeta } from "@/lib/orders/events";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!order.userId) return NextResponse.json({ error: "Order has no owning user" }, { status: 400 });

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const [adminUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, admin.uid)).limit(1);

    const meta: OrderMessageMeta = {
      orderId: id,
      senderType: "admin",
      senderId: admin.uid,
      senderName: adminUser?.email ?? "Linkpricer team",
      body: parsed.data.body,
    };
    const event = await recordOrderEvent(db, {
      orderOwnerUserId: order.userId,
      eventType: ORDER_EVENT_TYPES.message,
      metadata: meta,
    });

    return NextResponse.json({ message: { id: event.id, createdAt: event.timestamp, ...meta } }, { status: 201 });
  } catch (err) {
    console.error("[/api/admin/orders/[id]/messages POST]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
