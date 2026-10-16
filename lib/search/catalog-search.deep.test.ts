// Deep (paginated) Related Sites search: the first page returns every site
// the reranker scored, searchCatalogTail returns the rest of the related
// sites as ids, and fetchResultRowsByIds loads a page of them.
//
// These hit the real Neon catalogue and the real embeddings endpoint, for the
// same reason the multi-filter tests do: what is being asserted is which rows
// the queries return. They do NOT call the reranker — SEARCH_RERANK_PROVIDER
// is forced to "none" below, which is the module's own measurement hook — so
// a run costs two embedding calls (a few tokens) and nothing else. They skip
// themselves when DATABASE_URL or OPENAI_API_KEY is not available.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { countryCode } from "./country-normalize";
import { languageMatchValues, normalizeLanguage } from "./language-normalize";

for (const file of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
process.env.SEARCH_RERANK_PROVIDER = "none";

const { searchCatalog, searchCatalogTail, fetchResultRowsByIds } = await import("./catalog-search");

describe("languageMatchValues", () => {
  // The SQL language filter selects rows by these values and the JS filter
  // then re-checks them with normalizeLanguage. If the two disagree, the SQL
  // side silently hides rows the JS side would have accepted.
  it("lists only spellings normalizeLanguage maps to that code", () => {
    for (const code of ["en", "de", "fr", "es", "pt", "da", "no", "sv"]) {
      const values = languageMatchValues(code);
      expect(values.length, code).toBeGreaterThan(1);
      for (const v of values) expect(normalizeLanguage(v), `${v} -> ${code}`).toBe(code);
    }
  });

  it("covers the messy spellings the column actually holds", () => {
    expect(languageMatchValues("de")).toEqual(expect.arrayContaining(["german", "germany", "deutsch", "de"]));
    expect(languageMatchValues("en")).toEqual(expect.arrayContaining(["english", "anglais", "en"]));
  });

  it("passes an unlisted two-letter code through, as normalizeLanguage does", () => {
    // A code the alias table has never heard of, in either direction.
    expect(normalizeLanguage("zz")).toBe("zz");
    expect(languageMatchValues("zz")).toEqual(["zz"]);
    // "dk" is claimed by Danish in the alias table, so it is not its own code.
    expect(languageMatchValues("dk")).toEqual([]);
    expect(languageMatchValues("")).toEqual([]);
  });
});

const live = !!process.env.DATABASE_URL && !!process.env.OPENAI_API_KEY;
const liveIt = live ? it : it.skip;
const deep = { claudeShortlistSize: 160, finalResultSize: 30, deep: true } as const;

describe("deep search", { timeout: 240_000 }, () => {
  // The bug this guards: country was applied to the nearest 150 sites of the
  // whole catalogue, so a filtered search kept only the handful of those 150
  // that happened to be in the country — and then showed at most 30.
  //
  // What can be asserted here does not depend on the database's cache. With
  // the index warm the shortlist is drawn from inside the country; cold, the
  // search goes ahead with the unfiltered neighbours rather than wait (see
  // headVectorCandidates) and the country's sites arrive through the tail.
  // Either way every row must be in the country, and nothing is cut at 30.
  liveIt("returns every scored site, all of them inside the filtered country", async () => {
    const us = await searchCatalog({ ...deep, query: "fashion", filters: { countries: ["US"] } });
    expect(us.results.length).toBeGreaterThan(30);
    for (const r of us.results) {
      expect(r.id, r.domain).toBeTruthy();
      expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("US");
    }
    expect(new Set(us.results.map((r) => r.id)).size).toBe(us.results.length);

    const de = await searchCatalog({ ...deep, query: "fashion", filters: { countries: ["DE"] } });
    expect(de.results.length).toBeGreaterThan(0);
    for (const r of de.results) expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("DE");
  });

  // The filtered read itself, given all the time it needs: the nearest sites
  // *inside* the country, not the country's share of the nearest sites
  // overall. This is the read the tail is built on.
  liveIt("reads nearest neighbours from inside a filter", async () => {
    const { embedQuery } = await import("./query-embedding");
    const { deepVectorCandidates } = await import("./vector-candidates");
    const { sql } = await import("drizzle-orm");
    const vec = await embedQuery("fashion");
    expect(vec).not.toBeNull();
    const germany = sql`AND lower(d.country_main_traffic) LIKE 'germany%'`;
    // A generous scan budget: the default one scales with the row limit and
    // would (correctly) stop short of 100 German sites for an English query.
    const rows = await deepVectorCandidates(vec!, 100, { filter: germany, maxScanTuples: 20000 });
    expect(rows).not.toBeNull();
    expect(rows!.length).toBe(100);
    for (let i = 1; i < rows!.length; i++) expect(rows![i].similarity).toBeLessThanOrEqual(rows![i - 1].similarity);
    const page = await fetchResultRowsByIds(rows!.slice(0, 20).map((r) => r.id));
    for (const r of page) expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("DE");
  });

  // The country clause strips a standalone "the" from stored names with a
  // regex. Its backslashes were being eaten by the template tag, turning it
  // into one that deleted "the" from inside words: "netherlands" became
  // "ne rlands", matched nothing, and the Netherlands filter returned no
  // sites at all. sortBy "dr" keeps this off the reranker and the embeddings.
  liveIt("finds sites for a country with 'the' inside its name", async () => {
    const out = await searchCatalog({
      query: "news", sortBy: "dr", sortDir: "desc", finalResultSize: 40, filters: { countries: ["NL"] },
    });
    expect(out.results.length).toBeGreaterThan(0);
    for (const r of out.results) expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("NL");
  });

  // The name-match arm reads fewer rows than it used to (only as many as the
  // search can keep). What it exists for must survive that: a site typed in
  // by name is found and put first, with or without a model to rank it.
  liveIt("still puts a site typed in by name first", async () => {
    const out = await searchCatalog({ query: "moneycontrol", claudeShortlistSize: 160, finalResultSize: 5 });
    expect(out.results[0]?.domain).toMatch(/^moneycontrol\./);
    // And a common word still fills its name-match pool.
    const common = await searchCatalog({ query: "news", sortBy: "dr", sortDir: "desc", finalResultSize: 500 });
    expect(common.results.length).toBeGreaterThan(300);
    for (const r of common.results.slice(0, 50)) expect(r.domain, r.domain).toMatch(/^(www\.)?news/);
  });

  liveIt("leaves a search that does not ask for deep mode capped as before", async () => {
    const out = await searchCatalog({ query: "fashion", claudeShortlistSize: 160, finalResultSize: 5 });
    expect(out.results.length).toBe(5);
    expect(out.tail).toBeUndefined();
  });

  liveIt("returns the rest of the related sites as a tail, filtered the same way", async () => {
    const filters = { countries: ["US"] };
    const head = await searchCatalog({ ...deep, query: "fashion", filters });
    expect(head.tail, "a broad US search has more related sites than the shortlist").toBeDefined();

    const headIds = head.results.map((r) => r.id);
    const tail = await searchCatalogTail({ query: "fashion", filters, anchor: head.tail!, excludeIds: headIds });
    expect(tail).not.toBeNull();
    expect(tail!.entries.length).toBeGreaterThan(0);

    // Nothing the first page already showed, nothing twice.
    const tailIds = tail!.entries.map((e) => e.id);
    expect(tailIds.some((id) => headIds.includes(id))).toBe(false);
    expect(new Set(tailIds).size).toBe(tailIds.length);

    // Nearest first, so the estimated match % never rises down the list, and
    // an estimate never reaches the band reserved for model-scored sites.
    const pcts = tail!.entries.map((e) => e.matchPct);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeLessThanOrEqual(pcts[i - 1]);
    expect(Math.max(...pcts)).toBeLessThan(60);
    expect(Math.min(...pcts)).toBeGreaterThan(0);

    // A page of the tail, loaded by id: same country, in the order asked
    // for, and every row actually for sale.
    const page = tailIds.slice(0, 10);
    const rows = await fetchResultRowsByIds(page);
    expect(rows.map((r) => r.id)).toEqual(page);
    for (const r of rows) {
      expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("US");
      expect(r.offers.length, r.domain).toBeGreaterThan(0);
    }
  });

  // The page asks for the tail twice: a quick pass (nearest few hundred, so a
  // count shows early) and then the full list if the quick pass says more
  // remain. The second must extend the first, not contradict it.
  liveIt("quick pass says when more remain, and the full list extends it", async () => {
    const filters = { countries: ["US"] };
    const head = await searchCatalog({ ...deep, query: "fashion", filters });
    const excludeIds = head.results.map((r) => r.id);
    // The cut-off of a model-scored search (70% of the best similarity). The
    // rerank is off in this file, and the unscored fallback is stricter.
    const anchor = { simTop: head.tail!.simTop, anchorSim: head.tail!.simTop * 0.88, anchorPct: 66, pctCap: 59 };

    const quick = await searchCatalogTail({ query: "fashion", filters, anchor, excludeIds, quick: true });
    expect(quick).not.toBeNull();
    expect(quick!.partial, "a broad US search has far more than the quick pass holds").toBe(true);
    expect(quick!.capped).toBe(true);

    const full = await searchCatalogTail({ query: "fashion", filters, anchor, excludeIds });
    expect(full!.partial).toBe(false);
    expect(full!.entries.length).toBeGreaterThan(quick!.entries.length);

    // Two separate index reads at different depths may disagree on a site or
    // two at the margin; they must not disagree on more than that, and where
    // they agree the site carries the same match %.
    const fullPct = new Map(full!.entries.map((e) => [e.id, e.matchPct]));
    const shared = quick!.entries.filter((e) => fullPct.has(e.id));
    expect(shared.length / quick!.entries.length).toBeGreaterThan(0.95);
    for (const e of shared) expect(Math.abs(e.matchPct - fullPct.get(e.id)!), e.id).toBeLessThanOrEqual(1);

    // Once the full list is in hand, a quick pass is cut from it and is then
    // exactly its beginning.
    const again = await searchCatalogTail({ query: "fashion", filters, anchor, excludeIds, quick: true });
    expect(again!.entries.map((e) => e.id)).toEqual(full!.entries.slice(0, again!.entries.length).map((e) => e.id));
  });

  // What searchCatalog hands back when its first page is empty only because
  // the head read fell back to unfiltered neighbours and none passed the
  // filters: a handle with no similarity in it. The tail must still list the
  // filtered sites from that, anchored on its own best match.
  liveIt("loads a filtered list from a handle that carries no similarity", async () => {
    const filters = { countries: ["DE"] };
    // The quick pass, as the page asks first.
    const tail = await searchCatalogTail({
      query: "fashion", filters, anchor: { simTop: 0, anchorSim: 0, anchorPct: 59, pctCap: 59 }, excludeIds: [], quick: true,
    });
    expect(tail).not.toBeNull();
    expect(tail!.entries.length).toBeGreaterThan(0);
    const pcts = tail!.entries.map((e) => e.matchPct);
    expect(pcts[0]).toBe(59);
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeLessThanOrEqual(pcts[i - 1]);
    const rows = await fetchResultRowsByIds(tail!.entries.slice(0, 10).map((e) => e.id));
    for (const r of rows) expect(countryCode(r.country), `${r.domain} -> ${r.country}`).toBe("DE");
  });

  liveIt("a quick pass that reaches the cut-off is the whole answer", async () => {
    // Narrow search: the list ends well inside the quick pass.
    const head = await searchCatalog({ ...deep, query: "methylene blue supplements" });
    if (!head.tail) return; // nothing beyond the shortlist at all — equally fine
    const tail = await searchCatalogTail({
      query: "methylene blue supplements", anchor: head.tail, excludeIds: head.results.map((r) => r.id), quick: true,
    });
    expect(tail!.partial).toBe(false);
    expect(tail!.capped).toBe(false);
  });

  liveIt("skips ids that do not exist instead of failing the page", async () => {
    expect(await fetchResultRowsByIds([])).toEqual([]);
    expect(await fetchResultRowsByIds(["00000000-0000-0000-0000-000000000000"])).toEqual([]);
  });
});
