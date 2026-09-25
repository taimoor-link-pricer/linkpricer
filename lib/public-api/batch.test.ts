/**
 * The v2 batch contract, pinned — the batch counterpart of contract.test.ts.
 *
 * Asserts the exact key set of the envelope and of every result, that each
 * result's `data` is byte-for-byte the v1 body for that domain, and the
 * request rules an integrator codes against (limit, dedupe, niche handling,
 * which failures cost nothing).
 */

import { describe, it, expect } from "vitest";
import {
  buildBatchBody,
  MAX_BATCH_DOMAINS,
  normalizeBatchDomain,
  parseBatchRequest,
  type ParsedBatch,
  type BatchUsage,
} from "@/lib/public-api/batch";
import { buildPricingBody } from "@/lib/public-api/shape";
import type { RawOffer } from "@/lib/public-api/pricing";

const RATES = { USD: 1, EUR: 1.25 };
const METRICS = { domain_rating: 55, organic_traffic: 12000, ref_domains: 900, country: "United States" };
const OFFERS: RawOffer[] = [
  { currency: "USD", prices: { min_price: 260, gambling_min_price: 360 }, trusted: true, freshness: "2026-09-01T00:00:00Z" },
  { currency: "EUR", prices: { min_price: 224 }, trusted: false, freshness: "2026-08-01T00:00:00Z" },
];
const USAGE: BatchUsage = { charged: 1, monthly_limit: 10000, monthly_remaining: 9999, resets_at: "2026-10-01T00:00:00.000Z" };

function mustParse(body: unknown): ParsedBatch {
  const p = parseBatchRequest(body);
  if (!p.ok) throw new Error(`expected ok, got ${p.code}`);
  return p;
}

describe("normalizeBatchDomain", () => {
  it("reduces pasted URLs to their host, like the Analyze page", () => {
    expect(normalizeBatchDomain("https://www.Example.com/blog/post?x=1#top")).toBe("example.com");
    expect(normalizeBatchDomain("  http://example.org  ")).toBe("example.org");
    expect(normalizeBatchDomain("example.net?ref=1")).toBe("example.net");
    expect(normalizeBatchDomain("EXAMPLE.io/")).toBe("example.io");
  });
});

describe("parseBatchRequest — request-level rejections (nothing charged)", () => {
  it.each([
    [null, 400, "invalid_request"],
    ["example.com", 400, "invalid_request"],
    [["example.com"], 400, "invalid_request"],
    [{}, 400, "invalid_request"],
    [{ domains: "example.com" }, 400, "invalid_request"],
    [{ domains: [] }, 422, "empty_batch"],
  ])("%j → %i %s", (body, status, code) => {
    const p = parseBatchRequest(body);
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.status).toBe(status);
      expect(p.code).toBe(code);
    }
  });

  it(`accepts exactly ${MAX_BATCH_DOMAINS} entries and rejects one more`, () => {
    const at = Array.from({ length: MAX_BATCH_DOMAINS }, (_, i) => `site${i}.com`);
    expect(parseBatchRequest({ domains: at }).ok).toBe(true);
    const over = parseBatchRequest({ domains: [...at, "one-more.com"] });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.status).toBe(422);
      expect(over.code).toBe("too_many_domains");
    }
  });

  it("counts the limit on what was sent, before de-duplication", () => {
    const dupes = Array.from({ length: MAX_BATCH_DOMAINS + 1 }, () => "same.com");
    const p = parseBatchRequest({ domains: dupes });
    expect(p.ok).toBe(false);
  });

  it("rejects an unknown niche and a non-string niche", () => {
    for (const niche of ["poker", 5, true]) {
      const p = parseBatchRequest({ domains: ["example.com"], niche });
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.code).toBe("invalid_niche");
    }
  });

  it("returns per-entry detail when every entry is invalid", () => {
    const p = parseBatchRequest({ domains: ["nodot", 42, "bad domain.com"] });
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.code).toBe("no_valid_domains");
      expect(p.status).toBe(422);
      expect(p.results?.map((r) => r.status)).toEqual(["invalid", "invalid", "invalid"]);
      expect(p.results?.[1].input).toBeNull();
    }
  });
});

