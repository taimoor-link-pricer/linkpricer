import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reviewNotes: z.string() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const [updated] = await db
      .update(orders)
      .set({ reviewNotes: parsed.data.reviewNotes })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("[/api/admin/orders/[id]/notes PATCH]", err);
    return NextResponse.json({ error: "Failed to update notes" }, { status: 500 });
  }
}
