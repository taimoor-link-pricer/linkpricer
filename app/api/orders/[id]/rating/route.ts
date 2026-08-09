import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, orderRatings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";

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

    const [rating] = await db.select().from(orderRatings).where(eq(orderRatings.orderId, id)).limit(1);
    return NextResponse.json({ rating: rating ?? null });
  } catch (err) {
    console.error("[/api/orders/[id]/rating GET]", err);
    return NextResponse.json({ error: "Failed to fetch rating" }, { status: 500 });
  }
}

const postSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const order = await loadOwnedOrder(id, user);
    if (order === null) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (order.status !== "complete") {
      return NextResponse.json({ error: "Order must be complete before it can be rated" }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    try {
      const [inserted] = await db
        .insert(orderRatings)
        .values({
          orderId: id,
          userId: user.uid,
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
        })
        .returning();
      return NextResponse.json({ rating: inserted });
    } catch (err: unknown) {
      // Drizzle's query builder (unlike a raw db.execute(sql\`...\`) call) wraps
      // the driver error — the actual Postgres error (with .code) lands on
      // err.cause, not err itself. Checking only err.code (the pattern used by
      // raw-SQL routes like regenerate-key/route.ts) silently misses this and
      // falls through to a raw 500 instead of the intended 409.
      const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505") {
        return NextResponse.json({ error: "This order has already been rated" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[/api/orders/[id]/rating POST]", err);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }
}
