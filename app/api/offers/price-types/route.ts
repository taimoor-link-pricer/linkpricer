import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/get-current-user";
import { resolveOffer, OfferResolutionError } from "@/lib/orders/pricing";

export const dynamic = "force-dynamic";

// Read-only support endpoint for checkout's pricing-niche picker: given the
// same (domain, offerName, offerType) tuple a cart item already carries,
// re-resolves the offer server-side (same resolveOffer POST /api/orders
// itself uses to price the real order) and hands back which PriceType
// columns actually have a price set, so the client can build a dropdown
// scoped to niches this specific offer supports instead of the full fixed
// PRICE_TYPES list — and so it can show the right price live if the
// customer switches niches before placing the order.
const itemSchema = z.object({
  domain: z.string().min(1),
  offerName: z.string().min(1),
  offerType: z.enum(["API", "Vendor", "DB"]),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });

    const results = await Promise.all(
      parsed.data.items.map(async (item) => {
        try {
          const offer = await resolveOffer(item);
          return { priceByType: offer.priceByType, error: null as string | null };
        } catch (e) {
          const reason = e instanceof OfferResolutionError ? e.message : "Offer could not be resolved";
          return { priceByType: null, error: reason };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[/api/offers/price-types POST]", err);
    return NextResponse.json({ error: "Failed to resolve price types" }, { status: 500 });
  }
}
