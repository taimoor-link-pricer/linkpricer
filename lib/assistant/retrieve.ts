// Step 2 of a chat turn: run the plan against the catalogue and hand back
// sites with everything the composer and the cards need — metrics, the
// AI-written description, the cheapest offer, and the fee-inclusive price.
//
// Built on searchCatalog (the same pipeline Related Sites and the old
// homepage search use) rather than a new query: the retrieval, the vector
// index, the currency conversion and the pricing joins are all there already.
// What this adds is the translation from "what the user asked" to "what that
// pipeline takes": a clean topic phrase, the budget converted from the price
// the customer pays to the marketplace price the SQL filters on, and the
// post-filters the pipeline does not have (dofollow).

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { fetchResultRowsByIds, searchCatalog, type CatalogSearchFilters, type CatalogSearchResult } from "@/lib/search/catalog-search";
import { FEE_PERCENT, minFeeCents, withFeeUsd } from "@/lib/pricing/fee";
import { getUsdRates } from "@/lib/currency";
import { normalizeLanguage } from "@/lib/search/language-normalize";
import type { AssistantSite, SearchSpec } from "./types";

// How many sites the composer gets to choose from. Ten are shown; the rest
// let a "cheapest first" or "top 3 by traffic" request pick from a wider
// relevant set rather than re-sorting only the ten best matches.
export const CANDIDATE_COUNT = 30;
// How many the catalogue hands over before that cut: the whole reranked
// shortlist. The reranker scores it by topical fit alone, so taking its top
// 30 kept DR 50 zero-traffic sites whose descriptions said "iGaming" and
// dropped stronger sites scored a little lower. Measured on "finance
// business investment": the top 60 by match held one DR 70+ site (best DR
// 72); all 160 held six (best DR 86), for 3.6s against 3.2s — the extra
// pricing-join rows cost nothing worth having. The blended cut below then
// lets authority decide.
export const POOL_SIZE = 160;
// Same reranker budget as the old homepage search and Related Sites, for the
// same reason given there: the two surfaces should not disagree on the best
// site for the same topic. POOL_SIZE above is deliberately equal to it.
const RERANK_SHORTLIST_SIZE = 160;

/**
 * The largest marketplace price whose fee-inclusive price stays within the
 * customer's budget. The fee is max(15%, floor), so below the crossover the
 * floor binds (budget − floor) and above it the percentage does
 * (budget / 1.15); the smaller of the two is always the right bound.
 */
export function budgetToMarketplaceMax(budget: number, feeFloorCents: number): number {
  const floor = feeFloorCents / 100;
  const cap = Math.min(budget / (1 + FEE_PERCENT / 100), budget - floor);
  return Math.max(1, Math.floor(cap * 100) / 100);
}

function isDofollow(link: string | null | undefined): boolean {
  return typeof link === "string" && /^do[- ]?follow/i.test(link.trim());
}

// Descriptions were generated from the page and many open with the page
// title ("Page Title: SecureBlitz Cybersecurity. SecureBlitz is ..."), which
// reads as noise in a card; the sentence that follows is the description.
export function cleanAbout(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // The title ends at a newline or at a full stop that starts a new sentence
  // (followed by whitespace and a capital) — "TechGroup21.com is ..." has a
  // dot that is not a sentence end.
  const m = raw.match(/^\s*page title:[^\n]*?(?:\.\s+(?=\p{Lu})|\n+)/iu);
  const s = (m ? raw.slice(m[0].length) : raw).replace(/\s+/g, " ").trim();
  return s || null;
}

// The country column is scraped free text: mostly names ("United States"),
// sometimes codes ("IN"), sometimes placeholders. Codes are shown as names so
// a list does not read "United States, IN, India".
const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export function displayCountry(raw: string | null | undefined): string {
  if (!raw) return "";
  const v = raw.trim();
  if (!v || v === "-" || v === "--" || /^(n\/a|unknown|null)$/i.test(v)) return "";
  if (/^[A-Za-z]{2}$/.test(v)) {
    try {
      const name = regionNames?.of(v.toUpperCase());
      if (name && name !== v.toUpperCase()) return name;
    } catch {
      /* not a region code */
    }
  }
  return v;
}

