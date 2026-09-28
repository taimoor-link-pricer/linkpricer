/**
 * Listings for the order API: every buyable offer on one domain, one entry per
 * (offer, niche), each priced the way the public pricing API prices it.
 *
 * The rule this file exists to keep: the price a listing shows, the price an
 * order is placed at, and the `linkpricer.lowest` the pricing API quotes for
 * the same domain are one number. Karolis checks prices with the pricing API
 * and orders with this one, so any drift between them is a real problem. Both
 * therefore read the same offer pool (fetchDomainCatalog) and price each offer
 * with the same function (ourPrice) off the same rate map — the pricing API's
 * lowest price is exactly the cheapest listing here.
 *
 * Guest posts only for now: link insertion is a separate product and is not
 * offered through this API yet.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { toUsd } from "@/lib/currency";
import { minFeeCents } from "@/lib/pricing/fee";
import { fetchDomainCatalog } from "@/lib/public-api/handler";
import { normalizeDomain, toOffer } from "@/lib/public-api/common";
import { nicheOfferPrice, ourPrice, type NicheId } from "@/lib/public-api/pricing";

/**
 * The robot's niche codes → ours. finance is our loan niche (confirmed by
 * Karolis 2026-09-28); general and other are the standard price.
 */
export const ROBOT_NICHES = {
  general: "standard",
  other: "standard",
  igaming: "gambling",
  crypto: "crypto",
  cbd: "cbd",
  adult: "adult",
  finance: "loan",
  dating: "dating",
} as const satisfies Record<string, NicheId>;

export type RobotNiche = keyof typeof ROBOT_NICHES;
export const ROBOT_NICHE_CODES = Object.keys(ROBOT_NICHES) as RobotNiche[];

/** Which robot code a niche is reported under. standard → general. */
const REPORTED_AS: Partial<Record<NicheId, RobotNiche>> = {
  standard: "general",
  gambling: "igaming",
  crypto: "crypto",
  cbd: "cbd",
  adult: "adult",
  loan: "finance",
  dating: "dating",
};

export function parseRobotNiche(raw: string | null | undefined): RobotNiche | null {
  const v = (raw ?? "").trim().toLowerCase();
  return (ROBOT_NICHE_CODES as string[]).includes(v) ? (v as RobotNiche) : null;
}

export interface Listing {
  listing_id: string;
  vendor_id: string;
  vendor_type: "owner" | "reseller" | "unknown";
  product: "guest_post";
  niche: RobotNiche;
  price: string;
  currency: "USD";
  link_type: "dofollow" | "nofollow" | "unknown";
  duration: "lifetime" | "12_months" | "6_months" | "unknown";
  sponsored_tag: boolean | null;
  article_by: "either";
  turnaround_days: number | null;
  available: true;
  updated_at: string | null;
}

// The scraped condition columns are free text, mostly empty, in a dozen
// spellings ("DoFollow", "Dofollow/No follow", "-"). Only an unambiguous value
// is reported; everything else is "unknown" rather than a guess.
function linkType(raw: unknown): Listing["link_type"] {
  const v = String(raw ?? "").trim().toLowerCase().replace(/[\s-]/g, "");
  if (v === "dofollow" || v === "follow") return "dofollow";
  if (v === "nofollow") return "nofollow";
  return "unknown";
}

function duration(raw: unknown): Listing["duration"] {
  const v = String(raw ?? "").trim().toLowerCase();
  if (["permanent", "permanently", "forever", "unlimited", "lifetime"].includes(v)) return "lifetime";
  if (/^(min\.?\s*)?(12 months|1 year)$/.test(v)) return "12_months";
  if (/^(min\.?\s*)?6 months$/.test(v)) return "6_months";
  return "unknown";
}

function sponsored(raw: unknown): boolean | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function isoTimestamp(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw);
  // Postgres hands back "2026-09-20T10:11:12.123" with no zone for a
  // timestamp-without-time-zone column; those values are UTC.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * One catalog row as a listing for one niche, with the fee-free USD price it
 * was built from, or null when the offer does not sell that niche.
 */
