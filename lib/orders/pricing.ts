import { db } from "@/lib/db";
import { domains, marketplaceOffers, supplierOffers, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { PriceType } from "./types";
import { contentPriceCents, DEFAULT_CONTENT_WORD_COUNT } from "./types";
import { getUsdRates, toUsd } from "@/lib/currency";

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

// Marketplace offers are stored in whatever currency the marketplace quotes
// (EUR, GBP, ...), but Analyze and the public pricing API both convert to
// USD before ever showing a customer a number — checkout's "$" estimate is
// built from those already-converted figures. This re-resolves the same
// offer from scratch for the actual charge, so it has to convert here too,
// or the order ends up persisted (and invoiced) in the marketplace's raw
// currency while every price the customer saw was USD.
function usdStr(raw: string | null, currency: string, rates: Record<string, number>): string | null {
  if (raw == null) return null;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return null;
  const usd = toUsd(n, currency, rates);
  return usd == null ? null : usd.toFixed(2);
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
    const rates = await getUsdRates();
    return {
      offerId: o.id,
      marketplaceName: params.offerName,
      marketplaceUrl: null,
      currency: "USD",
      showPrice: true,
      deliveryTimeDays: o.deliveryTimeDays,
      qualityScore: null,
      requirements: o.notes,
      minPrice: usdStr(o.minPrice, o.currency, rates),
      priceByType: {
        base: usdStr(o.minPrice, o.currency, rates),
        gambling: usdStr(o.gamblingMinPrice, o.currency, rates),
        adult: usdStr(o.adultMinPrice, o.currency, rates),
        cbd: usdStr(o.cbdMinPrice, o.currency, rates),
        loan: usdStr(o.loanMinPrice, o.currency, rates),
        dating: usdStr(o.datingMinPrice, o.currency, rates),
        crypto: usdStr(o.cryptoMinPrice, o.currency, rates),
        tradingForex: usdStr(o.tradingForexMinPrice, o.currency, rates),
        insertion: usdStr(o.linkInsertionMinPrice, o.currency, rates),
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
  const rates = await getUsdRates();
  return {
    offerId: o.id,
    marketplaceName: o.marketplaceName,
    marketplaceUrl: o.marketplaceUrl,
    currency: "USD",
    showPrice: o.showPrice,
    deliveryTimeDays: o.deliveryTimeDays,
    qualityScore: o.qualityScore,
    requirements: o.requirements,
    minPrice: usdStr(o.minPrice, o.currency, rates),
    priceByType: {
      base: usdStr(o.minPrice, o.currency, rates),
      gambling: usdStr(o.gamblingMinPrice, o.currency, rates),
      adult: usdStr(o.adultMinPrice, o.currency, rates),
      cbd: usdStr(o.cbdMinPrice, o.currency, rates),
      loan: usdStr(o.loanMinPrice, o.currency, rates),
      dating: usdStr(o.datingMinPrice, o.currency, rates),
      crypto: usdStr(o.cryptoMinPrice, o.currency, rates),
      tradingForex: usdStr(o.tradingForexMinPrice, o.currency, rates),
      insertion: usdStr(o.linkInsertionMinPrice, o.currency, rates),
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

  const contentCents =
    params.contentOption === "provided" ? contentPriceCents(params.wordCount ?? DEFAULT_CONTENT_WORD_COUNT) : 0;

  const subtotalCents = selectedBasePriceCents + contentCents;
  const managementFeeCents = params.orderType === "managed" ? Math.round(subtotalCents * 0.15) : 0;
  const totalCents = subtotalCents + managementFeeCents;

  return { selectedBasePriceCents, contentPriceCents: contentCents, managementFeeCents, totalCents };
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