/**
 * The prior order the composer sees and the cards show first: topical match
 * blended with authority, so a DR 6 site with no traffic no longer sits at
 * the top of the page just because its description matched. The composer
 * can still move sites, but it starts from a sensible list.
 */
export function blendedScore(s: AssistantSite, preferLanguage?: string | null): number {
  const traffic = Math.log10(Math.max(0, s.traffic) + 1); // 0..~6
  const thin = s.dr < 20 && s.traffic === 0 ? -40 : 0;
  // A soft preference, not a filter: a customer writing in English who did
  // not ask for a language is not served by ten French sites just because
  // "finance" matched their domain names. Only sites whose language is
  // actually known and different are moved down.
  const lang = preferLanguage ? normalizeLanguage(s.lang) : null;
  const foreign = lang && preferLanguage && lang !== preferLanguage ? -15 : 0;
  return s.matchPct + 0.5 * s.dr + 8 * traffic + thin + foreign;
}

/** A site with nothing behind it: cheap, but not a bargain. */
export function isThin(s: AssistantSite): boolean {
  return s.dr < 15 && s.traffic === 0;
}

// Blog-hosting platforms whose subdomains carry the platform's own DR
// (improvementhub.home.blog shows DR 85 — WordPress.com's, not its own) and
// are not editorial placements. The public API search excludes 10,810 such
// hosts from a maintained list (PR #17, not in this branch yet); this is the
// short obvious subset until that list lands here.
const HOSTING_SUFFIXES = [
  "home.blog", "wordpress.com", "blogspot.com", "blogspot.co.uk", "blogspot.in", "medium.com", "substack.com",
  "wixsite.com", "wix.com", "weebly.com", "tumblr.com", "github.io", "notion.site", "webflow.io", "squarespace.com",
  "sites.google.com", "over-blog.com", "canalblog.com", "hatenablog.com", "livejournal.com", "blog.fc2.com",
  "mystrikingly.com", "jimdosite.com", "jimdofree.com", "godaddysites.com", "yolasite.com", "altervista.org",
  "wordpress.org", "blogger.com", "ghost.io", "carrd.co", "hubpages.com", "vocal.media", "issuu.com", "pen.io",
];
export function isHostedSubdomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return HOSTING_SUFFIXES.some((suf) => d.endsWith("." + suf));
}

async function summariesFor(ids: string[]): Promise<Map<string, { about: string | null; category: string | null }>> {
  const out = new Map<string, { about: string | null; category: string | null }>();
  if (ids.length === 0) return out;
  const rows = (await db.execute(sql`
    SELECT id, semantic_summary, semantic_category
    FROM domains
    WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
  `)).rows as Array<{ id: string; semantic_summary: string | null; semantic_category: string | null }>;
  for (const r of rows) out.set(String(r.id), { about: cleanAbout(r.semantic_summary), category: r.semantic_category?.trim() || null });
  return out;
}

