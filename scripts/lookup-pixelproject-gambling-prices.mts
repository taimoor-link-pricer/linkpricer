import { neon } from '@neondatabase/serverless';
import { readFileSync, writeFileSync } from 'fs';

const sql = neon(process.env.DATABASE_URL!.replace(/[&?]channel_binding=require/g, ''));

const CURRENCY_TO_USD: Record<string, number> = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };
function toUsd(amount: number, currency: string | null | undefined): number {
  const rate = CURRENCY_TO_USD[(currency ?? 'USD').trim().toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

const domainsPath = process.argv[2];
const outPath = process.argv[3];
const domains: string[] = JSON.parse(readFileSync(domainsPath, 'utf8'));

const result: Record<string, { price: number; source: string } | null> = {};

const CHUNK = 500;
for (let i = 0; i < domains.length; i += CHUNK) {
  const chunk = domains.slice(i, i + CHUNK);

  // Source 1: marketplace_offers.gambling_min_price via domains
  const moRows = await sql`
    SELECT d.domain AS domain, mo.gambling_min_price AS price, mo.currency AS currency, mo.marketplace_name AS source
    FROM marketplace_offers mo
    JOIN domains d ON d.id = mo.domain_id
    WHERE d.domain = ANY(${chunk}) AND mo.gambling_min_price IS NOT NULL AND mo.gambling_min_price > 0
  `;

  // Source 2: lp_domain_price.gambling via lp_marketplace_domains
  const lpRows = await sql`
    SELECT lmd.w AS domain, ldp.gambling AS price, ldp.currency AS currency, lmd."marketPlace" AS source
    FROM lp_domain_price ldp
    JOIN lp_marketplace_domains lmd ON lmd.id = ldp."domainId"
    WHERE lmd.w = ANY(${chunk}) AND ldp.gambling IS NOT NULL AND ldp.gambling > 0 AND ldp."isActive" = true
  `;

  for (const row of [...moRows, ...lpRows] as any[]) {
    const usd = toUsd(Number(row.price), row.currency);
    const dom = String(row.domain).toLowerCase();
    const existing = result[dom];
    if (!existing || usd < existing.price) {
      result[dom] = { price: usd, source: row.source };
    }
  }

  console.error(`Processed ${Math.min(i + CHUNK, domains.length)}/${domains.length}`);
}

for (const d of domains) {
  if (!(d in result)) result[d] = null;
}

writeFileSync(outPath, JSON.stringify(result, null, 2));
const matched = Object.values(result).filter(Boolean).length;
console.error(`Matched ${matched}/${domains.length} domains`);
