// Bulk-price lookup that mirrors the exact logic of
// app/api/v1/public/domains/[domain]/pricing/route.ts (niche=gambling, showmarketplace=true path):
//   - only reads domains + marketplace_offers (NOT lp_domain_price / lp_marketplace_domains)
//   - filters o.available = true
//   - MIN(gambling_min_price) per marketplace, then picks the lowest across marketplaces
//   - no currency conversion (route treats marketplace_offers prices as already USD)
//   - bypasses marketplace_price_cache, since showmarketplace=true always does that in the route
import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL!.replace(/[&?]channel_binding=require/g, ''));

function toPrice(val: unknown): number | null {
  const n = Number(val);
  return val == null || val === '' || isNaN(n) || n === 0 ? null : Math.round(n * 100) / 100;
}

const domainsPath = process.argv[2];
const outPath = process.argv[3];
const domains: string[] = JSON.parse(readFileSync(domainsPath, 'utf8'));
const domainsLower = domains.map((d) => d.toLowerCase().trim());

type Result = { price: number; marketplace: string } | null;
const result: Record<string, Result> = {};
for (const d of domainsLower) result[d] = null;

const CHUNK = 300;
for (let i = 0; i < domainsLower.length; i += CHUNK) {
  const chunk = domainsLower.slice(i, i + CHUNK);

  const rows = await sql`
    SELECT d.domain AS domain, o.marketplace_name AS marketplace_name,
           MIN(o.gambling_min_price::float) AS gambling_min
    FROM domains d
    JOIN marketplace_offers o ON o.domain_id = d.id
    WHERE d.domain = ANY(${chunk}) AND o.available = true
    GROUP BY d.domain, o.marketplace_name
  `;

  for (const row of rows as any[]) {
    const dom = String(row.domain).toLowerCase();
    const price = toPrice(row.gambling_min);
    if (price == null) continue;
    const existing = result[dom];
    if (!existing || price < existing.price) {
      result[dom] = { price, marketplace: row.marketplace_name };
    }
  }

  console.error(`Processed ${Math.min(i + CHUNK, domainsLower.length)}/${domainsLower.length}`);
}

writeFileSync(outPath, JSON.stringify(result, null, 2));
const matched = Object.values(result).filter(Boolean).length;
console.error(`Matched ${matched}/${domainsLower.length} domains`);
