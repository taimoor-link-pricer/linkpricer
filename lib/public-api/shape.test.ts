/**
 * The behaviour the response shape is there to buy us.
 *
 * Everything asserted here is something the previous flat shape either got
 * wrong or could not say at all: which base a price is on, what the price is
 * FOR, whether a missing niche is unsold or merely filtered out, and how old
 * a given niche's prices actually are.
 */

import { describe, it, expect } from "vitest";
import { buildPricingBody } from "@/lib/public-api/shape";
import { minFeeCents, withFeeUsd } from "@/lib/pricing/fee";
import { NICHE_IDS, type RawOffer } from "@/lib/public-api/pricing";

const RATES = { USD: 1, EUR: 1.25, GBP: 1.25 };
const FLOOR = minFeeCents(RATES);

const offer = (
  prices: Record<string, number | null>,
  extra: Partial<RawOffer> = {}
): RawOffer => ({ currency: "USD", prices, trusted: false, ...extra });

const METRICS = {
  domain_rating: 45,
  organic_traffic: 12000,
  ref_domains: 1200,
  country: "United States",
};

const OFFERS: RawOffer[] = [
  offer({ min_price: 260, gambling_min_price: 360, link_insertion_min_price: 20 }, { freshness: "2026-06-20T10:00:00Z" }),
  offer({ min_price: 300, gambling_min_price: 900 }, { trusted: true, freshness: "2026-05-02T10:00:00Z" }),
  offer({ min_price: 224, link_insertion_min_price: 28 }, { currency: "EUR", freshness: "2026-04-01T10:00:00Z" }),
  offer({ min_price: 420, gambling_min_price: 277.2, link_insertion_min_price: 32 }, { freshness: "2026-06-18T10:00:00Z" }),
];

const body = (only: Parameters<typeof buildPricingBody>[3] = null) =>
  buildPricingBody("techblog.com", OFFERS, RATES, only, METRICS);

describe("response shape", () => {
  it("has exactly these top-level keys", () => {
    expect(Object.keys(body()).sort()).toEqual(
      ["available_niches", "currency", "domain", "fee", "found", "last_updated", "metrics", "pricing"].sort()
    );
  });

  it("has exactly these keys on every priced niche", () => {
    for (const n of Object.values(body().pricing)) {
      expect(Object.keys(n).sort()).toEqual(
        ["label", "summary", "marketplace", "linkpricer", "offer_count", "last_updated"].sort()
      );
      expect(Object.keys(n.marketplace).sort()).toEqual(["lowest", "average", "highest"].sort());
      expect(Object.keys(n.linkpricer).sort()).toEqual(
        ["lowest", "average", "highest", "recommended"].sort()
      );
    }
  });

  it("states the fee once at the top level instead of in every niche", () => {
    expect(body().fee).toEqual({ percent: 15, minimum_usd: 31.25 });
    for (const n of Object.values(body().pricing)) {
      expect(n).not.toHaveProperty("lp_fee_percent");
      expect(n).not.toHaveProperty("lp_fee_min");
    }
  });

  it("scales the minimum fee with the EUR rate rather than pinning a dollar figure", () => {
    const cheap = buildPricingBody("d.com", OFFERS, { USD: 1, EUR: 1.05 }, null, METRICS);
    expect(cheap.fee.minimum_usd).toBe(26.25);
    expect(cheap.fee.minimum_usd).not.toBe(body().fee.minimum_usd);
  });

  it("reports the currency once, not per niche", () => {
    expect(body().currency).toBe("USD");
    for (const n of Object.values(body().pricing)) expect(n).not.toHaveProperty("currency");
  });
});

describe("the two price bases are separated", () => {
  it("marketplace prices never carry the fee and linkpricer prices always do", () => {
    for (const n of Object.values(body().pricing)) {
      expect(n.linkpricer.lowest).toBe(withFeeUsd(n.marketplace.lowest, FLOOR));
      expect(n.linkpricer.highest).toBe(withFeeUsd(n.marketplace.highest, FLOOR));
      // Strictly dearer: a fee-inclusive price that equalled the source price
      // would mean the fee vanished.
      expect(n.linkpricer.lowest).toBeGreaterThan(n.marketplace.lowest);
      expect(n.linkpricer.highest).toBeGreaterThan(n.marketplace.highest);
    }
  });

  it("averages the fee-inclusive prices rather than marking up the average", () => {
    // A $5 source and a $500 source. The floor lifts the cheap one by 625%
    // and the dear one not at all, so the mean of the real prices and the
    // marked-up mean are genuinely different numbers — marking up the average
    // understates what a customer actually pays.
    //
    // (Deliberately not asserted on the shared fixture: link_insertion's
    // sources happen to make both routes land on $60, which would let this
    // test pass on a broken implementation.)
    const spread = buildPricingBody(
      "spread.com",
      [offer({ min_price: 5 }), offer({ min_price: 500 })],
      RATES,
      null,
      METRICS
    ).pricing.standard;

    const markupOfAverage = withFeeUsd(spread.marketplace.average, FLOOR);
    const averageOfMarkups = (withFeeUsd(5, FLOOR) + withFeeUsd(500, FLOOR)) / 2;

    expect(spread.linkpricer.average).toBe(averageOfMarkups);
    expect(spread.linkpricer.average).not.toBe(markupOfAverage);
    expect(spread.linkpricer.average).toBeGreaterThan(markupOfAverage);
  });

  it("recommends the cheapest TRUSTED source, or nothing at all", () => {
    // Only the $300/$900 source is trusted.
    expect(body().pricing.standard.linkpricer.recommended).toBe(withFeeUsd(300, FLOOR));
    expect(body().pricing.gambling.linkpricer.recommended).toBe(withFeeUsd(900, FLOOR));
    // No trusted source carries link insertion.
    expect(body().pricing.link_insertion.linkpricer.recommended).toBeNull();
  });
});

