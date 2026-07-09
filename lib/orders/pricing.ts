import { db } from "@/lib/db";
import { domains, marketplaceOffers, supplierOffers, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { PriceType } from "./types";

export type ResolvedOffer = {
  offerId: string;
  marketplaceName: string;
  marketplaceUrl: string | null;
  currency: string;
  showPrice: boolean;
  deliveryTimeDays: number | null;
  qualityScore: number | null;
  requirements: string | null;
  minPrice: string | null;
  priceByType: Record<PriceType, string | null>;
  domain: { id: string | null; domain: string };
};

export class OfferResolutionError extends Error {}

function normalizeDomain(raw: string): string {
  return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").trim();
}

// Never trust a price sent by the client — the cart only carries a display preview.
// Re-resolve the real offer server-side by the (domain, offerName, offerType) tuple
// the client saw, mirroring the old app's DB-offer -> vendor-offer fallback chain.
export async function resolveOffer(params: {
  domain: string;
  offerName: string;
  offerType: "API" | "Vendor" | "DB";
}): Promise<ResolvedOffer> {
  const domain = normalizeDomain(params.domain);

  if (params.offerType === "Vendor") {
    const rows = await db
      .select({
        offer: supplierOffers,
        vendorName: users.vendorName,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(supplierOffers)
      .innerJoin(users, eq(users.id, supplierOffers.vendorUserId))
      .where(
        and(
          sql`LOWER(${supplierOffers.domain}) = ${domain}`,
          eq(supplierOffers.status, "active"),
          eq(supplierOffers.isActive, true)
        )
      );

    const match = rows.find((r) => {
      const label = r.vendorName || [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || "Vendor";
      return `Vendor: ${label}` === params.offerName;
    });

    if (!match) throw new OfferResolutionError(`Vendor offer not found for ${domain}`);

    let domainRow: { id: string; domain: string } | null = null;
    if (match.offer.domainId) {
      const [d] = await db.select().from(domains).where(eq(domains.id, match.offer.domainId)).limit(1);
      if (d) domainRow = { id: d.id, domain: d.domain };
    }
    if (!domainRow) {
      const [d] = await db.select().from(domains).where(sql`LOWER(${domains.domain}) = ${domain}`).limit(1);
      if (d) domainRow = { id: d.id, domain: d.domain };
    }

    const o = match.offer;
    return {
      offerId: o.id,
      marketplaceName: params.offerName,
      marketplaceUrl: null,
      currency: o.currency,
      showPrice: true,
      deliveryTimeDays: o.deliveryTimeDays,
      qualityScore: null,
      requirements: o.notes,
      minPrice: o.minPrice,
      priceByType: {
        base: o.minPrice,
        gambling: o.gamblingMinPrice,
        adult: o.adultMinPrice,
        cbd: o.cbdMinPrice,
        loan: o.loanMinPrice,
        dating: o.datingMinPrice,
        crypto: o.cryptoMinPrice,
        tradingForex: o.tradingForexMinPrice,
      },
      domain: domainRow ?? { id: null, domain },
    };
  }

  // "DB" (and, for now, "API" — no live connector path is wired up yet) both resolve
  // against marketplace_offers.
  const [row] = await db
    .select({ offer: marketplaceOffers, domain: domains })
    .from(marketplaceOffers)
    .innerJoin(domains, eq(domains.id, marketplaceOffers.domainId))
    .where(
      and(
        sql`LOWER(${domains.domain}) = ${domain}`,
        eq(marketplaceOffers.marketplaceName, params.offerName),
        eq(marketplaceOffers.available, true)
      )
    )
    .limit(1);

  if (!row) throw new OfferResolutionError(`Marketplace offer not found for ${domain} / ${params.offerName}`);

  const o = row.offer;
  return {
    offerId: o.id,
    marketplaceName: o.marketplaceName,
    marketplaceUrl: o.marketplaceUrl,
    currency: o.currency,
    showPrice: o.showPrice,
    deliveryTimeDays: o.deliveryTimeDays,
    qualityScore: o.qualityScore,
    requirements: o.requirements,
    minPrice: o.minPrice,
    priceByType: {
      base: o.minPrice,
      gambling: o.gamblingMinPrice,
      adult: o.adultMinPrice,
      cbd: o.cbdMinPrice,
      loan: o.loanMinPrice,
      dating: o.datingMinPrice,
      crypto: o.cryptoMinPrice,
      tradingForex: o.tradingForexMinPrice,
    },
    domain: { id: row.domain.id, domain: row.domain.domain },
  };
}

export type OrderPricing = {
  selectedBasePriceCents: number;
  contentPriceCents: number;
  managementFeeCents: number;
  totalCents: number;
};

// Integer-cent math throughout to avoid float rounding errors — ported from the old
// app's order.routes.ts.
export function computeOrderPricing(params: {
  offer: ResolvedOffer;
  priceType: PriceType;
  orderType: "managed" | "direct";
  contentOption: "provided" | "uploaded" | "url";
  wordCount: number | null;
}): OrderPricing {
  const rawPrice = params.offer.priceByType[params.priceType] ?? params.offer.priceByType.base;
  const selectedBasePrice = rawPrice ? parseFloat(rawPrice) : 0;
  const selectedBasePriceCents = Math.round(selectedBasePrice * 100);

  const contentPriceCents =
    params.contentOption === "provided" ? Math.round((params.wordCount ?? 750) * 5) : 0;

  const subtotalCents = selectedBasePriceCents + contentPriceCents;
  const managementFeeCents = params.orderType === "managed" ? Math.round(subtotalCents * 0.15) : 0;
  const totalCents = subtotalCents + managementFeeCents;

  return { selectedBasePriceCents, contentPriceCents, managementFeeCents, totalCents };
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