async function enrich(results: CatalogSearchResult[], rates: Record<string, number>): Promise<AssistantSite[]> {
  const floor = minFeeCents(rates);
  const extra = await summariesFor(results.map((r) => r.id));
  return results.map((r) => {
    const offers = (r.offers ?? []).slice().sort((a, b) => a.minPrice - b.minPrice);
    const ourPrices = offers.map((o) => withFeeUsd(o.minPrice, floor));
    // Three suppliers or more, and the cheapest under 30% of the median:
    // the median supplier becomes the headline and the cheap quote a note.
    const medianIdx = Math.floor(offers.length / 2);
    const priceOutlier = offers.length >= 3 && ourPrices[0] < 0.3 * ourPrices[medianIdx];
    const best = priceOutlier ? offers[medianIdx] : offers[0] ?? null;
    const fromPrice = best ? best.minPrice : r.bestPrice;
    const lowQuote = priceOutlier ? ourPrices[0] : null;
    const e = extra.get(r.id);
    // The language column is scraped free text and on ~7,800 rows holds
    // link-type words instead ("Dofollow Nofollow"); never show those as a
    // language.
    const lang = /follow/i.test(r.lang) ? "" : r.lang;
    return {
      id: r.id,
      domain: r.domain,
      dr: r.dr,
      traffic: r.traffic,
      refDomains: r.refDomains,
      country: displayCountry(r.country),
      lang,
      category: e?.category || r.category || "",
      about: e?.about ?? null,
      fromPrice: fromPrice ?? null,
      ourPrice: fromPrice != null ? withFeeUsd(fromPrice, floor) : null,
      priceOutlier,
      lowQuote,
      offerCount: offers.length,
      dofollow: offers.some((o) => isDofollow(o.link)),
      bestOffer: best,
      matchPct: r.matchPct,
    };
  });
}

/** Filters the pipeline cannot apply, plus the ones it can for a set loaded by id. */
export function applySpecInJs(sites: AssistantSite[], spec: SearchSpec | null): AssistantSite[] {
  if (!spec) return sites;
  return sites.filter((s) => {
    if (spec.dofollowOnly && !s.dofollow) return false;
    if (spec.minDr != null && s.dr < spec.minDr) return false;
    if (spec.maxDr != null && s.dr > spec.maxDr) return false;
    if (spec.minTraffic != null && s.traffic < spec.minTraffic) return false;
    if (spec.maxPrice != null && (s.ourPrice == null || s.ourPrice > spec.maxPrice)) return false;
    if (spec.minPrice != null && (s.ourPrice == null || s.ourPrice < spec.minPrice)) return false;
    return true;
  });
}

/** The provisional order the cards show before the composer answers. */
export function sortForSpec(sites: AssistantSite[], spec: SearchSpec | null, preferLanguage?: string | null): AssistantSite[] {
  const sort = spec?.sort;
  if (!sort || sort === "match") return sites.slice().sort((a, b) => blendedScore(b, preferLanguage) - blendedScore(a, preferLanguage));
  const key: (s: AssistantSite) => number = sort === "price" ? (s) => s.ourPrice ?? Number.POSITIVE_INFINITY : sort === "dr" ? (s) => s.dr : (s) => s.traffic;
  const dir = sort === "price" ? 1 : -1;
  // "Cheapest first" lists the cheapest sites with recorded traffic first,
  // then cheap sites with authority but no traffic record, then the thin
  // ones, so a $31 DR 2 site with no traffic does not head the list for
  // being a few dollars cheaper than a real one.
  const tier = (s: AssistantSite) => (sort !== "price" ? 0 : s.traffic > 0 ? 0 : s.dr >= 30 ? 1 : 2);
  return sites.slice().sort((a, b) => tier(a) - tier(b) || dir * (key(a) - key(b)));
}

/** The blended cut: the POOL_SIZE retrieved sites reduced to the CANDIDATE_COUNT the composer sees. */
export function cutCandidates(sites: AssistantSite[], preferLanguage?: string | null, keep = CANDIDATE_COUNT): AssistantSite[] {
  return sites.slice().sort((a, b) => blendedScore(b, preferLanguage) - blendedScore(a, preferLanguage)).slice(0, keep);
}

export interface RetrievalOutput {
  sites: AssistantSite[];
  lowRelevance: boolean;
  total: number;
  ms: number;
}

export interface RunSearchOptions {
  // ISO 639-1 code of the language the customer wrote in — a soft
  // preference when the spec names no language or country.
  preferLanguage?: string | null;
}

