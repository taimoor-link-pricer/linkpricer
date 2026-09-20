import { toUsd } from "@/lib/currency";
import { FEE_PERCENT, MIN_FEE_EUR, minFeeCents, withFeeUsd } from "@/lib/pricing/fee";

/**
 * The niche filter surface of the public API.
 *
 * This is deliberately a mirror of the Analyze page's NICHES list
 * (app/dashboard/search/page.tsx) and its NICHE_COLUMNS map
 * (app/api/analyze/route.ts) — the two surfaces price the same catalog, so a
 * niche a customer can select in the dashboard must be one they can request
 * over the API and get the same number back.
 *
 * The two lists were built independently and had drifted in three ways:
 *   - different ids for the same niche (igaming/gambling, loans/loan,
 *     forex/trading_forex, general/standard),
 *   - the API had no `link_insertion` niche at all, so the one product line
 *     that is priced separately everywhere else in the app was unreachable,
 *   - the API applied a *fallback* to base price where Analyze applies an
 *     *exclusion* (see nicheOfferPrice below).
 *
 * `aliases` fixes the first: the API's own ids stay canonical (they are a
 * published contract), and the dashboard's ids are accepted as synonyms, so
 * either spelling works and neither surface has to be renamed.
 */
export interface NicheDef {
  /** Price columns on marketplace_offers / supplier_offers. null = base min_price/max_price. */
  columns: { min: string; max: string } | null;
  /** Alternate spellings accepted on the `niche` query param. */
  aliases: readonly string[];
}

export const NICHES = {
  standard: { columns: null, aliases: ["general", "base"] },
  gambling: { columns: { min: "gambling_min_price", max: "gambling_max_price" }, aliases: ["igaming"] },
  adult: { columns: { min: "adult_min_price", max: "adult_max_price" }, aliases: [] },
  cbd: { columns: { min: "cbd_min_price", max: "cbd_max_price" }, aliases: [] },
  loan: { columns: { min: "loan_min_price", max: "loan_max_price" }, aliases: ["loans"] },
  dating: { columns: { min: "dating_min_price", max: "dating_max_price" }, aliases: [] },
  crypto: { columns: { min: "crypto_min_price", max: "crypto_max_price" }, aliases: [] },
  trading_forex: { columns: { min: "trading_forex_min_price", max: "trading_forex_max_price" }, aliases: ["forex"] },
  link_insertion: {
    columns: { min: "link_insertion_min_price", max: "link_insertion_max_price" },
    aliases: ["insertion"],
  },
} as const satisfies Record<string, NicheDef>;

export type NicheId = keyof typeof NICHES;

export const NICHE_IDS = Object.keys(NICHES) as NicheId[];

/** Every accepted spelling, canonical ids first — used verbatim in error messages and docs. */
export const ACCEPTED_NICHE_VALUES: string[] = NICHE_IDS.flatMap((id) => [id, ...NICHES[id].aliases]);

/**
 * Canonical niche id for any accepted spelling, or null if unrecognized.
 *
 * Callers of a REST API type this value rather than picking it from a list, so
 * it arrives with whatever casing and padding their string handling produced.
 * Trimming and lowercasing is deliberate leniency for that; anything that is
 * still not a niche we price is rejected rather than guessed at.
 */
export function resolveNiche(raw: string | null | undefined): NicheId | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  for (const id of NICHE_IDS) {
    if (id === v || (NICHES[id].aliases as readonly string[]).includes(v)) return id;
  }
  return null;
}

// ─── offer pricing ─────────────────────────────────────────────────────────

/** One priced offer, already flattened out of either offer table. */
export interface RawOffer {
  currency: string | null;
  /** Every niche price column, plus min_price/max_price. Values are numbers or null. */
  prices: Record<string, number | null>;
  /** Whether the marketplace behind this offer is admin-marked as trusted. */
  trusted: boolean;
}

/**
 * The price this offer charges for `niche`, or null when it cannot serve it.
 *
 * Exclusion, not fallback. This is the same rule /api/analyze applies, and it
 * exists because the fallback version produced prices nobody can buy at: the
 * base rate was returned labeled as the niche rate, while POST /api/orders
 * hard-rejects any item whose offer has no price for that priceType. Measured
 * against the live catalog, the fallback understated the gambling price on
 * 116,486 of the 147,501 gambling-capable domains — by an average of $193.
 *
 * `standard` has no niche column and therefore never excludes anything.
 */
