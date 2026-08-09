import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderRatings, orders, users, marketplaceOffers } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  source: string;
  domain: string | null;
  marketplaceName: string;
  reviewerId: string;
  reviewerEmail: string | null;
  reviewerFirstName: string | null;
  reviewerLastName: string | null;
}

export async function GET() {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Every marketplace currently in the catalog, so admins can add the
    // first review for one that has none yet — not just marketplaces that
    // already have reviews.
    const catalogRows = await db
      .selectDistinct({ marketplaceName: marketplaceOffers.marketplaceName })
      .from(marketplaceOffers);

    const reviewedName = sql<string>`COALESCE(${orders.snapshotMarketplaceName}, ${orderRatings.marketplaceName})`;
    const reviewRows = await db
      .select({
        id: orderRatings.id,
        rating: orderRatings.rating,
        comment: orderRatings.comment,
        createdAt: orderRatings.createdAt,
        source: orderRatings.source,
        domain: orders.snapshotDomain,
        marketplaceName: reviewedName,
        reviewerId: orderRatings.userId,
        reviewerEmail: users.email,
        reviewerFirstName: users.firstName,
        reviewerLastName: users.lastName,
      })
      .from(orderRatings)
      .leftJoin(orders, eq(orders.id, orderRatings.orderId))
      .innerJoin(users, eq(users.id, orderRatings.userId))
      .orderBy(sql`${orderRatings.createdAt} desc`);

    // Group in JS (not SQL) — dataset here is admin-page scale (dozens of
    // marketplaces, hundreds of reviews at most), and this needs to merge
    // two sources (catalog names + review names) that don't share a key
    // column cleanly enough for a single GROUP BY.
    const byMarketplace = new Map<string, { marketplaceName: string; reviews: ReviewRow[] }>();
    const nameKey = (n: string) => n.trim().toLowerCase();

    for (const row of catalogRows) {
      const key = nameKey(row.marketplaceName);
      if (!byMarketplace.has(key)) byMarketplace.set(key, { marketplaceName: row.marketplaceName, reviews: [] });
    }
    for (const row of reviewRows as ReviewRow[]) {
      if (!row.marketplaceName) continue;
      const key = nameKey(row.marketplaceName);
      if (!byMarketplace.has(key)) byMarketplace.set(key, { marketplaceName: row.marketplaceName, reviews: [] });
      byMarketplace.get(key)!.reviews.push(row);
    }

    const marketplaces = Array.from(byMarketplace.values())
      .map((m) => {
        const count = m.reviews.length;
        const avg = count > 0 ? m.reviews.reduce((sum, r) => sum + r.rating, 0) / count : null;
        return { marketplaceName: m.marketplaceName, avgRating: avg, ratingCount: count, reviews: m.reviews };
      })
      .sort((a, b) => b.ratingCount - a.ratingCount || a.marketplaceName.localeCompare(b.marketplaceName));

    return NextResponse.json({ marketplaces });
  } catch (err) {
    console.error("[/api/admin/reviews/marketplaces GET]", err);
    return NextResponse.json({ error: "Failed to fetch marketplace reviews" }, { status: 500 });
  }
}

const postSchema = z.object({
  marketplaceName: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

// Admin adds/updates their own review for a marketplace — not tied to any
// order (admins don't buy through the marketplace, they're endorsing/
// flagging it directly). One admin review per (admin, marketplace): editing
// an existing one updates in place rather than creating a duplicate.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

    const { marketplaceName, rating, comment } = parsed.data;

    const [existing] = await db
      .select({ id: orderRatings.id })
      .from(orderRatings)
      .where(
        and(
          isNull(orderRatings.orderId),
          eq(orderRatings.userId, admin.uid),
          eq(orderRatings.marketplaceName, marketplaceName)
        )
      )
      .limit(1);

    const [saved] = existing
      ? await db
          .update(orderRatings)
          .set({ rating, comment: comment || null })
          .where(eq(orderRatings.id, existing.id))
          .returning()
      : await db
          .insert(orderRatings)
          .values({
            orderId: null,
            userId: admin.uid,
            rating,
            comment: comment || null,
            marketplaceName,
            source: "admin",
          })
          .returning();

    return NextResponse.json({ review: saved });
  } catch (err) {
    console.error("[/api/admin/reviews/marketplaces POST]", err);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
