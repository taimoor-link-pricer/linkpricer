/**
 * The published response body, as a pure function.
 *
 * Kept out of the route handler deliberately. The shape of this object is the
 * actual product — the thing an integrator writes code against — and it
 * should be assertable without a database, a request or a quota claim.
 * lib/public-api/contract.test.ts pins it field by field on top of this.
 */

import {
  aggregatePricing,
  type NicheId,
  type NichePricing,
  type RawOffer,
} from "@/lib/public-api/pricing";
import { FEE_PERCENT, minFeeCents } from "@/lib/pricing/fee";

/** The metrics block. */
export interface PublicMetrics {
  domain_rating: number | null;
  organic_traffic: number | null;
  ref_domains: number | null;
  country: string | null;
}

export interface PricingBody {
  domain: string;
  found: boolean;
  currency: "USD";
  fee: { percent: number; minimum_usd: number };
  pricing: Record<string, NichePricing>;
  available_niches: NicheId[];
  metrics: PublicMetrics;
  last_updated: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The latest of a set of YYYY-MM-DD strings, or null when there are none. */
function maxDate(dates: (string | null)[]): string | null {
  let best: string | null = null;
  for (const d of dates) {
    if (d && (best == null || d > best)) best = d;
  }
  return best;
}

export function buildPricingBody(
  domain: string,
  offers: RawOffer[],
  rates: Record<string, number>,
  only: NicheId | null,
  metrics: PublicMetrics
): PricingBody {
  const { pricing, available_niches } = aggregatePricing(offers, rates, only);
  const found = Object.keys(pricing).length > 0;

  return {
    domain,
    found,
    // Every figure in this response is USD. Flat rather than repeated inside
    // each niche, because it cannot vary by niche and a per-niche field
    // implies it can.
    currency: "USD",
    // Constant across every niche, so it is stated once.
    fee: { percent: FEE_PERCENT, minimum_usd: round2(minFeeCents(rates) / 100) },
    pricing,
    available_niches,
    metrics,
    // The maximum of the per-niche dates rather than a domain-wide MAX, so it
    // cannot claim a niche is fresher than its own offers are. Null whenever
    // `pricing` is empty, including when a niche filter emptied it — the field
    // describes the prices in this response, and a date sitting next to
    // `pricing: {}` reads as "these prices are from yesterday" when there are
    // no prices at all.
    last_updated: found ? maxDate(Object.values(pricing).map((n) => n.last_updated)) : null,
  };
}
