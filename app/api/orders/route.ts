import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { ORDER_TYPES, PRICE_TYPES, CONTENT_OPTIONS } from "@/lib/orders/types";
import { computeOrderPricing, centsToAmount, OfferResolutionError, resolveOffer } from "@/lib/orders/pricing";
import { recordOrderEvent, ORDER_EVENT_TYPES, type OrderStatusChangedMeta } from "@/lib/orders/events";
import { withOrderMetaExt } from "@/lib/orders/metadata";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  domain: z.string().min(1),
  offerName: z.string().min(1),
  offerType: z.enum(["API", "Vendor", "DB"]),
  orderType: z.enum(ORDER_TYPES),
  priceType: z.enum(PRICE_TYPES).default("base"),
  articleTitle: z.string().optional(),
  targetUrl: z.string().url(),
  anchorText: z.string().min(1),
  contentNiche: z.string().optional(),
  contentTone: z.string().optional(),
  contentOption: z.enum(CONTENT_OPTIONS),
  wordCount: z.number().int().min(300).max(5000).optional(),
  requirements: z.string().optional(),
  articleUrl: z.string().url().optional(),
  uploadedFileName: z.string().optional(),
  originalFileName: z.string().optional(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 20;
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const visibility = user.companyId
      ? or(eq(orders.userId, user.uid), eq(orders.companyId, user.companyId))
      : eq(orders.userId, user.uid);

    const conditions = [visibility];
    if (status && status !== "all") conditions.push(eq(orders.status, status));
    if (search) {
      conditions.push(
        or(
          ilike(orders.snapshotDomain, `%${search}%`),
          ilike(orders.articleTitle, `%${search}%`),
          ilike(orders.targetUrl, `%${search}%`),
          eq(orders.id, search)
        )!
      );
    }

    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ total: sql<number>`count(*)::int` }).from(orders).where(where),
    ]);

    return NextResponse.json({
      orders: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error("[/api/orders GET]", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!user.email) return NextResponse.json({ error: "Account is missing an email address" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
    }

    // Resolve + price every item first. Nothing is written to the DB until every
    // item in the batch has passed validation, so a bad item rejects the whole
    // request with zero partial orders created. (Note: the neon-http driver used
    // by this app has no multi-statement transaction support, so the inserts
    // below still run sequentially rather than inside a single DB transaction —
    // this validate-then-insert ordering is what keeps the common failure modes,
    // like a bad price or missing offer, from ever creating a partial batch.)
    const resolved: Array<{
      item: z.infer<typeof itemSchema>;
      offer: Awaited<ReturnType<typeof resolveOffer>>;
      pricing: ReturnType<typeof computeOrderPricing>;
    }> = [];

    for (let i = 0; i < parsed.data.items.length; i++) {
      const item = parsed.data.items[i];

      if (item.contentOption === "provided" && !item.wordCount) {
        return NextResponse.json(
          { error: "Validation failed", details: [{ index: i, domain: item.domain, reason: "wordCount is required when contentOption is 'provided'" }] },
          { status: 400 }
        );
      }
      if (item.contentOption === "url" && !item.articleUrl) {
        return NextResponse.json(
          { error: "Validation failed", details: [{ index: i, domain: item.domain, reason: "articleUrl is required when contentOption is 'url'" }] },
          { status: 400 }
        );
      }
      if (item.contentOption === "uploaded" && !item.uploadedFileName) {
        return NextResponse.json(
          { error: "Validation failed", details: [{ index: i, domain: item.domain, reason: "uploadedFileName is required when contentOption is 'uploaded'" }] },
          { status: 400 }
        );
      }

      let offer;
      try {
        offer = await resolveOffer({ domain: item.domain, offerName: item.offerName, offerType: item.offerType });
      } catch (e) {
        const reason = e instanceof OfferResolutionError ? e.message : "Offer could not be resolved";
        return NextResponse.json({ error: "Offer not found", details: [{ index: i, domain: item.domain, reason }] }, { status: 400 });
      }

      if (!offer.showPrice) {
        return NextResponse.json(
          { error: "Price not available", details: [{ index: i, domain: item.domain, reason: "This offer does not have public pricing." }] },
          { status: 400 }
        );
      }

      const pricing = computeOrderPricing({
        offer,
        priceType: item.priceType,
        orderType: item.orderType,
        contentOption: item.contentOption,
        wordCount: item.wordCount ?? null,
      });

      if (pricing.selectedBasePriceCents <= 0) {
        return NextResponse.json(
          { error: "Invalid price", details: [{ index: i, domain: item.domain, reason: "This offer does not have valid pricing information." }] },
          { status: 400 }
        );
      }

      resolved.push({ item, offer, pricing });
    }

    const createdOrders = [];
    for (const { item, offer, pricing } of resolved) {
      const initialStatus = item.orderType === "managed" ? "confirming_with_marketplace" : "approved";

      const [order] = await db
        .insert(orders)
        .values({
          userId: user.uid,
          companyId: user.companyId ?? undefined,
          offerId: offer.offerId,
          status: initialStatus,
          orderType: item.orderType,
          totalAmount: centsToAmount(pricing.totalCents),
          snapshotDomain: offer.domain.domain,
          snapshotMarketplaceName: offer.marketplaceName,
          snapshotMarketplaceUrl: offer.marketplaceUrl,
          snapshotCurrency: offer.currency,
          snapshotOfferMetadata: withOrderMetaExt(
            {
              deliveryTime: offer.deliveryTimeDays,
              qualityScore: offer.qualityScore,
              requirements: offer.requirements,
              minPrice: offer.minPrice,
            },
            {
              contentNiche: item.contentNiche ?? null,
              contentTone: item.contentTone ?? null,
            }
          ),
          priceCapturedAt: new Date().toISOString(),
          contentOption: item.contentOption,
          wordCount: item.contentOption === "provided" ? item.wordCount ?? 750 : null,
          contentPrice: centsToAmount(pricing.contentPriceCents),
          uploadedFileName: item.uploadedFileName,
          originalFileName: item.originalFileName,
          articleUrl: item.articleUrl,
          email: user.email,
          articleTitle: item.articleTitle,
          targetUrl: item.targetUrl,
          anchorText: item.anchorText,
          requirements: item.requirements,
          priceType: item.priceType,
          selectedPrice: centsToAmount(pricing.selectedBasePriceCents),
        })
        .returning();

      const eventMeta: OrderStatusChangedMeta = {
        orderId: order.id,
        fromStatus: null,
        toStatus: initialStatus,
        actorId: user.uid,
        actorRole: "system",
        note: "Order created",
      };
      await recordOrderEvent(db, {
        orderOwnerUserId: user.uid,
        eventType: ORDER_EVENT_TYPES.statusChanged,
        metadata: eventMeta,
      });

      createdOrders.push(order);
    }

    return NextResponse.json({ orders: createdOrders }, { status: 201 });
  } catch (err) {
    console.error("[/api/orders POST]", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
