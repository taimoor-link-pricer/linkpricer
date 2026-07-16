// Caches Ahrefs referring-domains lookups so the same "own site" domain isn't
// re-fetched from Ahrefs on every Related Sites search (multiple users, or
// repeat searches by the same user, may enter the same domain). No table for
// this existed before — lp_domain_metrics only stores aggregate counts, not
// the actual list of referring domains.
//
// Tables are created lazily via idempotent DDL (matching the ensureTable()
// convention in linkpricer-serverless/functions/src/jobs/ahrefs-dr.ts) since
// this app's schema is introspected from live Neon, not drizzle-migrated.
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fetchReferringDomainsFromAhrefs } from "./ahrefs";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ExcludedDomainsResult {
  excluded: Set<string>;
  degraded: boolean;
}

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lp_ahrefs_referring_domains_cache (
      target_domain    text NOT NULL,
      referring_domain text NOT NULL,
      org_traffic      bigint,
      fetched_at       timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (target_domain, referring_domain)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ahrefs_ref_cache_target
    ON lp_ahrefs_referring_domains_cache (target_domain)
  `);
  // Distinguishes "never looked up" from "looked up, zero qualifying
  // referrers" — without this a domain with no >=100-traffic referrers would
  // re-hit Ahrefs on every search.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lp_ahrefs_lookup_status (
      target_domain text PRIMARY KEY,
      fetched_at    timestamptz NOT NULL DEFAULT now(),
      domain_count  integer NOT NULL DEFAULT 0,
      error         text
    )
  `);
  tablesEnsured = true;
}

// Exported so catalog-search.ts can apply the exact same normalization to
// the marketplace catalog's domain column before comparing against this
// module's exclusion Set — Ahrefs' refdomains endpoint frequently returns
// www.-prefixed hosts, and without normalizing both sides consistently the
// Set.has() lookup silently misses valid matches (a site that already links
// to the user ends up not excluded, with no error surfaced anywhere).
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

async function readCache(targetDomain: string): Promise<Set<string>> {
  const rows = await db.execute(sql`
    SELECT referring_domain FROM lp_ahrefs_referring_domains_cache
    WHERE target_domain = ${targetDomain}
  `);
  // Normalize on read too, not just on write — covers rows cached before
  // this normalization existed, without needing a data migration.
  return new Set(rows.rows.map((r) => normalizeDomain(r.referring_domain as string)));
}

async function writeCache(
  targetDomain: string,
  domains: { domain: string; orgTraffic: number }[]
): Promise<void> {
  await db.execute(sql`DELETE FROM lp_ahrefs_referring_domains_cache WHERE target_domain = ${targetDomain}`);
  if (domains.length > 0) {
    const values = sql.join(
      domains.map((d) => sql`(${targetDomain}, ${normalizeDomain(d.domain)}, ${d.orgTraffic})`),
      sql`, `
    );
    await db.execute(sql`
      INSERT INTO lp_ahrefs_referring_domains_cache (target_domain, referring_domain, org_traffic)
      VALUES ${values}
      ON CONFLICT (target_domain, referring_domain) DO NOTHING
    `);
  }
  await db.execute(sql`
    INSERT INTO lp_ahrefs_lookup_status (target_domain, fetched_at, domain_count, error)
    VALUES (${targetDomain}, NOW(), ${domains.length}, NULL)
    ON CONFLICT (target_domain) DO UPDATE
      SET fetched_at = NOW(), domain_count = ${domains.length}, error = NULL
  `);
}

async function recordError(targetDomain: string, message: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO lp_ahrefs_lookup_status (target_domain, fetched_at, domain_count, error)
    VALUES (${targetDomain}, NOW(), 0, ${message})
    ON CONFLICT (target_domain) DO UPDATE SET error = ${message}
  `);
}

/**
 * Returns the set of domains that already link to `ownSiteRaw` (per Ahrefs,
 * filtered to >= 100 org traffic), for excluding from Related Sites results.
 * Never throws — Ahrefs/DB failures degrade to an empty or stale-cache
 * exclusion set rather than blocking the search.
 */
export async function getExcludedDomains(ownSiteRaw: string): Promise<ExcludedDomainsResult> {
  const targetDomain = normalizeDomain(ownSiteRaw);
  if (!targetDomain) return { excluded: new Set(), degraded: false };

  await ensureTables();

  const statusRows = await db.execute(sql`
    SELECT fetched_at, error FROM lp_ahrefs_lookup_status WHERE target_domain = ${targetDomain}
  `);
  const status = statusRows.rows[0] as { fetched_at: string; error: string | null } | undefined;
  const isFresh =
    !!status && !status.error && Date.now() - new Date(status.fetched_at).getTime() < CACHE_TTL_MS;

  if (isFresh) {
    return { excluded: await readCache(targetDomain), degraded: false };
  }

  try {
    const fetched = await fetchReferringDomainsFromAhrefs(targetDomain);
    await writeCache(targetDomain, fetched);
    return { excluded: new Set(fetched.map((d) => normalizeDomain(d.domain))), degraded: false };
  } catch (err) {
    console.error(
      "[referring-domains-cache] Ahrefs fetch failed:",
      err instanceof Error ? err.message : err
    );
    await recordError(targetDomain, err instanceof Error ? err.message : String(err)).catch(() => {});
    const stale = await readCache(targetDomain);
    return { excluded: stale, degraded: true };
  }
}
