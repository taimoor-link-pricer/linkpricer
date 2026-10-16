/**
 * The search contract, pinned — the search counterpart of batch.test.ts.
 *
 * Asserts the request rules an integrator codes against (which filters exist,
 * what is refused and why, the defaults), that the price filter is exactly the
 * published fee-inclusive price, that a result contradicting a filter is never
 * returned, and the exact key set of the response.
 */

import { describe, it, expect } from "vitest";
import {
  buildSearchBody,
  FILTER_KEYS,
  matchesSearch,
  MAX_FILTER_VALUES,
  MAX_SEARCH_RESULTS,
  parseSearchRequest,
  searchPrice,
  sortResults,
  sourcePriceBounds,
  type ParsedSearch,
  type SearchResult,
} from "@/lib/public-api/search";
import type { BatchUsage } from "@/lib/public-api/batch";
import { minFeeCents, withFeeUsd } from "@/lib/pricing/fee";
import type { RawOffer } from "@/lib/public-api/pricing";
import { buildPricingBody, type PublicMetrics } from "@/lib/public-api/shape";

const RATES = { USD: 1, EUR: 1.25 };
const FLOOR = minFeeCents(RATES);
const USAGE: BatchUsage = { charged: 2, monthly_limit: 10000, monthly_remaining: 9998, resets_at: "2026-11-01T00:00:00.000Z" };

function mustParse(body: unknown): ParsedSearch {
  const p = parseSearchRequest(body);
  if (!p.ok) throw new Error(`expected ok, got ${p.code}: ${p.message}`);
  return p;
}

function site(
  domain: string,
  price: number,
  metrics: Partial<PublicMetrics> = {},
  extra: Record<string, number> = {}
): SearchResult {
  const offers: RawOffer[] = [{ currency: "USD", prices: { min_price: price, ...extra }, trusted: false, freshness: null }];
  const m = { domain_rating: 50, organic_traffic: 10000, ref_domains: 800, country: "United States", ...metrics };
  return { domain, data: buildPricingBody(domain, offers, RATES, null, m) };
}

describe("parseSearchRequest — a niche is a search on its own", () => {
  it.each([{ niche: "gambling" }, { niche: "igaming" }, { filters: {}, niche: "crypto" }, { filters: null, niche: "cbd" }])(
    "%j",
    (body) => {
      const parsed = parseSearchRequest(body);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.filters).toEqual({});
    }
  );
});