export function nicheOfferPrice(offer: RawOffer, niche: NicheId): number | null {
  const cols = NICHES[niche].columns;
  const raw = cols ? offer.prices[cols.min] : offer.prices.min_price;
  if (raw == null) return null;
  const n = Number(raw);
  // A zero or negative price is not a price. Both offer tables carry rows
  // whose niche column is 0 rather than NULL to mean "not offered".
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * The headline markup, published as `lp_fee_percent` so a caller can see the
 * basis rather than reverse-engineering it from two numbers.
 *
 * It is the headline rate, not always the effective one. The fee is the larger
 * of this percentage and a €25 minimum (MIN_FEE_EUR), so on a cheap placement
 * the minimum is what is actually charged — published alongside it as
 * `lp_fee_min` rather than left for a caller to infer from two numbers that
 * no longer divide into each other.
 */
export { FEE_PERCENT, MIN_FEE_EUR };

/**
 * LinkPricer's own price for a marketplace price, in USD. Identical to
 * withFee() on the Analyze page — both call the one implementation.
 *
 * `feeFloorCents` is the €25 minimum converted to USD cents by the caller,
 * which holds the rate map.
 */
export function ourPrice(marketplacePrice: number, feeFloorCents: number): number {
  return withFeeUsd(marketplacePrice, feeFloorCents);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What a customer pays LinkPricer, as opposed to what the marketplaces charge.
 *
 * The flat price fields on NichePricing are a published contract and stay
 * exactly as they are: three of them (best/average/highest) are raw
 * marketplace money and two (our_price/recommended_price) already carry the
 * fee, which is a split a caller has no way to see from the field names. This
 * object is the additive fix — everything inside it includes the fee, named
 * once in one place, so the boundary is legible without reading the docs.
 *
 * `lowest` and `recommended` deliberately repeat our_price and
 * recommended_price. Completeness is the point: a caller reading lp_prices
 * should never have to reach back into the flat fields to assemble the full
 * set of LinkPricer figures.
 */
export interface LpPrices {
  /** Fee-inclusive price at the cheapest source. Always equal to our_price. */
  lowest: number;
  /** Mean of the fee-inclusive price of every offer — NOT average_price marked up (see aggregatePricing). */
  average: number;
  /** Fee-inclusive price at the most expensive source. */
  highest: number;
  /** Fee-inclusive price at the cheapest trusted source. Always equal to recommended_price. */
  recommended: number | null;
}

export interface NichePricing {
  /** Lowest market price found across all sources, in USD. Analyze's "Marketplace price" low. */
  best_price: number;
  /** Mean market price across every offer that can serve this niche, in USD. */
  average_price: number;
  /** Highest market price found, in USD. */
  highest_price: number;
  /** What LinkPricer charges to fulfil at the best price. Analyze's "Our price"/Buy button. */
  our_price: number;
  /** What LinkPricer charges for the cheapest *trusted* source. null when no trusted source has this niche. */
  recommended_price: number | null;
  /** How many distinct sources back these figures. Never names them. */
  offer_count: number;
  currency: "USD";
  /** Every figure above, fee-inclusive. The flat best/average/highest prices are not. */
  lp_prices: LpPrices;
  /** The headline markup behind lp_prices, as a percentage. See FEE_PERCENT. */
  lp_fee_percent: number;
  /**
   * The minimum fee, which applies when it exceeds lp_fee_percent of the
   * placement — the usual case on cheap domains. Set in EUR by the business
   * and reported here in both currencies, so a caller can reproduce any
   * lp_prices figure exactly: fee = max(price * lp_fee_percent / 100, lp_fee_min.usd).
   */
  lp_fee_min: { eur: number; usd: number };
}

/**
 * Aggregates every offer for one domain into the per-niche figures the API
 * returns. Niches no offer can serve are simply absent from the result —
 * never present with a null price, which would be indistinguishable from
 * "priced at nothing".
 */
export function aggregatePricing(
  offers: RawOffer[],
  rates: Record<string, number>,
  only: NicheId | null
): Record<string, NichePricing> {
  const out: Record<string, NichePricing> = {};
  const wanted = only ? [only] : NICHE_IDS;
  // Same conversion the orders API charges with, off the same rate map that
  // converts the offers themselves just below — a published price a customer
  // could not then buy at would be worse than no price at all.
  const feeFloorCents = minFeeCents(rates);

  for (const niche of wanted) {
    const usdPrices: number[] = [];
    const trustedUsdPrices: number[] = [];

    for (const offer of offers) {
      const raw = nicheOfferPrice(offer, niche);
      if (raw == null) continue;
      // Convert before comparing, always. Offers are stored in the source
      // marketplace's own currency, so a EUR 300 offer and a USD 320 offer
      // cannot be ranked, averaged, or marked up until both are USD.
      const usd = toUsd(raw, offer.currency, rates);
      if (usd == null || usd <= 0) continue;
      usdPrices.push(usd);
      if (offer.trusted) trustedUsdPrices.push(usd);
    }

    if (usdPrices.length === 0) continue;

    const best = Math.min(...usdPrices);
    const highest = Math.max(...usdPrices);
    const average = usdPrices.reduce((a, b) => a + b, 0) / usdPrices.length;
    const cheapestTrusted = trustedUsdPrices.length ? Math.min(...trustedUsdPrices) : null;

    // Marked up per offer, then averaged — not average_price marked up.
    //
    // The two differ because ourPrice() is not linear: its whole-dollar floor
    // lifts cheap offers by more than the percentage would, so marking up the
    // mean understates what the offers actually cost. Averaging the real
    // per-offer prices is the figure that matches what a customer would pay,
    // which is the only thing this field is good for.
    //
    // min and max need no such care — ourPrice() is monotonic, so the cheapest
    // offer is still the cheapest after the fee. They are computed through it
    // anyway so all four lp figures come from one expression.
    const lpPrices = usdPrices.map((p) => ourPrice(p, feeFloorCents));
    const lpAverage = lpPrices.reduce((a, b) => a + b, 0) / lpPrices.length;

    out[niche] = {
      best_price: round2(best),
      average_price: round2(average),
      highest_price: round2(highest),
      our_price: ourPrice(best, feeFloorCents),
      recommended_price: cheapestTrusted == null ? null : ourPrice(cheapestTrusted, feeFloorCents),
      offer_count: usdPrices.length,
      currency: "USD",
      lp_prices: {
        lowest: ourPrice(best, feeFloorCents),
        average: round2(lpAverage),
        highest: ourPrice(highest, feeFloorCents),
        recommended: cheapestTrusted == null ? null : ourPrice(cheapestTrusted, feeFloorCents),
      },
      lp_fee_percent: FEE_PERCENT,
      lp_fee_min: { eur: MIN_FEE_EUR, usd: round2(feeFloorCents / 100) },
    };
  }

  return out;
}
