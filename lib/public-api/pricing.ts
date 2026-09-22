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
  /**
   * Human-readable name, published by v2 and used verbatim in its summary
   * lines. One definition, so the label a caller reads in `pricing.<id>.label`
   * is the same one the summary sentence and the invalid_niche error use.
   */
  label: string;
}

export const NICHES = {
  standard: { columns: null, aliases: ["general", "base"], label: "Standard / general" },
  gambling: { columns: { min: "gambling_min_price", max: "gambling_max_price" }, aliases: ["igaming"], label: "Gambling / iGaming" },
  adult: { columns: { min: "adult_min_price", max: "adult_max_price" }, aliases: [], label: "Adult" },
  cbd: { columns: { min: "cbd_min_price", max: "cbd_max_price" }, aliases: [], label: "CBD" },
  loan: { columns: { min: "loan_min_price", max: "loan_max_price" }, aliases: ["loans"], label: "Loans" },
  dating: { columns: { min: "dating_min_price", max: "dating_max_price" }, aliases: [], label: "Dating" },
  crypto: { columns: { min: "crypto_min_price", max: "crypto_max_price" }, aliases: [], label: "Crypto" },
  trading_forex: { columns: { min: "trading_forex_min_price", max: "trading_forex_max_price" }, aliases: ["forex"], label: "Trading / Forex" },
  link_insertion: {
    columns: { min: "link_insertion_min_price", max: "link_insertion_max_price" },
    aliases: ["insertion"],
    label: "Link insertion",
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
  /**
   * When this offer was last seen, as the timestamp the query produced, or
   * null when the source carries none.
   *
   * Per offer rather than per domain because freshness is reported per niche:
   * a domain-wide MAX makes a two-year-old gambling price look as current as
   * the standard offer scraped this morning. Measured on 150 real domains,
   * the domain-wide date overstated freshness on 55% of priced niches, by up
   * to 186 days.
   */
  freshness?: string | null;
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
 * Everything the response needs about one niche, computed once.
 *
 * Kept separate from the published shape so the arithmetic can be asserted on
 * its own, and so renaming a published field never means touching a formula.
 */
export interface NicheCore {
  /** Cheapest source price, USD, no fee. */
  best: number;
  /** Mean source price across every contributing offer, USD, no fee. */
  average: number;
  /** Dearest source price, USD, no fee. */
  highest: number;
  /** Cheapest source price among TRUSTED sources only, or null. */
  cheapestTrusted: number | null;
  /** Fee-inclusive price at the cheapest source. */
  lpLowest: number;
  /** Mean of each offer's fee-inclusive price — not `average` marked up. */
  lpAverage: number;
  /** Fee-inclusive price at the dearest source. */
  lpHighest: number;
  /** Fee-inclusive price at the cheapest trusted source, or null. */
  lpRecommended: number | null;
  /** Distinct sources backing these figures. */
  offerCount: number;
  /** How many of those are trusted. */
  trustedOfferCount: number;
  /**
   * Freshest contributing offer as YYYY-MM-DD, or null when no contributing
   * offer carried a usable timestamp. Scoped to the offers that actually
   * priced THIS niche, which is the whole point of reporting it per niche.
   */
  lastUpdated: string | null;
  /** Whether the fee charged on `best` was the percentage or the minimum. */
  feeAppliedToLowest: "percent" | "minimum";
}

/** YYYY-MM-DD, or null for anything that is not a usable timestamp. */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * The per-niche arithmetic, for every niche the offers can serve.
 *
 * Niches no offer can serve are absent from the result rather than present
 * with nulls — a null price is indistinguishable from "priced at nothing".
 * Always computes ALL niches: a filtered request still needs to know which
 * other niches exist so it can say so, and the loop is over a handful of
 * in-memory offers, so the cost is nil.
 */
export function computeNiches(
  offers: RawOffer[],
  rates: Record<string, number>
): Partial<Record<NicheId, NicheCore>> {
  const out: Partial<Record<NicheId, NicheCore>> = {};
  // Same conversion the orders API charges with, off the same rate map that
  // converts the offers themselves just below — a published price a customer
  // could not then buy at would be worse than no price at all.
  const feeFloorCents = minFeeCents(rates);

  for (const niche of NICHE_IDS) {
    const usdPrices: number[] = [];
    const trustedUsdPrices: number[] = [];
    let freshest: number | null = null;

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

      // Freshness is tracked only for offers that CONTRIBUTED, so a stale
      // niche cannot borrow the timestamp of a fresh offer that does not
      // price it.
      if (offer.freshness) {
        const t = new Date(offer.freshness).getTime();
        if (!Number.isNaN(t) && (freshest == null || t > freshest)) freshest = t;
      }
    }

    if (usdPrices.length === 0) continue;

    const best = Math.min(...usdPrices);
    const highest = Math.max(...usdPrices);
    const average = usdPrices.reduce((a, b) => a + b, 0) / usdPrices.length;
    const cheapestTrusted = trustedUsdPrices.length ? Math.min(...trustedUsdPrices) : null;

    // Marked up per offer, then averaged — not the average marked up.
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
      best: round2(best),
      average: round2(average),
      highest: round2(highest),
      cheapestTrusted,
      lpLowest: ourPrice(best, feeFloorCents),
      lpAverage: round2(lpAverage),
      lpHighest: ourPrice(highest, feeFloorCents),
      lpRecommended: cheapestTrusted == null ? null : ourPrice(cheapestTrusted, feeFloorCents),
      offerCount: usdPrices.length,
      trustedOfferCount: trustedUsdPrices.length,
      lastUpdated: freshest == null ? null : isoDate(new Date(freshest).toISOString()),
      // Which of the two fee rules actually applied to the headline price.
      // Derived from the same comparison withFeeUsd() makes rather than
      // re-deriving the threshold, so it cannot disagree with the price it
      // describes.
      feeAppliedToLowest:
        best * (FEE_PERCENT / 100) * 100 >= feeFloorCents ? "percent" : "minimum",
    };
  }

  return out;
}