function toListing(
  row: Record<string, unknown>,
  niche: RobotNiche,
  rates: Record<string, number>,
  feeFloorCents: number
): { listing: Listing; marketplacePriceUsd: number } | null {
  const offer = toOffer(row);
  const raw = nicheOfferPrice(offer, ROBOT_NICHES[niche]);
  if (raw == null) return null;
  const usd = toUsd(raw, offer.currency, rates);
  if (usd == null || usd <= 0) return null;
  return {
    marketplacePriceUsd: Math.round(usd * 100) / 100,
    listing: {
      listing_id: String(row.listing_id),
      vendor_id: String(row.source_name ?? "unknown"),
      vendor_type: "unknown",
      product: "guest_post",
      niche,
      price: ourPrice(usd, feeFloorCents).toFixed(2),
      currency: "USD",
      link_type: linkType(row.link_type),
      duration: duration(row.duration),
      sponsored_tag: sponsored(row.sponsored_tag),
      article_by: "either",
      turnaround_days: row.delivery_time_days == null ? null : Number(row.delivery_time_days),
      available: true,
      updated_at: isoTimestamp(row.freshness),
    },
  };
}

/**
 * Every listing on `domain` (already normalized), optionally for one niche.
 * Sorted cheapest first. An unlisted domain is an empty array, never an error.
 */
export async function getListings(
  domain: string,
  rates: Record<string, number>,
  niche: RobotNiche | null
): Promise<Listing[]> {
  const catalog = await fetchDomainCatalog(domain);
  const feeFloorCents = minFeeCents(rates);
  const niches = niche ? [niche] : (Object.values(REPORTED_AS) as RobotNiche[]);

  const out: Listing[] = [];
  for (const row of catalog?.offers ?? []) {
    for (const code of niches) {
      const l = toListing(row, code, rates, feeFloorCents);
      if (l) out.push(l.listing);
    }
  }
  out.sort((a, b) => Number(a.price) - Number(b.price) || a.listing_id.localeCompare(b.listing_id));
  return out;
}

const LISTING_ID = /^(M|V)-([0-9a-f-]{36})$/i;

/**
 * One listing for one niche, priced exactly as getListings prices it, or null
 * when it is not buyable now (gone, paused, no price for that niche, or no
 * longer the offer the pool picks for its marketplace).
 *
 * An order carries only the listing id, so the domain is read off the offer
 * row first — then the whole domain is re-priced through the same pool the
 * lookup used, and the listing is taken from THAT. Pricing the row directly
 * would skip the pool's rules and could quote a number the lookup never
 * showed.
 */
export async function findListing(
  listingId: string,
  niche: RobotNiche,
  rates: Record<string, number>
): Promise<{ listing: Listing; marketplacePriceUsd: number; domain: string } | null> {
  const m = LISTING_ID.exec(listingId);
  if (!m) return null;
  const [, kind, id] = m;
  const found = await db.execute(
    kind.toUpperCase() === "M"
      ? sql`SELECT d.domain FROM marketplace_offers o JOIN domains d ON d.id = o.domain_id WHERE o.id = ${id} LIMIT 1`
      : sql`SELECT domain FROM supplier_offers WHERE id = ${id} LIMIT 1`
  );
  const rawDomain = (found.rows[0] as { domain?: string } | undefined)?.domain;
  if (!rawDomain) return null;
  const domain = normalizeDomain(rawDomain);

  const catalog = await fetchDomainCatalog(domain);
  const canonicalId = `${kind.toUpperCase()}-${id.toLowerCase()}`;
  const row = (catalog?.offers ?? []).find((r) => String(r.listing_id).toLowerCase() === canonicalId.toLowerCase());
  const priced = row ? toListing(row, niche, rates, minFeeCents(rates)) : null;
  return priced ? { ...priced, domain } : null;
}
