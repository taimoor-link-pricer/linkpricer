// Shared pieces for the semantic_summary backfill.
//
// The pipeline is deliberately split into three separate commands —
// fetch -> summarize -> embed — rather than one long-running process.
// Summaries are written by Claude Code subagents (the Claude Code
// subscription has no callable API endpoint, so a script cannot invoke it),
// which means the language step happens *between* two script runs rather
// than inside one. Splitting also keeps each stage independently
// resumable: every stage derives its own work list from the database, so
// there is no cursor or job file to lose.
import { neon } from "@neondatabase/serverless";

export const WORK_DIR = "scripts/backfill/work";

export function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url.replace(/[&?]channel_binding=require/g, ""));
}

/**
 * Domains still needing a description.
 *
 * "Sellable" (has a live, priced offer) is the gate that matters: a domain
 * nobody can buy will never appear in a search result, so describing it
 * buys nothing. Beyond that, `tier` picks how deep to go.
 *
 * Note on `traffic`: org_traffic is NULL for most of the catalog because
 * Ahrefs traffic was never backfilled — NOT because those sites are dead.
 * Only 9,392 of the 226,675-domain gap have a traffic figure at all, versus
 * 66,757 with a DR. So traffic is a high-precision/low-recall tier, useful
 * as a first slice, and DR is the sane definition of "worth describing".
 */
export type Tier = "traffic" | "dr" | "all";

export function tierClause(tier: Tier): string {
  if (tier === "traffic") return "AND COALESCE(d.org_traffic, 0) > 0";
  if (tier === "dr") return "AND (COALESCE(d.domain_rating, 0) > 0 OR COALESCE(d.org_traffic, 0) > 0)";
  return "";
}

export function targetQuery(tier: Tier, limit: number): string {
  return `
    SELECT d.id, d.domain, COALESCE(d.domain_rating,0) AS dr, COALESCE(d.org_traffic,0) AS traffic
    FROM domains d
    WHERE d.semantic_summary IS NULL
      ${tierClause(tier)}
      AND (
        EXISTS (SELECT 1 FROM marketplace_offers mo
                WHERE mo.domain_id = d.id AND mo.available = true AND mo.min_price::float > 0)
        OR EXISTS (SELECT 1 FROM supplier_offers so
                   WHERE so.domain_id = d.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0)
      )
    ORDER BY COALESCE(d.org_traffic,0) DESC, COALESCE(d.domain_rating,0) DESC
    LIMIT ${Number(limit)}
  `;
}

export interface FetchedPage {
  id: string;
  domain: string;
  title: string;
  text: string;
}