// ─── the published response shape ───────────────────────────────────────────

/**
 * One niche's prices, as published.
 *
 * The earlier shape had five flat price fields that mixed two bases —
 * best/average/highest were raw marketplace money while
 * our_price/recommended_price already carried the fee — and no field name
 * said which was which. Here that split IS the structure, so a reader who
 * never opens the docs cannot confuse the two.
 */
export interface NichePricing {
  /** Human-readable niche name, from NICHES[id].label. */
  label: string;
  /**
   * One sentence naming what this price is for. Display only — every figure
   * in it is also present as a number below, and the wording will change
   * without a version bump, so nothing should parse it.
   */
  summary: string;
  /** What the sources charge. LinkPricer's fee is NOT included. */
  marketplace: { lowest: number; average: number; highest: number };
  /** What the customer pays LinkPricer. Fee included. */
  linkpricer: {
    lowest: number;
    average: number;
    highest: number;
    recommended: number | null;
  };
  /** How many distinct sources back these figures. Never names them. */
  offer_count: number;
  /** Freshest offer that priced THIS niche, YYYY-MM-DD, or null. */
  last_updated: string | null;
}

/** `$414`, `$304.17` — whole dollars print without a decimal part. */
function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export interface AggregatedPricing {
  /** The niches asked for (all of them, unless a filter narrowed it). */
  pricing: Record<string, NichePricing>;
  /**
   * Every niche this domain is priced for, regardless of the filter.
   *
   * Without it an absent key is ambiguous: a caller cannot tell "no source
   * sells this niche here" from "you filtered it out". Listing them costs one
   * already-computed array and saves the caller a second billed request.
   */
  available_niches: NicheId[];
}

/** The response's pricing section, shaped from the NicheCore values. */
export function aggregatePricing(
  offers: RawOffer[],
  rates: Record<string, number>,
  only: NicheId | null
): AggregatedPricing {
  const cores = computeNiches(offers, rates);
  const available = NICHE_IDS.filter((n) => cores[n]);
  const wanted = only ? [only] : available;

  const pricing: Record<string, NichePricing> = {};
  for (const niche of wanted) {
    const c = cores[niche];
    if (!c) continue;
    const { label } = NICHES[niche];

    pricing[niche] = {
      label,
      summary:
        `LinkPricer best price for ${label}: ${money(c.lpLowest)} ` +
        `(${c.offerCount} ${c.offerCount === 1 ? "source" : "sources"}).`,
      marketplace: { lowest: c.best, average: c.average, highest: c.highest },
      linkpricer: {
        lowest: c.lpLowest,
        average: c.lpAverage,
        highest: c.lpHighest,
        recommended: c.lpRecommended,
      },
      offer_count: c.offerCount,
      last_updated: c.lastUpdated,
    };
  }

  return { pricing, available_niches: available };
}
