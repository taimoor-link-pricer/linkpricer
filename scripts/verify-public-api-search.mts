// Live check of the search endpoint's query against the real catalogue.
//
// Runs a spread of searches through runSearch() — the function the endpoint
// calls — and asserts, for every result, the things the docs promise:
//
//   - it satisfies each numeric filter on the numbers it publishes;
//   - it is priced for the niche searched (standard when none was given);
//   - results are in the requested order, with no domain twice, and never
//     more than `limit`;
//   - its body is exactly what the pricing endpoint returns for that domain.
//
// Country, language and TLD are checked too, the first two against the raw
// catalogue row, since the body does not publish a language.
//
// Read-only. Touches no API key, counter or log row.
//
//   npx tsx --env-file=.env.local scripts/verify-public-api-search.mts

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getUsdRates } from "@/lib/currency";
import { fetchCatalog, pricingBodyFor } from "@/lib/public-api/batch-handler";
import { runSearch } from "@/lib/public-api/search-handler";
import { parseSearchRequest, searchPrice, sortResults, type ParsedSearch } from "@/lib/public-api/search";
import { countryValueMatches } from "@/lib/search/country-normalize";
import { normalizeLanguage } from "@/lib/search/language-normalize";

const CASES: Record<string, unknown>[] = [
  { filters: { min_dr: 40 } },
  { filters: { min_dr: 40, max_dr: 60, country: ["US"], max_price: 200 } },
  { filters: { country: ["DE", "AT"], language: "de", min_dr: 30 }, sort: "traffic" },
  { filters: { min_traffic: 5000, max_price: 150 }, sort: "price" },
  { filters: { min_price: 100, max_price: 300 }, sort: "price", order: "desc" },
  { filters: { min_dr: 50 }, niche: "gambling", sort: "price" },
  { filters: { tld: ["dk", "se"], min_dr: 20 }, limit: 10 },
  { filters: { category: ["technology"], min_dr: 30, max_price: 250 } },
  { filters: { min_ref_domains: 1000, country: "GB" }, sort: "ref_domains" },
  { filters: { max_price: 10 } },
  { filters: { min_dr: 20, max_price: 60 }, niche: "crypto", sort: "dr", order: "asc" },
  { filters: { country: ["NL"], max_traffic: 2000 }, sort: "traffic", order: "asc" },
  { filters: { min_dr: 99, tld: ["zz"] } },
  // "uk" is a GB alias and "ukraine" starts with it: GB must not return Ukraine.
  { filters: { country: ["GB"], min_dr: 80 }, limit: 50 },
  { filters: { country: ["NE"] } },
];


const rates = await getUsdRates();
let failures = 0;
const fail = (label: string, msg: string) => {
  failures++;
  console.log(`  FAIL ${label}: ${msg}`);
};

for (const request of CASES) {
  const label = JSON.stringify(request);
  const parsed = parseSearchRequest(request);
  if (!parsed.ok) {
    fail(label, `did not parse: ${parsed.code}`);
    continue;
  }
  const p = parsed as ParsedSearch;
  const t0 = Date.now();
  const { results, hasMore } = await runSearch(p, rates);
  const ms = Date.now() - t0;
  console.log(`${label}\n  ${results.length} results, has_more=${hasMore}, ${ms} ms`);

  if (results.length > p.limit) fail(label, `returned ${results.length} > limit ${p.limit}`);
  if (new Set(results.map((r) => r.domain)).size !== results.length) fail(label, "a domain appears twice");

  const resorted = sortResults(results, p.sort, p.niche).map((r) => r.domain);
  if (resorted.join() !== results.map((r) => r.domain).join()) fail(label, "results are not in the requested order");

  const f = p.filters;
  for (const r of results) {
    const m = r.data.metrics;
    const price = searchPrice(r.data, p.niche);
    const check = (ok: boolean, what: string) => {
      if (!ok) fail(label, `${r.domain}: ${what}`);
    };
    check(r.data.found && price != null, "not priced for the searched niche");
    check(f.min_price == null || (price ?? -1) >= f.min_price, `price ${price} < min_price`);
    check(f.max_price == null || (price ?? Infinity) <= f.max_price, `price ${price} > max_price`);
    check(f.min_dr == null || (m.domain_rating ?? -1) >= f.min_dr, `DR ${m.domain_rating} < min_dr`);
    check(f.max_dr == null || ((m.domain_rating ?? 0) > 0 && m.domain_rating! <= f.max_dr), `DR ${m.domain_rating} > max_dr`);
    check(f.min_traffic == null || (m.organic_traffic ?? -1) >= f.min_traffic, `traffic ${m.organic_traffic} < min_traffic`);
    check(f.max_traffic == null || ((m.organic_traffic ?? 0) > 0 && m.organic_traffic! <= f.max_traffic), `traffic ${m.organic_traffic} > max_traffic`);
    check(f.min_ref_domains == null || (m.ref_domains ?? -1) >= f.min_ref_domains, `ref domains ${m.ref_domains} < min`);
    check(!f.tld || f.tld.some((t) => r.domain.endsWith(`.${t}`)), "TLD does not match");
  }

  if (results.length) {
    // Same body as the pricing endpoint, built independently of the search.
    const hosts = results.map((r) => r.domain);
    const catalog = await fetchCatalog(hosts);
    for (const r of results) {
      const direct = pricingBodyFor(r.domain, catalog.get(r.domain), rates, p.niche);
      if (JSON.stringify(direct) !== JSON.stringify(r.data)) fail(label, `${r.domain}: body differs from the pricing endpoint`);
    }

    // Country and language against the catalogue rows themselves. A host can
    // be stored under more than one spelling, so any matching row will do.
    if (f.country || f.language) {
      const rows = (
        await db.execute(sql`
          SELECT lower(domain) AS host, country_main_traffic AS country, language_written_in_website AS lang
          FROM domains WHERE lower(domain) IN (${sql.join(hosts.map((h) => sql`${h}`), sql`, `)})
        `)
      ).rows as { host: string; country: string | null; lang: string | null }[];
      for (const host of hosts) {
        const mine = rows.filter((x) => x.host === host);
        if (f.country && !mine.some((x) => x.country && (f.country ?? []).some((c) => countryValueMatches(x.country, c)))) {
          fail(label, `${host}: country ${JSON.stringify(mine.map((x) => x.country))} is not in ${f.country.join("/")}`);
        }
        if (f.language && !mine.some((x) => normalizeLanguage(x.lang) === f.language)) {
          fail(label, `${host}: language ${JSON.stringify(mine.map((x) => x.lang))} is not ${f.language}`);
        }
      }
    }
  }
}

console.log(failures ? `\n${failures} failure(s)` : "\nAll searches hold.");
process.exit(failures ? 1 : 0);
