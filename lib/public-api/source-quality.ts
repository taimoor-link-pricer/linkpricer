/**
 * What the public API (and so the MCP server) leaves out because it is not
 * a placement anyone is actually buying.
 *
 * API-only for now: the dashboard's Analyze page still counts all of it, so
 * the two can show different figures for the sites this touches.
 */

import { sql, type SQL } from "drizzle-orm";
import { PLATFORM_DOMAINS, PLATFORM_FAMILIES } from "@/lib/public-api/platform-hosts";

/**
 * Marketplaces whose listings are not one-off placements. serpzilla.com sells
 * monthly link rentals priced in cents (median $0.11 across ~20,000 listings
 * in Oct 2026); counted as a source it made the €25 minimum fee the "lowest
 * price" of every site it lists.
 */
export const EXCLUDED_SOURCES = ["serpzilla.com"] as const;

/** `AND`-able condition keeping offers from every other marketplace. */
export function sourceAllowed(marketplaceName: SQL): SQL {
  return sql`lower(${marketplaceName}) NOT IN (${sql.join(EXCLUDED_SOURCES.map((s) => sql`${s}`), sql`, `)})`;
}

/**
 * Platform hosts — blog builders, hosting, shared registries, user documents,
 * profiles, universities (platform-hosts.ts has the list and why). The pricing
 * endpoint still answers for them when asked by name; only search, which picks
 * sites for the caller, leaves them out.
 *
 * A host is one when one of its trailing parts is listed ("a.b.jotform.com"
 * ends in "jotform.com") or it belongs to a family (an .edu name). The listed
 * names are looked up, not matched as one long regex: on the full catalogue
 * the lookup is several times faster, and it does not slow down as the list
 * grows.
 */
const PLATFORM_SET: ReadonlySet<string> = new Set(PLATFORM_DOMAINS);

/** The most labels any listed name has, so the deepest suffix worth comparing. */
const MAX_LABELS = Math.max(...PLATFORM_DOMAINS.map((d) => d.split(".").length));

const FAMILY_PATTERN = `(^|\\.)(${PLATFORM_FAMILIES.join("|")})$`;
const FAMILY_RE = new RegExp(FAMILY_PATTERN);

/** Label counts from 2 to MAX_LABELS: the suffix lengths a listed name can have. */
const SUFFIX_LENGTHS = Array.from({ length: MAX_LABELS - 1 }, (_, i) => i + 2);

export function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase();
  if (FAMILY_RE.test(h)) return true;
  const labels = h.split(".");
  return SUFFIX_LENGTHS.some((n) => n <= labels.length && PLATFORM_SET.has(labels.slice(-n).join(".")));
}

/**
 * `AND`-able condition dropping platform hosts — isPlatformHost in SQL. The
 * list goes in as ONE bound string split by Postgres: a JS array is not bound
 * as a Postgres array, and an IN list of ~400 parameters measured over twice
 * as slow on the full catalogue. Patterns are bound too — drizzle's sql
 * template would eat their backslashes.
 *
 * A host with fewer labels than a suffix length yields NULL for it, hence the
 * coalesce: without it, NOT (false OR NULL) drops every short host.
 */
export function notPlatformHost(host: SQL): SQL {
  const h = sql`lower(${host})`;
  const listed = sql`string_to_array(${PLATFORM_DOMAINS.join(",")}::text, ',')`;
  const suffixMatches = SUFFIX_LENGTHS.map(
    (n) => sql`substring(${h} from ${`(([^.]+\\.){${n - 1}}[^.]+)$`}) = ANY(${listed})`
  );
  return sql`(NOT coalesce(${sql.join(suffixMatches, sql` OR `)}, false) AND ${h} !~ ${FAMILY_PATTERN})`;
}
