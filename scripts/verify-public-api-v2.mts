// Parity check: does the v2 batch endpoint answer every domain exactly as v1?
//
// Runs the two real catalogue queries side by side — v1's single-domain
// fetchDomainCatalog() once per domain, v2's set-based fetchCatalog() once per
// 200-domain batch — and builds each domain's body with the shared
// buildPricingBody(), for no niche and for every niche. Any difference is a
// v2 bug by definition: v2's promise is "the v1 body, many at a time".
//
// Read-only. Touches no API key, counter or log row.
//
// The sample is drawn blind (TABLESAMPLE over `domains`, not chosen by any
// property of the result), then topped up with the awkward classes v1's query
// exists to handle — case-variant duplicate hosts, internationalized domains —
// and with hosts that do not exist, so not_found is exercised too.
//
//   npx tsx --env-file=.env.local scripts/verify-public-api-v2.mts [sampleSize]

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getUsdRates } from "@/lib/currency";
import { fetchDomainCatalog } from "@/lib/public-api/handler";
import { fetchCatalog } from "@/lib/public-api/batch-handler";
import { normalizeCountry, toOffer } from "@/lib/public-api/common";
import { NICHE_IDS, type NicheId } from "@/lib/public-api/pricing";
import { buildPricingBody } from "@/lib/public-api/shape";
import { MAX_BATCH_DOMAINS } from "@/lib/public-api/batch";

const SAMPLE = Number(process.argv[2] ?? 400);

type Row = { domain_row: Record<string, unknown> | null; offers: Record<string, unknown>[] | null } | undefined;

function body(domain: string, row: Row, rates: Record<string, number>, niche: NicheId | null) {
  const d = row?.domain_row ?? null;
  if (!d) return null;
  return buildPricingBody(
    domain,
    (row?.offers ?? []).map(toOffer),
    rates,
    niche,
    {
      domain_rating: d.domain_rating != null ? Number(d.domain_rating) : null,
      organic_traffic: d.org_traffic != null ? Number(d.org_traffic) : null,
      ref_domains: d.ref_domains != null ? Number(d.ref_domains) : null,
      country: normalizeCountry(d.country_main_traffic as string | null),
    }
  );
}

async function pick(q: ReturnType<typeof sql>): Promise<string[]> {
  const r = await db.execute(q);
  return (r.rows as { d: string }[]).map((x) => x.d);
}

const random = await pick(sql`
  SELECT d FROM (
    SELECT DISTINCT lower(domain) AS d FROM domains TABLESAMPLE SYSTEM (1)
    WHERE domain ~ '^[a-zA-Z0-9.-]+$'
  ) s ORDER BY random() LIMIT ${SAMPLE}
`);
const caseDupes = await pick(sql`
  SELECT lower(domain) AS d FROM domains GROUP BY lower(domain) HAVING COUNT(*) > 1
  ORDER BY random() LIMIT 40
`);
const idn = await pick(sql`
  SELECT lower(domain) AS d FROM domains WHERE domain LIKE 'xn--%' OR domain ~ '[^\\x00-\\x7F]'
  ORDER BY random() LIMIT 20
`);
const missing = Array.from({ length: 10 }, (_, i) => `no-such-site-${Date.now()}-${i}.com`);

const all = [...new Set([...random, ...caseDupes, ...idn, ...missing])];
console.log(`sample: ${random.length} random + ${caseDupes.length} case-dupes + ${idn.length} IDN + ${missing.length} missing = ${all.length}`);

const rates = await getUsdRates();
const niches: (NicheId | null)[] = [null, ...NICHE_IDS];

let compared = 0;
let mismatches = 0;
let found = 0;
const batchMs: number[] = [];

for (let i = 0; i < all.length; i += MAX_BATCH_DOMAINS) {
  const batch = all.slice(i, i + MAX_BATCH_DOMAINS);
  const t0 = Date.now();
  const v2 = await fetchCatalog(batch);
  batchMs.push(Date.now() - t0);

  for (const domain of batch) {
    const v1Row = await fetchDomainCatalog(domain);
    const v2Row = v2.get(domain);
    if (v1Row?.domain_row) found++;
    for (const niche of niches) {
      compared++;
      const a = JSON.stringify(body(domain, v1Row, rates, niche));
      const b = JSON.stringify(body(domain, v2Row, rates, niche));
      if (a !== b) {
        mismatches++;
        if (mismatches <= 5) {
          console.log(`MISMATCH ${domain} niche=${niche}\n  v1: ${a.slice(0, 400)}\n  v2: ${b.slice(0, 400)}`);
        }
      }
    }
  }
  process.stdout.write(`  batch ${i / MAX_BATCH_DOMAINS + 1}: ${batch.length} domains, v2 query ${batchMs.at(-1)}ms\n`);
}

console.log(`\ndomains: ${all.length} (${found} in catalogue, ${all.length - found} not)`);
console.log(`bodies compared: ${compared} (${niches.length} niche settings each)`);
console.log(`v2 batch query latency: ${batchMs.map((m) => `${m}ms`).join(", ")}`);
console.log(mismatches === 0 ? "PASS — v2 matches v1 exactly" : `FAIL — ${mismatches} mismatches`);
process.exit(mismatches === 0 ? 0 : 1);