export async function runSearch(spec: SearchSpec, opts: RunSearchOptions = {}): Promise<RetrievalOutput> {
  const t0 = Date.now();
  const rates = await getUsdRates();
  const floor = minFeeCents(rates);
  const filters: CatalogSearchFilters = {};
  if (spec.maxPrice != null) filters.maxPrice = budgetToMarketplaceMax(spec.maxPrice, floor);
  // Same bound as the ceiling: ourPrice(p) >= M exactly when
  // p >= min(M/1.15, M - floor), so one function serves both ends.
  if (spec.minPrice != null) filters.minPrice = budgetToMarketplaceMax(spec.minPrice, floor);
  if (spec.minDr != null) filters.minDr = spec.minDr;
  if (spec.maxDr != null) filters.maxDr = spec.maxDr;
  if (spec.minTraffic != null) filters.minTraffic = spec.minTraffic;
  if (spec.countries?.length) filters.countries = spec.countries;
  if (spec.language) filters.language = spec.language;
  if (spec.tlds?.length) filters.tlds = spec.tlds;

  const out = await searchCatalog({
    query: spec.topic,
    filters,
    finalResultSize: POOL_SIZE,
    claudeShortlistSize: RERANK_SHORTLIST_SIZE,
  });
  let sites = (await enrich(out.results, rates)).filter((s) => !isHostedSubdomain(s.domain));
  if (spec.dofollowOnly) sites = sites.filter((s) => s.dofollow);
  // Belt and braces for the budget: the SQL bound is on the cheapest offer
  // after currency conversion, and the fee rounds up, so re-check the price
  // the customer actually sees.
  if (spec.maxPrice != null) sites = sites.filter((s) => s.ourPrice != null && s.ourPrice <= spec.maxPrice!);
  // The language preference only applies when the customer left language
  // and country open; "Spanish travel blogs" or "sites in Germany" already
  // say what they want.
  const preferLanguage = spec.language || spec.countries?.length ? null : opts.preferLanguage ?? null;
  sites = sortForSpec(cutCandidates(sites, preferLanguage), spec, preferLanguage);
  return { sites, lowRelevance: out.lowRelevance, total: out.total, ms: Date.now() - t0 };
}

/** Full rows for ids from an earlier turn, in that order; ids that vanished are skipped. */
export async function sitesByIds(ids: string[]): Promise<AssistantSite[]> {
  if (ids.length === 0) return [];
  const rates = await getUsdRates();
  const rows = await fetchResultRowsByIds(ids, rates);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is CatalogSearchResult => !!r);
  return enrich(ordered, rates);
}

/**
 * Sites by name. A host can exist as several `domains` rows (case variants
 * are stored separately, see fetchCatalog in lib/public-api/batch-handler.ts),
 * so every row is loaded and the one with the most offers represents the
 * domain.
 */
export async function lookupDomains(domains: string[]): Promise<{ sites: AssistantSite[]; missing: string[] }> {
  const wanted = [...new Set(domains.map((d) => d.toLowerCase()))].slice(0, 10);
  if (wanted.length === 0) return { sites: [], missing: [] };
  const rows = (await db.execute(sql`
    SELECT id, LOWER(domain) AS domain FROM domains
    WHERE LOWER(domain) IN (${sql.join(wanted.map((d) => sql`${d}`), sql`, `)})
       OR LOWER(domain) IN (${sql.join(wanted.map((d) => sql`${"www." + d}`), sql`, `)})
  `)).rows as Array<{ id: string; domain: string }>;
  const sites = await sitesByIds(rows.map((r) => String(r.id)));
  const best = new Map<string, AssistantSite>();
  for (const s of sites) {
    const key = s.domain.replace(/^www\./, "");
    const cur = best.get(key);
    if (!cur || s.offerCount > cur.offerCount || (s.offerCount === cur.offerCount && s.dr > cur.dr)) best.set(key, s);
  }
  const found = wanted.map((d) => best.get(d)).filter((s): s is AssistantSite => !!s);
  const missing = wanted.filter((d) => !best.has(d));
  return { sites: found, missing };
}