describe("parseSearchRequest — request-level rejections (nothing charged)", () => {
  it.each([
    [null, 400, "invalid_request"],
    ["min_dr=40", 400, "invalid_request"],
    [[{ min_dr: 40 }], 400, "invalid_request"],
    [{ filters: "min_dr" }, 400, "invalid_request"],
    [{ filters: [] }, 400, "invalid_request"],
    // Nothing narrows the search: neither a filter nor a niche.
    [{}, 422, "no_filters"],
    [{ filters: {} }, 422, "no_filters"],
    [{ filters: { min_dr: null } }, 422, "no_filters"],
    [{ niche: "" }, 422, "no_filters"],
    [{ niche: "pizza" }, 422, "invalid_niche"],
    [{ filters: { min_dr: 40 }, min_traffic: 1000 }, 422, "unknown_field"],
    [{ filters: { min_dr: 40 }, page: 2 }, 422, "unknown_field"],
    [{ filters: { min_DR: 40 } }, 422, "unknown_filter"],
    [{ filters: { dofollow: true } }, 422, "unknown_filter"],
    [{ filters: { min_dr: "40" } }, 422, "invalid_filter"],
    [{ filters: { min_dr: 101 } }, 422, "invalid_filter"],
    [{ filters: { min_dr: 40.5 } }, 422, "invalid_filter"],
    [{ filters: { min_dr: 60, max_dr: 40 } }, 422, "invalid_filter"],
    [{ filters: { min_traffic: -1 } }, 422, "invalid_filter"],
    [{ filters: { max_price: 0 } }, 422, "invalid_filter"],
    [{ filters: { min_price: 300, max_price: 100 } }, 422, "invalid_filter"],
    [{ filters: { country: [] } }, 422, "invalid_filter"],
    [{ filters: { country: [1] } }, 422, "invalid_filter"],
    [{ filters: { country: "Germany" } }, 422, "invalid_country"],
    [{ filters: { country: ["US", "ZZ"] } }, 422, "invalid_country"],
    [{ filters: { language: "english" } }, 422, "invalid_language"],
    [{ filters: { language: ["en"] } }, 422, "invalid_language"],
    [{ filters: { tld: "c%m" } }, 422, "invalid_tld"],
    [{ filters: { tld: "co_uk" } }, 422, "invalid_tld"],
    [{ filters: { category: "%" } }, 422, "invalid_category"],
    [{ filters: { category: "a_b" } }, 422, "invalid_category"],
    [{ filters: { min_dr: 40 }, niche: "casino" }, 422, "invalid_niche"],
    [{ filters: { min_dr: 40 }, niche: 7 }, 422, "invalid_niche"],
    [{ filters: { min_dr: 40 }, sort: "domain" }, 422, "invalid_sort"],
    [{ filters: { min_dr: 40 }, order: "down" }, 422, "invalid_sort"],
    [{ filters: { min_dr: 40 }, limit: 0 }, 422, "invalid_limit"],
    [{ filters: { min_dr: 40 }, limit: MAX_SEARCH_RESULTS + 1 }, 422, "invalid_limit"],
    [{ filters: { min_dr: 40 }, limit: "10" }, 422, "invalid_limit"],
  ])("%j → %i %s", (body, status, code) => {
    const p = parseSearchRequest(body);
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.status).toBe(status);
      expect(p.code).toBe(code);
    }
  });

  it("tells a caller who put a filter at the top level where it belongs", () => {
    const p = parseSearchRequest({ filters: { min_dr: 40 }, country: "US" });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.message).toContain('inside "filters"');
  });

  it("caps a list filter", () => {
    const tooMany = Array.from({ length: MAX_FILTER_VALUES + 1 }, (_, i) => `t${i}`);
    const p = parseSearchRequest({ filters: { tld: tooMany } });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.code).toBe("invalid_filter");
  });

  it("names every accepted filter when one is unknown", () => {
    const p = parseSearchRequest({ filters: { colour: "red" } });
    expect(p.ok).toBe(false);
    if (!p.ok) for (const key of FILTER_KEYS) expect(p.message).toContain(key);
  });
});

describe("parseSearchRequest — defaults and normalization", () => {
  it("defaults to the strongest sites first, a full page, every niche", () => {
    const p = mustParse({ filters: { min_dr: 40 } });
    expect(p.niche).toBeNull();
    expect(p.sort).toEqual({ by: "dr", order: "desc" });
    expect(p.limit).toBe(MAX_SEARCH_RESULTS);
    expect(p.filters).toEqual({ min_dr: 40 });
  });

  it("sorts price cheapest first unless told otherwise", () => {
    expect(mustParse({ filters: { min_dr: 40 }, sort: "price" }).sort).toEqual({ by: "price", order: "asc" });
    expect(mustParse({ filters: { min_dr: 40 }, sort: "price", order: "desc" }).sort).toEqual({ by: "price", order: "desc" });
    expect(mustParse({ filters: { min_dr: 40 }, sort: "traffic", order: "asc" }).sort).toEqual({ by: "traffic", order: "asc" });
  });

  it("accepts one value or a list, and normalizes both to a clean list", () => {
    const p = mustParse({
      filters: { country: "us", tld: [".DE", "de", "co.uk"], category: [" Technology ", "technology"], language: " EN " },
    });
    expect(p.filters).toEqual({ country: ["US"], tld: ["de", "co.uk"], category: ["technology"], language: "en" });
  });

  it("treats null and blank the way the pricing endpoint does", () => {
    const p = mustParse({ filters: { min_dr: 40, max_price: null, country: null }, niche: "  ", sort: null, limit: null });
    expect(p.filters).toEqual({ min_dr: 40 });
    expect(p.niche).toBeNull();
    expect(p.limit).toBe(MAX_SEARCH_RESULTS);
  });

  it("resolves niche synonyms to the canonical id", () => {
    expect(mustParse({ filters: { min_dr: 40 }, niche: "iGaming" }).niche).toBe("gambling");
  });

  it("keeps every numeric filter it was given", () => {
    const filters = {
      min_dr: 30, max_dr: 70, min_traffic: 1000, max_traffic: 50000,
      min_ref_domains: 100, max_ref_domains: 9000, min_price: 50, max_price: 249.5,
    };
    expect(mustParse({ filters }).filters).toEqual(filters);
  });
});

