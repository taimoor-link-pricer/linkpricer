import { describe, it, expect } from "vitest";
import {
  ACCEPTED_NICHE_VALUES,
  FEE_PERCENT,
  MIN_FEE_EUR,
  NICHE_IDS,
  aggregatePricing,
  computeNiches,
  nicheOfferPrice,
  ourPrice,
  resolveNiche,
  type RawOffer,
} from "./pricing";
import { minFeeCents } from "@/lib/pricing/fee";

const RATES = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };

// The €25 fee floor in USD cents, at this fixture's EUR rate — the same
// derivation aggregatePricing does internally, so the two agree by
// construction rather than by a copied number.
const FLOOR = minFeeCents(RATES);

/** ourPrice at the fixture floor, for the many assertions that don't vary it. */
function lp(marketplacePrice: number): number {
  return ourPrice(marketplacePrice, FLOOR);
}

/** Mirrors the rounding aggregatePricing applies to every money field. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function offer(prices: Record<string, number | null>, opts: { currency?: string; trusted?: boolean } = {}): RawOffer {
  return {
    currency: opts.currency ?? "USD",
    prices,
    trusted: opts.trusted ?? false,
  };
}

describe("niche parity with the Analyze page", () => {
  // The dashboard's NICHES list (app/dashboard/search/page.tsx) is the
  // contract this endpoint has to match. Hardcoded here on purpose: importing
  // it would make the test pass automatically if someone silently deleted a
  // niche from one side.
  const DASHBOARD_NICHE_IDS = [
    "general", "igaming", "adult", "cbd", "loans", "dating", "crypto", "forex", "insertion",
  ];

  it("accepts every niche the dashboard offers", () => {
    for (const id of DASHBOARD_NICHE_IDS) {
      expect(resolveNiche(id), `dashboard niche "${id}" must be reachable over the API`).not.toBeNull();
    }
  });

  it("exposes exactly as many niches as the dashboard", () => {
    expect(NICHE_IDS).toHaveLength(DASHBOARD_NICHE_IDS.length);
  });

  it("maps dashboard ids onto the API's canonical ids", () => {
    expect(resolveNiche("igaming")).toBe("gambling");
    expect(resolveNiche("loans")).toBe("loan");
    expect(resolveNiche("forex")).toBe("trading_forex");
    expect(resolveNiche("insertion")).toBe("link_insertion");
    expect(resolveNiche("general")).toBe("standard");
  });

  it("still accepts the API's own published ids", () => {
    for (const id of NICHE_IDS) expect(resolveNiche(id)).toBe(id);
  });

  it("is case- and whitespace-insensitive but rejects nonsense", () => {
    expect(resolveNiche("  IGaming ")).toBe("gambling");
    expect(resolveNiche("sports")).toBeNull();
    expect(resolveNiche("")).toBeNull();
    expect(resolveNiche(null)).toBeNull();
  });

  it("lists every accepted spelling for the error message", () => {
    expect(ACCEPTED_NICHE_VALUES).toContain("gambling");
    expect(ACCEPTED_NICHE_VALUES).toContain("igaming");
  });
});

describe("nicheOfferPrice — exclusion, not fallback", () => {
  it("excludes an offer with no price for the niche", () => {
    // The bug this replaces: this offer would have been priced at its $100
    // base rate and returned as a gambling price, understating it by whatever
    // a real gambling placement costs — and producing a cart POST /api/orders
    // rejects outright.
    const o = offer({ min_price: 100, gambling_min_price: null });
    expect(nicheOfferPrice(o, "gambling")).toBeNull();
    expect(nicheOfferPrice(o, "standard")).toBe(100);
  });

  it("uses the niche column when the offer has one", () => {
    expect(nicheOfferPrice(offer({ min_price: 100, gambling_min_price: 350 }), "gambling")).toBe(350);
  });

  it("treats a zero or negative niche price as not offered", () => {
    expect(nicheOfferPrice(offer({ min_price: 100, adult_min_price: 0 }), "adult")).toBeNull();
    expect(nicheOfferPrice(offer({ min_price: 100, adult_min_price: -5 }), "adult")).toBeNull();
  });

  it("standard never excludes an offer that has a base price", () => {
    expect(nicheOfferPrice(offer({ min_price: 1 }), "standard")).toBe(1);
  });

  it("covers link insertion, which the API previously had no way to price", () => {
    expect(nicheOfferPrice(offer({ min_price: 100, link_insertion_min_price: 60 }), "link_insertion")).toBe(60);
  });
});

describe("ourPrice", () => {
  it("charges the percentage once the placement is big enough to cover the minimum", () => {
    // 480 * 1.15 = 552, and 15% of 480 ($72) is well clear of the €25 floor.
    expect(lp(480)).toBe(552);
    expect(lp(350)).toBe(403);
  });

  it("charges the minimum fee instead of the percentage on a cheap placement", () => {
    // The regression this floor exists for: a $5 placement used to price at
    // $6 — 15% is $0.75 — and one was really ordered for $5.75 total on
    // 2026-09-15. It now carries the €25 minimum like every other order.
    expect(lp(5)).toBe(Math.round(5 + FLOOR / 100));
    expect(lp(5)).toBeGreaterThan(30);

    // 15% of $150 is $22.50, still under the floor, so the floor applies.
    expect(lp(150)).toBe(Math.round(150 + FLOOR / 100));
  });

  it("crosses over from the minimum to the percentage exactly where the two meet", () => {
    const crossover = FLOOR / 100 / (FEE_PERCENT / 100);
    // Just below, the fee is the floor; just above, it is the percentage.
    expect(lp(crossover - 10)).toBe(Math.round(crossover - 10 + FLOOR / 100));
    expect(lp(crossover + 10)).toBe(Math.round((crossover + 10) * (1 + FEE_PERCENT / 100)));
  });

  it("never returns less than the source price, even on cheap offers", () => {
    for (const p of [0.5, 1, 1.2, 2, 3.4, 1.21]) expect(lp(p)).toBeGreaterThan(p);
  });

  it("scales the minimum with the EUR rate rather than pinning a dollar figure", () => {
    // Same €25, two different EUR rates: the USD floor — and so the price of
    // a cheap placement — has to move with the rate, or "€25 minimum" slowly
    // stops being true.
    const weakEuro = minFeeCents({ USD: 1, EUR: 1.05 });
    const strongEuro = minFeeCents({ USD: 1, EUR: 1.25 });
    expect(weakEuro).toBe(Math.round(MIN_FEE_EUR * 1.05 * 100));
    expect(strongEuro).toBe(Math.round(MIN_FEE_EUR * 1.25 * 100));
    expect(ourPrice(10, strongEuro)).toBeGreaterThan(ourPrice(10, weakEuro));
    // ...but a placement above the crossover is priced on the percentage and
    // must not move with the rate at all.
    expect(ourPrice(900, strongEuro)).toBe(ourPrice(900, weakEuro));
  });
});

describe("computeNiches — the arithmetic every published figure comes from", () => {
  it("returns the whole figure set over a spread of offers", () => {
    const out = computeNiches(
      [offer({ min_price: 100 }), offer({ min_price: 200 }), offer({ min_price: 300 })],
      RATES
    );
    expect(out.standard).toEqual({
      // Marketplace money, no fee.
      best: 100,
      average: 200,
      highest: 300,
      cheapestTrusted: null,
      // Fee-inclusive. $100 is under the crossover, so it carries the €25
      // floor rather than 15%; $200 and $300 are over it and carry the
      // percentage.
      lpLowest: 127,
      lpAverage: 234,
      lpHighest: 345,
      lpRecommended: null,
      offerCount: 3,
      trustedOfferCount: 0,
      lastUpdated: null,
      feeAppliedToLowest: "minimum",
    });
  });

  it("the fee-inclusive low is always the markup on the market low", () => {
    const out = computeNiches([offer({ min_price: 100 }), offer({ min_price: 900 })], RATES);
    expect(out.standard!.lpLowest).toBe(lp(out.standard!.best));
  });

  it("recommends the cheapest TRUSTED offer, not the cheapest overall", () => {
    const out = computeNiches(
      [
        offer({ min_price: 100 }),                    // cheapest, untrusted
        offer({ min_price: 250 }, { trusted: true }), // cheapest trusted
        offer({ min_price: 400 }, { trusted: true }),
      ],
      RATES
    );
    expect(out.standard!.best).toBe(100);
    expect(out.standard!.lpLowest).toBe(lp(100));
    expect(out.standard!.lpRecommended).toBe(lp(250));
    expect(out.standard!.trustedOfferCount).toBe(2);
  });

  it("recommends nothing when no trusted marketplace carries the niche", () => {
    const out = computeNiches(
      [
        offer({ min_price: 100, gambling_min_price: 400 }),  // untrusted, has gambling
        offer({ min_price: 120 }, { trusted: true }),        // trusted, no gambling
      ],
      RATES
    );
    expect(out.gambling!.lpRecommended).toBeNull();
    expect(out.standard!.lpRecommended).toBe(lp(120));
  });

  it("converts every currency to USD before comparing", () => {
    // EUR 100 ≈ $108.70, so the USD 120 offer is NOT the cheapest.
    const out = computeNiches(
      [offer({ min_price: 120 }), offer({ min_price: 100 }, { currency: "EUR" })],
      RATES
    );
    expect(out.standard!.best).toBeCloseTo(108.7, 1);
    expect(out.standard!.highest).toBe(120);
    expect(out.standard!.offerCount).toBe(2);
  });

  it("a niche only trusted sources can serve still reports a recommendation", () => {
    const out = computeNiches([offer({ min_price: 100, cbd_min_price: 500 }, { trusted: true })], RATES);
    expect(out.cbd!.lpRecommended).toBe(lp(500));
    expect(out.cbd!.best).toBe(500);
  });

  it("omits niches no offer can serve rather than returning nulls", () => {
    const out = computeNiches([offer({ min_price: 100 })], RATES);
    expect(Object.keys(out)).toEqual(["standard"]);
    expect(out.gambling).toBeUndefined();
  });

  it("returns nothing at all when no offer has any usable price", () => {
    expect(computeNiches([offer({ min_price: null })], RATES)).toEqual({});
    expect(computeNiches([], RATES)).toEqual({});
  });

  it("counts only the offers that can serve the niche", () => {
    const out = computeNiches(
      [
        offer({ min_price: 100, gambling_min_price: 400 }),
        offer({ min_price: 110 }),
        offer({ min_price: 120, gambling_min_price: 600 }),
      ],
      RATES
    );
    expect(out.standard!.offerCount).toBe(3);
    expect(out.gambling!.offerCount).toBe(2);
    expect(out.gambling!.average).toBe(500);
  });

  it("prices the spread: the fee-inclusive ends of the market", () => {
    const out = computeNiches(
      [offer({ min_price: 100 }), offer({ min_price: 260 }), offer({ min_price: 400 })],
      RATES
    );
    expect(out.standard!.best).toBe(100);
    expect(out.standard!.highest).toBe(400);
    expect(out.standard!.lpLowest).toBe(lp(100));
    expect(out.standard!.lpHighest).toBe(lp(400));
  });

  it("averages the fee-inclusive prices rather than marking up the average", () => {
    // The fee is not linear in the price, so the two computations genuinely
    // differ.
    //
    //   per offer:      (lp(1) + lp(1) + lp(1000)) / 3 = (28 + 28 + 1150) / 3 = 402
    //   marked-up mean: lp((1 + 1 + 1000) / 3)         = lp(334)              = 384
    //
    // The cheap pair each carry a whole €25 minimum; averaging first hides
    // both of them behind the one expensive placement and understates what
    // the three actually cost.
    const out = computeNiches(
      [offer({ min_price: 1 }), offer({ min_price: 1 }), offer({ min_price: 1000 })],
      RATES
    );
    expect(out.standard!.lpAverage).toBe(round2((lp(1) + lp(1) + lp(1000)) / 3));
    expect(out.standard!.lpAverage).toBeGreaterThan(lp(out.standard!.average));
  });

  it("says which of the two fee rules applied to the headline price", () => {
    // The field exists so that a 15% headline sitting next to a 145%
    // effective markup does not read as broken arithmetic.
    expect(computeNiches([offer({ min_price: 20 })], RATES).standard!.feeAppliedToLowest).toBe("minimum");
    expect(computeNiches([offer({ min_price: 900 })], RATES).standard!.feeAppliedToLowest).toBe("percent");
  });

  it("only ever produces whole dollars, except the average", () => {
    // ourPrice() rounds to whole dollars, so three of the four fee-inclusive
    // figures are integers by construction. The average is the one that is
    // not: it is a mean of those integers, carried to cents.
    const out = computeNiches(
      [offer({ min_price: 100.5 }), offer({ min_price: 200.25 }, { trusted: true }), offer({ min_price: 301 })],
      RATES
    );
    const c = out.standard!;
    for (const [name, v] of [["lpLowest", c.lpLowest], ["lpHighest", c.lpHighest], ["lpRecommended", c.lpRecommended]] as const) {
      expect(Number.isInteger(v), `${name} must be a whole dollar, got ${v}`).toBe(true);
    }
    expect(c.lpAverage).toBe(round2((lp(100.5) + lp(200.25) + lp(301)) / 3));
  });
});

describe("aggregatePricing — the niche filter", () => {
  it("honours a niche filter", () => {
    const { pricing } = aggregatePricing(
      [offer({ min_price: 100, gambling_min_price: 400, adult_min_price: 500 })],
      RATES,
      "gambling"
    );
    expect(Object.keys(pricing)).toEqual(["gambling"]);
    expect(pricing.gambling.marketplace.lowest).toBe(400);
  });

  it("never leaks a marketplace name or any identifying field", () => {
    const out = aggregatePricing([offer({ min_price: 100 }, { trusted: true })], RATES, null);
    expect(JSON.stringify(out)).not.toMatch(/marketplace_name|vendor|trusted/i);
  });
});

// ─── the published examples ─────────────────────────────────────────────────
//
// /developers and /developers/docs both print a sample response with real
// numbers in it. Those numbers were computed by hand, and one of them was
// wrong on the first pass. A customer who reproduces our own example and gets
// a different answer has no way to tell which side is broken, so the samples
// are pinned here: change the fee and this fails, naming the pages that need
// updating with it.
describe("the sample response published on /developers and /developers/docs", () => {
  const DOCUMENTED = [
    { source: 260,   lp: 299 },
    { source: 300,   lp: 345 },
    { source: 420,   lp: 483 },
    { source: 360,   lp: 414 },
    { source: 512.4, lp: 589 },
    { source: 900,   lp: 1035 },
    { source: 264.5, lp: 304 },
  ];

  it("prices every documented figure exactly as the code does", () => {
    for (const { source, lp: documented } of DOCUMENTED) {
      expect(lp(source), `the docs say $${source} prices at $${documented}`).toBe(documented);
    }
  });

  // The published sample can't contain a figure that moves when the admin
  // changes the EUR rate — a hardcoded example that silently goes stale is
  // worse than no example. Every documented source price is therefore kept
  // above the crossover, where the percentage governs and the floor is
  // irrelevant. This is the test that keeps the next person from adding a
  // cheap domain to the sample without noticing.
  it("publishes only figures that don't move with the exchange rate", () => {
    const floors = [minFeeCents({ USD: 1, EUR: 1.0 }), minFeeCents({ USD: 1, EUR: 1.4 })];
    for (const { source, lp: documented } of DOCUMENTED) {
      for (const floor of floors) {
        expect(
          ourPrice(source, floor),
          `$${source} is documented as $${documented} but moves with the EUR rate — use a source price above the crossover`
        ).toBe(documented);
      }
    }
  });

  it("documents the fee percent and the minimum the code actually applies", () => {
    expect(FEE_PERCENT, "/developers/docs states 15% in prose and in lp_fee_percent").toBe(15);
    expect(MIN_FEE_EUR, "/developers/docs states €25 in prose and in lp_fee_min.eur").toBe(25);
  });
});