describe("the summary says what the price is for", () => {
  it("names the niche, the price and how many sources back it", () => {
    expect(body().pricing.gambling.summary).toBe(
      "LinkPricer best price for Gambling / iGaming: $319 (3 sources)."
    );
    expect(body().pricing.gambling.label).toBe("Gambling / iGaming");
  });

  it("quotes the same number it published as linkpricer.lowest", () => {
    for (const n of Object.values(body().pricing)) {
      expect(n.summary).toContain(`$${n.linkpricer.lowest}`);
      expect(n.summary).toContain(n.label);
    }
  });

  it("says 'source' for one and 'sources' for more", () => {
    const single = buildPricingBody("d.com", [offer({ crypto_min_price: 400 })], RATES, null, METRICS);
    expect(single.pricing.crypto.summary).toBe("LinkPricer best price for Crypto: $460 (1 source).");
  });

  it("prints whole dollars without a decimal part", () => {
    for (const n of Object.values(body().pricing)) {
      expect(n.summary).not.toMatch(/\$\d+\.\d\d\d/);
      if (Number.isInteger(n.linkpricer.lowest)) expect(n.summary).not.toMatch(/\$\d+\.00/);
    }
  });

  it("never names a marketplace", () => {
    const json = JSON.stringify(body());
    for (const leak of ["marketplace_name", "supplier", "vendor", "trusted", "domain_id"]) {
      expect(json).not.toContain(leak);
    }
  });
});

describe("available_niches distinguishes 'not sold here' from 'you filtered it out'", () => {
  it("lists every niche the domain is priced for, filter or no filter", () => {
    expect(body().available_niches).toEqual(["standard", "gambling", "link_insertion"]);
    expect(body("gambling").available_niches).toEqual(["standard", "gambling", "link_insertion"]);
  });

  it("returns only the requested niche in pricing", () => {
    expect(Object.keys(body("gambling").pricing)).toEqual(["gambling"]);
  });

  it("still says what IS sold when the requested niche is not", () => {
    const b = body("crypto");
    expect(b.found).toBe(false);
    expect(b.pricing).toEqual({});
    // The whole point: a caller who asked for crypto learns, without a second
    // billed request, that this domain sells three other niches.
    expect(b.available_niches).toEqual(["standard", "gambling", "link_insertion"]);
    expect(b.last_updated).toBeNull();
  });

  it("is empty for a domain with no usable offer at all", () => {
    const b = buildPricingBody("bare.com", [], RATES, null, METRICS);
    expect(b.found).toBe(false);
    expect(b.available_niches).toEqual([]);
    expect(b.pricing).toEqual({});
  });

  it("only ever lists real niche ids", () => {
    for (const n of body().available_niches) expect(NICHE_IDS).toContain(n);
  });
});

describe("freshness is per niche, not per domain", () => {
  // The defect this fixes: v1 reports MAX(freshness) across every offer on the
  // domain, so one offer scraped this morning makes a two-year-old price in a
  // different niche look current.
  const FRESH_STANDARD_STALE_GAMBLING: RawOffer[] = [
    offer({ min_price: 500 }, { freshness: "2026-09-20T10:00:00Z" }),
    offer({ gambling_min_price: 700 }, { freshness: "2024-01-15T10:00:00Z" }),
  ];

  it("dates each niche from the offers that actually priced it", () => {
    const b = buildPricingBody("mixed.com", FRESH_STANDARD_STALE_GAMBLING, RATES, null, METRICS);
    expect(b.pricing.standard.last_updated).toBe("2026-09-20");
    expect(b.pricing.gambling.last_updated).toBe("2024-01-15");
  });

  it("reports the newest of the returned niches at the top level", () => {
    const b = buildPricingBody("mixed.com", FRESH_STANDARD_STALE_GAMBLING, RATES, null, METRICS);
    expect(b.last_updated).toBe("2026-09-20");
  });

  it("does not let an unreturned niche inflate the top-level date", () => {
    // Asking only for gambling must not report the standard offer's date.
    const b = buildPricingBody("mixed.com", FRESH_STANDARD_STALE_GAMBLING, RATES, "gambling", METRICS);
    expect(b.last_updated).toBe("2024-01-15");
  });

  it("returns null rather than today's date when no offer carries a timestamp", () => {
    const b = buildPricingBody("undated.com", [offer({ min_price: 100 })], RATES, null, METRICS);
    expect(b.pricing.standard.last_updated).toBeNull();
    expect(b.last_updated).toBeNull();
  });

  it("ignores an unparseable timestamp instead of emitting Invalid Date", () => {
    const b = buildPricingBody(
      "bad.com",
      [offer({ min_price: 100 }, { freshness: "not a date" })],
      RATES,
      null,
      METRICS
    );
    expect(b.pricing.standard.last_updated).toBeNull();
  });
});
