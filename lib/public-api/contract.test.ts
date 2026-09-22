/**
 * The published contract, pinned.
 *
 * This endpoint's shape has been changed twice without anything failing:
 * `?showmarketplace=` was added and later removed, and the €25 fee floor
 * repriced the fee-inclusive figures under callers who had been told the
 * markup was a flat 15%. Nothing in the codebase noticed either time.
 *
 * This file is that failure. It asserts the EXACT key set at every level, not
 * just the values, so a removed field, a renamed field, a re-nested field or
 * a spontaneously appearing one all fail here rather than in a customer's
 * integration. Changing the shape is allowed — it just has to be done on
 * purpose, by editing this file, which is the point.
 */

import { describe, it, expect } from "vitest";
import { buildPricingBody } from "@/lib/public-api/shape";
import type { RawOffer } from "@/lib/public-api/pricing";

// A deliberately awkward rate: EUR is not 1.0, so any figure that forgot to
// convert shows up as a wrong number rather than a coincidentally right one.
const RATES = { USD: 1, EUR: 1.25, GBP: 1.25 };

const offer = (
  prices: Record<string, number | null>,
  extra: Partial<RawOffer> = {}
): RawOffer => ({ currency: "USD", prices, trusted: false, ...extra });

/**
 * Four sources covering every branch the shape has: a trusted one (so the
 * recommendation is exercised), a non-USD one (conversion), niches only some
 * offers serve (exclusion), and a cheap niche where the €25 floor beats the
 * percentage.
 */
const OFFERS: RawOffer[] = [
  offer({ min_price: 260, gambling_min_price: 360, link_insertion_min_price: 20 }, { freshness: "2026-06-20T10:00:00Z" }),
  offer({ min_price: 300, gambling_min_price: 900 }, { trusted: true, freshness: "2026-05-02T10:00:00Z" }),
  offer({ min_price: 224, link_insertion_min_price: 28 }, { currency: "EUR", freshness: "2026-04-01T10:00:00Z" }),
  offer({ min_price: 420, gambling_min_price: 277.2, link_insertion_min_price: 32 }, { freshness: "2026-06-18T10:00:00Z" }),
];

const METRICS = {
  domain_rating: 45,
  organic_traffic: 12000,
  ref_domains: 1200,
  country: "United States",
};

const body = () => buildPricingBody("techblog.com", OFFERS, RATES, null, METRICS);

describe("the published response, field by field", () => {
  it("is exactly this object, to the cent", () => {
    // The golden. If this fails, every integration on this endpoint changed.
    expect(body()).toEqual({
      domain: "techblog.com",
      found: true,
      currency: "USD",
      fee: { percent: 15, minimum_usd: 31.25 },
      pricing: {
        standard: {
          label: "Standard / general",
          summary: "LinkPricer best price for Standard / general: $299 (4 sources).",
          marketplace: { lowest: 260, average: 315, highest: 420 },
          linkpricer: { lowest: 299, average: 362.25, highest: 483, recommended: 345 },
          offer_count: 4,
          last_updated: "2026-06-20",
        },
        gambling: {
          label: "Gambling / iGaming",
          summary: "LinkPricer best price for Gambling / iGaming: $319 (3 sources).",
          marketplace: { lowest: 277.2, average: 512.4, highest: 900 },
          linkpricer: { lowest: 319, average: 589.33, highest: 1035, recommended: 1035 },
          offer_count: 3,
          last_updated: "2026-06-20",
        },
        link_insertion: {
          label: "Link insertion",
          summary: "LinkPricer best price for Link insertion: $51 (3 sources).",
          marketplace: { lowest: 20, average: 29, highest: 35 },
          linkpricer: { lowest: 51, average: 60, highest: 66, recommended: null },
          offer_count: 3,
          last_updated: "2026-06-20",
        },
      },
      available_niches: ["standard", "gambling", "link_insertion"],
      metrics: {
        domain_rating: 45,
        organic_traffic: 12000,
        ref_domains: 1200,
        country: "United States",
      },
      last_updated: "2026-06-20",
    });
  });

  it("has exactly these top-level keys", () => {
    expect(Object.keys(body()).sort()).toEqual(
      ["available_niches", "currency", "domain", "fee", "found", "last_updated", "metrics", "pricing"].sort()
    );
  });

  it("has exactly these keys on every priced niche", () => {
    for (const niche of Object.values(body().pricing)) {
      expect(Object.keys(niche).sort()).toEqual(
        ["label", "summary", "marketplace", "linkpricer", "offer_count", "last_updated"].sort()
      );
      expect(Object.keys(niche.marketplace).sort()).toEqual(["lowest", "average", "highest"].sort());
      expect(Object.keys(niche.linkpricer).sort()).toEqual(
        ["lowest", "average", "highest", "recommended"].sort()
      );
    }
  });

  it("has exactly these keys on fee and metrics", () => {
    expect(Object.keys(body().fee).sort()).toEqual(["minimum_usd", "percent"].sort());
    expect(Object.keys(body().metrics).sort()).toEqual(
      ["country", "domain_rating", "organic_traffic", "ref_domains"].sort()
    );
  });

  it("carries none of the retired flat field names anywhere", () => {
    // The old shape's five flat price fields are gone, not duplicated
    // alongside the new ones. A response carrying both would be the exact
    // confusion the new shape exists to remove.
    const json = JSON.stringify(body());
    for (const retired of [
      "best_price",
      "average_price",
      "highest_price",
      "our_price",
      "recommended_price",
      "lp_prices",
      "lp_fee_percent",
      "lp_fee_min",
    ]) {
      expect(json, `${retired} should not appear in the response`).not.toContain(retired);
    }
  });

  it("keeps the nullable fields nullable and the rest not", () => {
    const empty = buildPricingBody("nothing.com", [], RATES, null, {
      domain_rating: null,
      organic_traffic: null,
      ref_domains: null,
      country: null,
    });

    expect(empty.found).toBe(false);
    expect(empty.pricing).toEqual({});
    expect(empty.available_niches).toEqual([]);
    // Not a date, not today's date, not an empty string.
    expect(empty.last_updated).toBeNull();
    expect(empty.metrics.country).toBeNull();
    expect(empty.domain).toBe("nothing.com");
    // The fee is a property of our pricing, not of the domain, so it is
    // reported even when nothing is priced.
    expect(empty.fee).toEqual({ percent: 15, minimum_usd: 31.25 });
  });

  it("omits a niche no source can serve rather than returning it with nulls", () => {
    expect(body().pricing).not.toHaveProperty("crypto");
    expect(body().available_niches).not.toContain("crypto");
  });

  it("never returns a fractional headline or recommended price", () => {
    for (const n of Object.values(body().pricing)) {
      expect(Number.isInteger(n.linkpricer.lowest)).toBe(true);
      expect(Number.isInteger(n.linkpricer.highest)).toBe(true);
      if (n.linkpricer.recommended != null) {
        expect(Number.isInteger(n.linkpricer.recommended)).toBe(true);
      }
    }
  });

  it("never names a marketplace or leaks an internal field", () => {
    const json = JSON.stringify(body());
    for (const leak of [
      "marketplace_name",
      "supplier",
      "vendor",
      "trusted",
      "domain_id",
      "api_key",
      "user_id",
    ]) {
      expect(json).not.toContain(leak);
    }
  });
});
