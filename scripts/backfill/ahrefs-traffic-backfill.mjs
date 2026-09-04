// One-off backfill: Ahrefs organic traffic for domains that have a DR but no
// org_traffic. Highest DR first, so if the unit budget runs out mid-run the
// most valuable domains are already done.
//
// Uses /v3/batch-analysis (12 units/domain) rather than /v3/site-explorer/metrics
// (50 units/domain) — measured live 2026-09-03, 4x cheaper for the same fields.
// The quota resets 2026-09-06, so unspent units are lost anyway; the guard below
// only exists to avoid hitting a hard 402 mid-batch.
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const KEY = process.env.AHREFS_API_KEY;
if (!KEY) throw new Error('AHREFS_API_KEY not set');

const BATCH = Number(process.env.BATCH || 100);
// Stop with a margin so a final in-flight batch can never overrun the workspace
// limit and start returning 402s instead of data.
const RESERVE_UNITS = Number(process.env.RESERVE_UNITS || 5000);
const DRY_RUN = process.env.DRY_RUN === '1';

const env = fs.readFileSync('.env', 'utf8');
const sql = neon(env.match(/^DATABASE_URL=["']?(.+?)["']?$/m)[1]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function quota() {
  const res = await fetch('https://api.ahrefs.com/v3/subscription-info/limits-and-usage', {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`quota check failed: HTTP ${res.status}`);
  const u = (await res.json()).limits_and_usage;
  return { limit: u.units_limit_workspace, used: u.units_usage_workspace, reset: u.usage_reset_date };
}

async function fetchBatch(domains) {
  const body = {
    select: ['url', 'org_traffic', 'domain_rating'],
    targets: domains.map((d) => ({ url: d, mode: 'subdomains', protocol: 'both' })),
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.ahrefs.com/v3/batch-analysis/batch-analysis', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    if (res.status === 429) {
      if (attempt >= 5) throw new Error('rate limited after 5 attempts');
      await sleep(2000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const cost = Number(res.headers.get('x-api-units-cost-total') || 0);
    return { targets: (await res.json()).targets ?? [], cost };
  }
}

// batch-analysis echoes the target back as a normalized url ("bbc.com/",
// sometimes with a scheme) — strip it back to a bare host so it matches the
// domain we asked for. Order is NOT guaranteed to match the request, so we key
// on this rather than zipping by index.
const hostOf = (u) => String(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase();

const q0 = await quota();
console.log(`quota: ${q0.used}/${q0.limit} used, ${q0.limit - q0.used} remaining, resets ${q0.reset}`);

const rows = await sql`
  SELECT domain, domain_rating FROM domains
  WHERE domain_rating > 40 AND org_traffic IS NULL
  ORDER BY domain_rating DESC, domain ASC
`;
console.log(`${rows.length} domains queued (DR>40, traffic NULL), highest DR first`);

let spent = 0, updated = 0, missing = 0, processed = 0;
let budget = q0.limit - q0.used - RESERVE_UNITS;

for (let i = 0; i < rows.length; i += BATCH) {
  if (budget - spent < BATCH * 12) {
    console.log(`\nSTOPPING: ~${budget - spent} units left, not enough for another batch of ${BATCH}`);
    break;
  }
  const slice = rows.slice(i, i + BATCH);
  let result;
  try {
    result = await fetchBatch(slice.map((r) => r.domain));
  } catch (err) {
    console.error(`batch at ${i} failed, skipping: ${err.message}`);
    continue;
  }
  spent += result.cost;
  processed += slice.length;

  const byHost = new Map();
  for (const t of result.targets) {
    if (typeof t.org_traffic === 'number') byHost.set(hostOf(t.url), t);
  }

  // One bulk UPDATE per batch, NOT one per row. Row-at-a-time writes are a
  // separate HTTP request each on the neon serverless driver, and two earlier
  // runs both died with "fetch failed" at exactly 2,900 rows — connection churn,
  // not a network fault. This keeps it to one request per 100 domains.
  const names = [], traffic = [], ratings = [];
  for (const r of slice) {
    const t = byHost.get(r.domain.toLowerCase());
    if (!t) { missing++; continue; }
    names.push(r.domain);
    traffic.push(t.org_traffic);
    ratings.push(t.domain_rating != null ? Math.round(t.domain_rating) : null);
  }
  if (names.length === 0) continue;
  if (DRY_RUN) { updated += names.length; continue; }

  // domain_rating is refreshed on the same call at no extra cost. Both
  // timestamps are stamped only here, on a confirmed numeric response, so a
  // failed/absent lookup never masquerades as fresh data.
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`
        UPDATE domains d
        SET org_traffic = v.traffic,
            org_traffic_updated_at = NOW(),
            domain_rating = COALESCE(v.rating, d.domain_rating),
            domain_rating_updated_at = CASE WHEN v.rating IS NOT NULL THEN NOW() ELSE d.domain_rating_updated_at END
        FROM (
          SELECT * FROM unnest(
            ${names}::text[], ${traffic}::bigint[], ${ratings}::int[]
          ) AS t(domain, traffic, rating)
        ) v
        WHERE d.domain = v.domain
      `;
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      console.error(`  db write retry ${attempt} after: ${err.message}`);
      await sleep(2000 * attempt);
    }
  }
  updated += names.length;
  const pct = ((processed / rows.length) * 100).toFixed(1);
  console.log(`[${pct}%] processed=${processed}/${rows.length} updated=${updated} no_data=${missing} units=${spent} (DR now ~${slice[slice.length - 1].domain_rating})`);
}

const q1 = await quota();
console.log(`\nDONE — updated=${updated} no_data=${missing} processed=${processed}/${rows.length}`);
console.log(`units spent this run: ${spent} | workspace now ${q1.used}/${q1.limit}`);
