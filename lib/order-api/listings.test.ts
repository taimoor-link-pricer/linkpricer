import { describe, it, expect, vi, beforeEach } from "vitest";

const catalog = vi.hoisted(() => ({ offers: [] as Record<string, unknown>[] }));
vi.mock("@/lib/public-api/handler", () => ({
  fetchDomainCatalog: async () => ({ domain_row: {}, offers: catalog.offers }),
}));
vi.mock("@/lib/db", () => ({
  db: { execute: async () => ({ rows: [{ domain: "Example.com" }] }) },
}));

import { getListings, findListing } from "./listings";
import { aggregatePricing } from "@/lib/public-api/pricing";
import { toOffer } from "@/lib/public-api/common";

const RATES = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };
const ID_A = "11111111-1111-1111-1111-111111111111";
const ID_B = "22222222-2222-2222-2222-222222222222";

function row(id: string, over: Record<string, unknown>): Record<string, unknown> {
  return {
    listing_id: `M-${id}`,
    source_name: "adsy.com",
    currency: "USD",
    min_price: null,
    gambling_min_price: null,
    loan_min_price: null,
    trusted: false,
    freshness: "2026-09-20T10:11:12",
    delivery_time_days: 5,
    link_type: "DoFollow",
    sponsored_tag: "No",
    duration: "permanently",
    ...over,
  };
}

beforeEach(() => {
  catalog.offers = [
    row(ID_A, { min_price: "200", gambling_min_price: "400" }),
    row(ID_B, { source_name: "eur-market", currency: "EUR", min_price: "150", loan_min_price: "0" }),
  ];
});

describe("getListings", () => {
  it("prices the cheapest listing exactly as the pricing API's linkpricer.lowest", async () => {
    const listings = await getListings("example.com", RATES, "general");
    const quoted = aggregatePricing(catalog.offers.map(toOffer), RATES, "standard").pricing.standard;
    expect(Number(listings[0].price)).toBe(quoted.linkpricer.lowest);
    expect(Number(listings[listings.length - 1].price)).toBe(quoted.linkpricer.highest);
  });

  it("maps robot niches to ours and skips offers that do not sell the niche", async () => {
    const gambling = await getListings("example.com", RATES, "igaming");
    expect(gambling.map((l) => l.listing_id)).toEqual([`M-${ID_A}`]);
    // A zero niche price means "not offered", so finance has no listings.
    expect(await getListings("example.com", RATES, "finance")).toEqual([]);
  });

  it("returns one entry per niche when no niche is asked for, cheapest first", async () => {
    const all = await getListings("example.com", RATES, null);
    expect(all.map((l) => l.niche).sort()).toEqual(["general", "general", "igaming"]);
    const prices = all.map((l) => Number(l.price));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("normalizes conditions and formats money as strings", async () => {
    const [l] = await getListings("example.com", RATES, "igaming");
    expect(l).toMatchObject({
      link_type: "dofollow",
      duration: "lifetime",
      sponsored_tag: false,
      turnaround_days: 5,
      product: "guest_post",
      currency: "USD",
      updated_at: "2026-09-20T10:11:12.000Z",
    });
    expect(l.price).toMatch(/^\d+\.\d{2}$/);
  });

  it("is an empty list for an unlisted domain", async () => {
    catalog.offers = [];
    expect(await getListings("nothing.example", RATES, null)).toEqual([]);
  });
});

describe("findListing", () => {
  it("returns the same price the lookup showed", async () => {
    const [shown] = await getListings("example.com", RATES, "igaming");
    const found = await findListing(`M-${ID_A}`, "igaming", RATES);
    expect(found?.listing.price).toBe(shown.price);
    expect(found?.domain).toBe("example.com");
  });

  it("is null for a listing the pool no longer carries, or a niche it does not sell", async () => {
    expect(await findListing("M-33333333-3333-3333-3333-333333333333", "general", RATES)).toBeNull();
    expect(await findListing(`M-${ID_B}`, "igaming", RATES)).toBeNull();
    expect(await findListing("not-an-id", "general", RATES)).toBeNull();
  });
});
