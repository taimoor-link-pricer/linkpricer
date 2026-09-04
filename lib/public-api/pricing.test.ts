import { describe, it, expect } from "vitest";
import {
  ACCEPTED_NICHE_VALUES,
  NICHE_IDS,
  aggregatePricing,
  nicheOfferPrice,
  ourPrice,
  resolveNiche,
  type RawOffer,
} from "./pricing";

const RATES = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };

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
  it("matches withFee() on the Analyze page", () => {
    expect(ourPrice(150)).toBe(173);
    expect(ourPrice(480)).toBe(552);
    // 350 * 1.15 evaluates to 402.49999999999994 in IEEE-754, so this rounds
    // to 402, not the 403 exact arithmetic would give. Asserted rather than
    // corrected on purpose: the Analyze page's withFee() is the same
    // expression and produces the same 402, and the only thing that actually
    // matters is that the API and the dashboard never quote different prices
    // for the same offer. (/developers/docs used to print 403 in its sample
    // response — that sample was hand-computed and has been corrected.)
    expect(ourPrice(350)).toBe(402);
  });

  it("never returns less than the source price, even on cheap offers", () => {
    // 1.21 * 1.15 = 1.39, which rounds to 1 — below what we'd pay.
    expect(ourPrice(1.21)).toBe(2);
    for (const p of [0.5, 1, 1.2, 2, 3.4]) expect(ourPrice(p)).toBeGreaterThan(p);
  });
});

describe("aggregatePricing", () => {
  it("returns the five figures over a spread of offers", () => {
    const offers = [
      offer({ min_price: 100 }),
      offer({ min_price: 200 }),
      offer({ min_price: 300 }),
    ];
    const out = aggregatePricing(offers, RATES, null);
    expect(out.standard).toEqual({
      best_price: 100,
      average_price: 200,
      highest_price: 300,
      our_price: 115,
      recommended_price: null, // nothing trusted yet
      offer_count: 3,
      currency: "USD",
    });
  });

  it("our_price is always the markup on best_price", () => {
    const out = aggregatePricing([offer({ min_price: 100 }), offer({ min_price: 900 })], RATES, null);
    expect(out.standard.our_price).toBe(ourPrice(out.standard.best_price));
  });

  it("recommended_price is the cheapest TRUSTED offer, not the cheapest overall", () => {
    const out = aggregatePricing(
      [
        offer({ min_price: 100 }),                       // cheapest, untrusted
        offer({ min_price: 250 }, { trusted: true }),    // cheapest trusted
        offer({ min_price: 400 }, { trusted: true }),
      ],
      RATES,
      null
    );
    expect(out.standard.best_price).toBe(100);
    expect(out.standard.our_price).toBe(ourPrice(100));
    expect(out.standard.recommended_price).toBe(ourPrice(250));
  });

  it("recommended_price is null when no trusted marketplace carries the niche", () => {
    const out = aggregatePricing(
      [
        offer({ min_price: 100, gambling_min_price: 400 }),                    // untrusted, has gambling
        offer({ min_price: 120 }, { trusted: true }),                          // trusted, no gambling
      ],
      RATES,
      null
    );
    expect(out.gambling.recommended_price).toBeNull();
    expect(out.standard.recommended_price).toBe(ourPrice(120));
  });

  it("converts every currency to USD before comparing", () => {
    // EUR 100 ≈ $108.70, so the USD 120 offer is NOT the cheapest.
    const out = aggregatePricing(
      [offer({ min_price: 120 }), offer({ min_price: 100 }, { currency: "EUR" })],
      RATES,
      null
    );
    expect(out.standard.best_price).toBeCloseTo(108.7, 1);
    expect(out.standard.highest_price).toBe(120);
    expect(out.standard.offer_count).toBe(2);
  });

  it("a niche only trusted sources can serve still reports a recommendation", () => {
    const out = aggregatePricing(
      [offer({ min_price: 100, cbd_min_price: 500 }, { trusted: true })],
      RATES,
      null
    );
    expect(out.cbd.recommended_price).toBe(ourPrice(500));
    expect(out.cbd.best_price).toBe(500);
  });

  it("omits niches no offer can serve rather than returning nulls", () => {
    const out = aggregatePricing([offer({ min_price: 100 })], RATES, null);
    expect(Object.keys(out)).toEqual(["standard"]);
    expect(out.gambling).toBeUndefined();
  });

  it("returns nothing at all when no offer has any usable price", () => {
    expect(aggregatePricing([offer({ min_price: null })], RATES, null)).toEqual({});
    expect(aggregatePricing([], RATES, null)).toEqual({});
  });

  it("honours a niche filter", () => {
    const out = aggregatePricing(
      [offer({ min_price: 100, gambling_min_price: 400, adult_min_price: 500 })],
      RATES,
      "gambling"
    );
    expect(Object.keys(out)).toEqual(["gambling"]);
    expect(out.gambling.best_price).toBe(400);
  });

  it("counts only the offers that can serve the niche", () => {
    const out = aggregatePricing(
      [
        offer({ min_price: 100, gambling_min_price: 400 }),
        offer({ min_price: 110 }),
        offer({ min_price: 120, gambling_min_price: 600 }),
      ],
      RATES,
      null
    );
    expect(out.standard.offer_count).toBe(3);
    expect(out.gambling.offer_count).toBe(2);
    expect(out.gambling.average_price).toBe(500);
  });

  it("never leaks a marketplace name or any identifying field", () => {
    const out = aggregatePricing([offer({ min_price: 100 }, { trusted: true })], RATES, null);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toMatch(/marketplace|vendor|trusted|name/i);
  });
});