describe("parseBatchRequest — accepted batches", () => {
  it("treats a blank or null niche as no filter, like v1's ?niche=", () => {
    for (const niche of [undefined, null, "", "   "]) {
      expect(mustParse({ domains: ["example.com"], niche }).niche).toBeNull();
    }
  });

  it("accepts the dashboard's niche aliases", () => {
    expect(mustParse({ domains: ["example.com"], niche: "igaming" }).niche).toBe("gambling");
    expect(mustParse({ domains: ["example.com"], niche: " Gambling " }).niche).toBe("gambling");
  });

  it("de-duplicates by normalized host, keeping first-seen order", () => {
    const p = mustParse({ domains: ["b.com", "https://www.A.com/x", "a.com", "b.com", "c.com"] });
    expect(p.unique).toEqual(["b.com", "a.com", "c.com"]);
    expect(p.entries).toHaveLength(5);
  });

  it("keeps invalid entries in place without looking them up", () => {
    const p = mustParse({ domains: ["good.com", "", "has space.com", 7, "also-good.org"] });
    expect(p.unique).toEqual(["good.com", "also-good.org"]);
    expect(p.entries.map((e) => e.error?.code ?? null)).toEqual([
      null,
      "invalid_domain",
      "invalid_domain",
      "invalid_domain",
      null,
    ]);
  });

  it("accepts internationalized domains, as v1 does", () => {
    expect(mustParse({ domains: ["lübeck.nu"] }).unique).toEqual(["lübeck.nu"]);
  });
});

describe("buildBatchBody — the published shape", () => {
  const parsed = mustParse({ domains: ["found.com", "missing.com", "not a domain", "https://found.com/page"], niche: "gambling" });
  const v1 = buildPricingBody("found.com", OFFERS, RATES, "gambling", METRICS);
  const body = buildBatchBody(parsed, new Map([["found.com", v1]]), USAGE);

  it("has exactly the documented top-level keys", () => {
    expect(Object.keys(body).sort()).toEqual(["api_version", "niche", "results", "summary", "usage"]);
    expect(body.api_version).toBe("2");
    expect(body.niche).toBe("gambling");
    expect(Object.keys(body.summary).sort()).toEqual(["invalid", "not_found", "ok", "requested", "unique_domains"]);
    expect(Object.keys(body.usage).sort()).toEqual(["charged", "monthly_limit", "monthly_remaining", "resets_at"]);
  });

  it("answers results[i] for domains[i], duplicates included", () => {
    expect(body.results.map((r) => [r.input, r.domain, r.status])).toEqual([
      ["found.com", "found.com", "ok"],
      ["missing.com", "missing.com", "not_found"],
      ["not a domain", null, "invalid"],
      ["https://found.com/page", "found.com", "ok"],
    ]);
    for (const r of body.results) {
      expect(Object.keys(r).sort()).toEqual(["data", "domain", "error", "input", "status"]);
    }
  });

  it("carries the v1 body unchanged as each ok result's data", () => {
    expect(body.results[0].data).toEqual(v1);
    expect(body.results[3].data).toEqual(v1);
    expect(body.results[0].error).toBeNull();
  });

  it("gives not_found and invalid results an error and no data", () => {
    expect(body.results[1]).toMatchObject({ data: null, error: { code: "domain_not_found" } });
    expect(body.results[2]).toMatchObject({ data: null, error: { code: "invalid_domain" } });
  });

  it("summarises per entry, with unique_domains as what was looked up", () => {
    expect(body.summary).toEqual({ requested: 4, unique_domains: 2, ok: 2, not_found: 1, invalid: 1 });
  });
});