describe("sourcePriceBounds — the price filter is the fee-inclusive price", () => {
  it("is the exact boundary of withFeeUsd, to the cent", () => {
    for (const max of [29, 30, 49, 100, 199.99, 219, 220, 500, 1234.5]) {
      const b = sourcePriceBounds({ max_price: max }, FLOOR);
      if (b.none) {
        expect(withFeeUsd(0.01, FLOOR)).toBeGreaterThan(max);
        continue;
      }
      expect(withFeeUsd(b.max!, FLOOR)).toBeLessThanOrEqual(max);
      expect(withFeeUsd(b.max! + 0.01, FLOOR)).toBeGreaterThan(max);
    }
    for (const min of [1, 30, 49, 100, 219, 220, 500, 1234.5]) {
      const b = sourcePriceBounds({ min_price: min }, FLOOR);
      expect(withFeeUsd(b.min!, FLOOR)).toBeGreaterThanOrEqual(min);
      if (b.min! > 0.01) expect(withFeeUsd(b.min! - 0.01, FLOOR)).toBeLessThan(min);
    }
  });

  it("knows a max_price below the minimum fee can match nothing", () => {
    expect(sourcePriceBounds({ max_price: 10 }, FLOOR)).toEqual({ min: null, max: null, none: true });
  });

  it("leaves a side open when it was not asked for", () => {
    expect(sourcePriceBounds({}, FLOOR)).toEqual({ min: null, max: null, none: false });
    expect(sourcePriceBounds({ max_price: 300 }, FLOOR).min).toBeNull();
    expect(sourcePriceBounds({ min_price: 300 }, FLOOR).max).toBeNull();
  });
});

describe("matchesSearch — a result never contradicts the filter", () => {
  const body = site("example.com", 200, { domain_rating: 45, organic_traffic: 12000, ref_domains: 900 }).data;
  const lp = searchPrice(body, null)!;

  it("judges price on linkpricer.lowest, not the source price", () => {
    expect(lp).toBe(withFeeUsd(200, FLOOR));
    expect(lp).toBeGreaterThan(200);
    expect(matchesSearch(body, { max_price: lp }, null)).toBe(true);
    expect(matchesSearch(body, { max_price: lp - 1 }, null)).toBe(false);
    // The source price fits 200; what the caller pays does not.
    expect(matchesSearch(body, { max_price: 200 }, null)).toBe(false);
    expect(matchesSearch(body, { min_price: lp }, null)).toBe(true);
    expect(matchesSearch(body, { min_price: lp + 1 }, null)).toBe(false);
  });

  it("applies every metric range inclusively", () => {
    expect(matchesSearch(body, { min_dr: 45, max_dr: 45 }, null)).toBe(true);
    expect(matchesSearch(body, { min_dr: 46 }, null)).toBe(false);
    expect(matchesSearch(body, { max_dr: 44 }, null)).toBe(false);
    expect(matchesSearch(body, { min_traffic: 12000, max_traffic: 12000 }, null)).toBe(true);
    expect(matchesSearch(body, { min_traffic: 12001 }, null)).toBe(false);
    expect(matchesSearch(body, { min_ref_domains: 901 }, null)).toBe(false);
  });

  it("never matches a metric filter on a site whose metric is unknown", () => {
    const unknown = site("blank.com", 200, { domain_rating: 0, organic_traffic: null, ref_domains: 0 }).data;
    expect(matchesSearch(unknown, { max_dr: 30 }, null)).toBe(false);
    expect(matchesSearch(unknown, { min_dr: 0 }, null)).toBe(false);
    expect(matchesSearch(unknown, { max_traffic: 5000 }, null)).toBe(false);
    expect(matchesSearch(unknown, { max_ref_domains: 10 }, null)).toBe(false);
    // With no filter on those metrics it is an ordinary result.
    expect(matchesSearch(unknown, { max_price: 1000 }, null)).toBe(true);
  });

  it("requires a price for the niche searched", () => {
    const offers: RawOffer[] = [{ currency: "USD", prices: { min_price: 200, gambling_min_price: 400 }, trusted: false }];
    const m = { domain_rating: 45, organic_traffic: 100, ref_domains: 10, country: null };
    const gambling = buildPricingBody("g.com", offers, RATES, "gambling", m);
    const crypto = buildPricingBody("g.com", offers, RATES, "crypto", m);
    expect(matchesSearch(gambling, { min_dr: 40 }, "gambling")).toBe(true);
    expect(searchPrice(gambling, "gambling")).toBe(withFeeUsd(400, FLOOR));
    expect(crypto.found).toBe(false);
    expect(matchesSearch(crypto, { min_dr: 40 }, "crypto")).toBe(false);
  });
});

