import { toUsd } from "@/lib/currency";

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

/** LinkPricer's own price for a marketplace price. Identical to withFee() on the Analyze page. */
export function ourPrice(marketplacePrice: number): number {
  return Math.max(Math.round(marketplacePrice * 1.15), Math.floor(marketplacePrice) + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    out[niche] = {
      best_price: round2(best),
      average_price: round2(average),
      highest_price: round2(highest),
      our_price: ourPrice(best),
      recommended_price: cheapestTrusted == null ? null : ourPrice(cheapestTrusted),
      offer_count: usdPrices.length,
      currency: "USD",
    };
  }

  return out;
}
