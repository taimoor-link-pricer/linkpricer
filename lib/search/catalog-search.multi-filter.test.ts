// Multi-select country/niche filters — the OR semantics, and that the
// singular legacy fields still mean exactly what they used to.
//
// The searchCatalog cases here hit the real Neon catalogue: the whole point
// of the change is which rows the SQL returns, and a mocked db would only
// re-assert the string I wrote. They pass sortBy:"dr", which skips the
// Claude rerank entirely (see CatalogSearchOptions), so they cost nothing
// but a read query and stay deterministic. They skip themselves when
// DATABASE_URL is not available.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// vitest does not load .env.local into process.env (vite only exposes
// VITE_-prefixed vars, and only on import.meta.env), and lib/db reads
// DATABASE_URL at import time — so load it here, before the dynamic import.
for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { normalizeFilterList, searchCatalog } = await import("./catalog-search");

describe("normalizeFilterList", () => {
  it("folds the legacy single value into the list", () => {
    expect(normalizeFilterList(undefined, "US")).toEqual(["US"]);
    expect(normalizeFilterList(["DE"], "US")).toEqual(["DE", "US"]);
  });

  it("is order-independent and de-duplicated, so the cache key cannot split", () => {
    expect(normalizeFilterList(["US", "DE"], undefined)).toEqual(normalizeFilterList(["DE", "US"], undefined));
    expect(normalizeFilterList(["US", "US"], "US")).toEqual(["US"]);
  });

  it("drops blanks rather than turning them into a LIKE '%%' that matches everything", () => {
    expect(normalizeFilterList(["", "  ", "US"], undefined)).toEqual(["US"]);
    expect(normalizeFilterList([], "")).toEqual([]);
  });
});

const hasDb = !!process.env.DATABASE_URL;
const dbIt = hasDb ? it : it.skip;

// Plain-column sort => no Claude call. Small result size keeps it quick.
const base = { query: "news", sortBy: "dr" as const, sortDir: "desc" as const, finalResultSize: 40 };
const domains = (o: { results: { domain: string }[] }) => new Set(o.results.map((r) => r.domain));

describe("searchCatalog multi-select country", { timeout: 120_000 }, () => {
  dbIt("returns the union of the single-country searches, and nothing else", async () => {
    const [us, de, both] = [
      await searchCatalog({ ...base, filters: { countries: ["US"] } }),
      await searchCatalog({ ...base, filters: { countries: ["DE"] } }),
      await searchCatalog({ ...base, filters: { countries: ["US", "DE"] } }),
    ];
    expect(us.results.length).toBeGreaterThan(0);
    expect(de.results.length).toBeGreaterThan(0);

    // Both single-country sets must be represented in the combined search.
    // Asserted as "some of each survives", not "all of each": the combined
    // pool is the same size as either single one, so the lower-DR tail of
    // each is legitimately cut by the shared result cap.
    const bothDomains = domains(both);
    expect([...domains(us)].some((d) => bothDomains.has(d))).toBe(true);
    expect([...domains(de)].some((d) => bothDomains.has(d))).toBe(true);

    // And it must not have quietly become "no country filter": every row
    // still has to be one of the two countries.
    const allowed = /united states|usa|germany|deutschland/i;
    for (const r of both.results) expect(r.country, `${r.domain} -> ${r.country}`).toMatch(allowed);
  });

  // Note this passes by *cache hit*: both spellings normalize to the same
  // cache key, so the second call returns the first one's result rather than
  // re-running the SQL. That is the property being asserted — one search,
  // not two searches that happen to agree.
  dbIt("treats the legacy singular `country` as a one-element list", async () => {
    const legacy = await searchCatalog({ ...base, filters: { country: "US" } });
    const list = await searchCatalog({ ...base, filters: { countries: ["US"] } });
    expect([...domains(legacy)].sort()).toEqual([...domains(list)].sort());
  });

  dbIt("still narrows — a single country is a strict subset of unfiltered", async () => {
    const all = await searchCatalog({ ...base });
    const us = await searchCatalog({ ...base, filters: { countries: ["US"] } });
    for (const r of us.results) expect(r.country).toMatch(/united states|usa/i);
    expect(domains(us)).not.toEqual(domains(all));
  });
});

describe("searchCatalog multi-select niche/category", { timeout: 120_000 }, () => {
  dbIt("ORs the selected categories instead of intersecting them to nothing", async () => {
    const [crypto, gambling, both] = [
      await searchCatalog({ ...base, filters: { categories: ["crypto"] } }),
      await searchCatalog({ ...base, filters: { categories: ["gambling"] } }),
      await searchCatalog({ ...base, filters: { categories: ["crypto", "gambling"] } }),
    ];
    // The AND bug this guards against would return zero: no single domain
    // carries both category strings.
    expect(both.results.length).toBeGreaterThan(0);
    expect(both.results.length).toBeGreaterThanOrEqual(Math.max(crypto.results.length, gambling.results.length));
    for (const r of both.results) expect(r.category, r.domain).toMatch(/crypto|gambl/i);
  });

  dbIt("treats the legacy singular `category` as a one-element list", async () => {
    const legacy = await searchCatalog({ ...base, filters: { category: "crypto" } });
    const list = await searchCatalog({ ...base, filters: { categories: ["crypto"] } });
    expect([...domains(legacy)].sort()).toEqual([...domains(list)].sort());
  });
});