describe("sortResults", () => {
  const a = site("a.com", 300, { domain_rating: 70, organic_traffic: 500 });
  const b = site("b.com", 100, { domain_rating: 40, organic_traffic: 9000 });
  const c = site("c.com", 200, { domain_rating: 0, organic_traffic: null });
  const d = site("d.com", 100, { domain_rating: 40, organic_traffic: 9000 });
  const order = (by: "dr" | "traffic" | "price", dir: "asc" | "desc") =>
    sortResults([c, d, a, b], { by, order: dir }, null).map((r) => r.domain);

  it("orders by the published value, ties broken by domain", () => {
    expect(order("dr", "desc")).toEqual(["a.com", "b.com", "d.com", "c.com"]);
    expect(order("price", "asc")).toEqual(["b.com", "d.com", "c.com", "a.com"]);
    expect(order("price", "desc")).toEqual(["a.com", "c.com", "b.com", "d.com"]);
  });

  it("puts an unknown value last in both directions", () => {
    expect(order("dr", "asc")).toEqual(["b.com", "d.com", "a.com", "c.com"]);
    expect(order("traffic", "asc").at(-1)).toBe("c.com");
    expect(order("traffic", "desc").at(-1)).toBe("c.com");
  });
});

describe("buildSearchBody — the published shape", () => {
  const parsed = mustParse({ filters: { min_dr: 40, country: "us" }, niche: "igaming", limit: 2 });
  const results = [site("a.com", 300), site("b.com", 100)];
  const body = buildSearchBody(parsed, results, true, USAGE);

  it("has exactly these keys", () => {
    expect(Object.keys(body)).toEqual(["api_version", "niche", "filters", "sort", "summary", "usage", "results"]);
    expect(Object.keys(body.summary)).toEqual(["returned", "limit", "has_more"]);
    expect(Object.keys(body.usage)).toEqual(["charged", "monthly_limit", "monthly_remaining", "resets_at"]);
    expect(Object.keys(body.results[0])).toEqual(["domain", "data"]);
  });

  it("echoes the search as it was understood", () => {
    expect(body.api_version).toBe("1");
    expect(body.niche).toBe("gambling");
    expect(body.filters).toEqual({ min_dr: 40, country: ["US"] });
    expect(body.sort).toEqual({ by: "dr", order: "desc" });
    expect(body.summary).toEqual({ returned: 2, limit: 2, has_more: true });
  });

  it("carries the pricing endpoint's body for each domain, untouched", () => {
    expect(body.results[0].data).toBe(results[0].data);
    expect(Object.keys(body.results[0].data)).toEqual([
      "domain", "found", "currency", "fee", "pricing", "available_niches", "metrics", "last_updated",
    ]);
  });
});
