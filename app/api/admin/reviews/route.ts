import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderRatings, orders, users } from "@/lib/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 25;
    const search = searchParams.get("search")?.trim();

    // snapshot_marketplace_name already holds the right "who was rated" label
    // for both order types — for DB/marketplace orders it's the marketplace
    // name, for Vendor orders it's the client-facing "Vendor: <label>" string
    // set at order creation (see resolveOffer in lib/orders/pricing.ts) — so
    // no separate vendor-name lookup is needed here. Admin-added reviews have
    // no order at all (orderId null) — LEFT JOIN so they still show up here,
    // falling back to orderRatings.marketplaceName for "reviewed".
    const reviewedName = sql<string | null>`COALESCE(${orders.snapshotMarketplaceName}, ${orderRatings.marketplaceName})`;
    const conditions = search
      ? [
          or(
            ilike(orders.snapshotDomain, `%${search}%`),
            ilike(reviewedName, `%${search}%`),
            ilike(users.email, `%${search}%`),
            eq(orderRatings.orderId, search)
          )!,
        ]
      : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          id: orderRatings.id,
          rating: orderRatings.rating,
          comment: orderRatings.comment,
          createdAt: orderRatings.createdAt,
          orderId: orderRatings.orderId,
          source: orderRatings.source,
          domain: orders.snapshotDomain,
          reviewedName,
          reviewerEmail: users.email,
          reviewerFirstName: users.firstName,
          reviewerLastName: users.lastName,
        })
        .from(orderRatings)
        .leftJoin(orders, eq(orders.id, orderRatings.orderId))
        .innerJoin(users, eq(users.id, orderRatings.userId))
        .where(where)
        .orderBy(desc(orderRatings.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(orderRatings)
        .leftJoin(orders, eq(orders.id, orderRatings.orderId))
        .innerJoin(users, eq(users.id, orderRatings.userId))
        .where(where),
    ]);

    return NextResponse.json({ reviews: rows, total: count, page, pageSize });
  } catch (err) {
    console.error("[/api/admin/reviews GET]", err);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const [deleted] = await db.delete(orderRatings).where(eq(orderRatings.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/reviews DELETE]", err);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
