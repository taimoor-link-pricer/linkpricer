// Related Sites — mock data + stubbed search "API", ported verbatim from
// data/related.js in the Karolis design handoff. Front-end only: a real
// backend (semantic search + Ahrefs metrics + quota check) replaces
// `searchRelatedSites` later. The resolved shape is the contract the UI
// relies on — keep it stable when that swap happens.

import type { RelatedSite, SortState } from "./types";

export const LP_RELATED_DATA: RelatedSite[] = [
  {
    domain: "goal.com",
    country: "GB", lang: "EN", category: "Football / News",
    dr: 90, drTrend: "up", traffic: 38000000, keywords: 6200000, refDomains: 142000,
    grade: "A+", score: 90, bestPrice: 640, linksToMe: false,
    tags: ["football", "soccer", "news", "sports", "transfers", "premier league"], bias: 8,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 640, maxPrice: 780, quality: 5, delivery: 7, deliveryDays: 7, tat: 5, link: "Dofollow",
        example: "https://goal.com/en/news/example-transfer-story",
        conditions: ["Sponsored disclosure on by-line", "Max 2 dofollow links", "Article 700+ words", "No betting anchors in title"],
        niche: { General: [640, 780], Gambling: [1400, 1700], Crypto: [1100, 1300] },
      },
      {
        name: "Getlinks", type: "API", updated: "11-06-2026 19:40",
        minPrice: 695, maxPrice: 695, quality: 4, delivery: 9, deliveryDays: 9, tat: 7, link: "Dofollow",
        example: "https://goal.com/en/lists/example-best-strikers",
        conditions: ["Editorial review (2–3 days)", "1 dofollow link to brand", "Image must be licensed"],
        niche: { General: [695, 695], Gambling: [1550, 1550] },
      },
      {
        name: "Vendor: Daniel R.", type: "Vendor", updated: "08-06-2026 11:00",
        minPrice: 720, maxPrice: 720, quality: 4, delivery: 12, deliveryDays: 12, tat: 10, link: "Dofollow",
        example: null,
        conditions: ["Topic approval required", "No competitor mentions", "Permanent placement"],
        niche: { General: [720, 720] },
      },
    ],
  },
  {
    domain: "betimate.com",
    country: "GB", lang: "EN", category: "Sports / Betting",
    dr: 41, drTrend: "up", traffic: 320000, keywords: 24800, refDomains: 980,
    grade: "B+", score: 58, bestPrice: 160, linksToMe: true,
    tags: ["sports", "betting", "football", "predictions", "odds", "news"], bias: 5,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 160, maxPrice: 220, quality: 4, delivery: 5, deliveryDays: 5, tat: 4, link: "Dofollow",
        example: "https://betimate.com/predictions/example",
        conditions: ["Gambling content allowed", "Up to 3 dofollow links", "Min 600 words"],
        niche: { General: [160, 220], Gambling: [340, 440], Crypto: [260, 320] },
      },
      {
        name: "Vendor: Maria K.", type: "Vendor", updated: "10-06-2026 18:00",
        minPrice: 195, maxPrice: 195, quality: 5, delivery: 6, deliveryDays: 6, tat: 5, link: "Dofollow",
        example: "https://betimate.com/blog/odds-calculation",
        conditions: ["Author byline included", "1 brand + 1 deep link", "No adult"],
        niche: { General: [195, 195], Gambling: [420, 420] },
      },
    ],
  },
  {
    domain: "fourfourtwo.com",
    country: "GB", lang: "EN", category: "Football / Magazine",
    dr: 84, drTrend: "flat", traffic: 5100000, keywords: 920000, refDomains: 61000,
    grade: "A", score: 80, bestPrice: 480, linksToMe: false,
    tags: ["football", "soccer", "news", "tactics", "magazine", "sports"], bias: 4,
    offers: [
      {
        name: "Getlinks", type: "API", updated: "11-06-2026 19:40",
        minPrice: 480, maxPrice: 560, quality: 5, delivery: 8, deliveryDays: 8, tat: 6, link: "Dofollow",
        example: "https://fourfourtwo.com/features/example-tactical-analysis",
        conditions: ["Editorial fit required", "Max 2 outbound links", "900+ words", "No gambling anchors"],
        niche: { General: [480, 560], Gambling: [1100, 1300] },
      },
      {
        name: "Sedo Marketplace", type: "DB", updated: "06-06-2026 22:00",
        minPrice: 530, maxPrice: 640, quality: 4, delivery: 14, deliveryDays: 14, tat: 11, link: "Dofollow",
        example: null,
        conditions: ["Synced pricing — confirm on order", "1 dofollow link", "Permanent placement"],
        niche: { General: [530, 640] },
      },
    ],
  },
  {
    domain: "theathletic.com",
    country: "US", lang: "EN", category: "Sports / News",
    dr: 87, drTrend: "up", traffic: 22000000, keywords: 2400000, refDomains: 96000,
    grade: "A", score: 78, bestPrice: 900, linksToMe: false,
    tags: ["football", "soccer", "news", "sports", "analysis"], bias: 0,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 900, maxPrice: 1100, quality: 5, delivery: 10, deliveryDays: 10, tat: 8, link: "Dofollow",
        example: "https://theathletic.com/example-feature",
        conditions: ["Premium editorial vetting", "1 contextual dofollow link", "1000+ words", "No promotional tone"],
        niche: { General: [900, 1100], Crypto: [1600, 1900] },
      },
      {
        name: "Linkbuilder.io", type: "DB", updated: "05-06-2026 10:00",
        minPrice: 980, maxPrice: 980, quality: 4, delivery: 12, deliveryDays: 12, tat: 10, link: "Dofollow",
        example: null,
        conditions: ["Topic pre-approval", "Brand link only", "Permanent placement"],
        niche: { General: [980, 980] },
      },
    ],
  },
  {
    domain: "oneangrygamer.net",
    country: "US", lang: "EN", category: "Gaming / Entertainment",
    dr: 58, drTrend: "flat", traffic: 410000, keywords: 38200, refDomains: 2140,
    grade: "A", score: 71, bestPrice: 200, linksToMe: false,
    tags: ["gaming", "esports", "sports", "news", "reviews"], bias: 0,
    offers: [
      {
        name: "Getlinks", type: "API", updated: "11-06-2026 19:40",
        minPrice: 200, maxPrice: 240, quality: 4, delivery: 8, deliveryDays: 8, tat: 7, link: "Dofollow",
        example: "https://oneangrygamer.net/2025/example-review",
        conditions: ["Gaming / tech topics", "Up to 2 dofollow links", "Min 600 words"],
        niche: { General: [200, 240], Gambling: [480, 560] },
      },
      {
        name: "Vendor: Alex P.", type: "Vendor", updated: "04-06-2026 10:00",
        minPrice: 225, maxPrice: 225, quality: 3, delivery: 10, deliveryDays: 10, tat: 9, link: "Nofollow",
        example: null,
        conditions: ["Nofollow only", "1 link", "No casino"],
        niche: { General: [225, 225] },
      },
    ],
  },
  {
    domain: "forbes.com",
    country: "US", lang: "EN", category: "Business / Finance",
    dr: 94, drTrend: "up", traffic: 71400000, keywords: 8420000, refDomains: 1840000,
    grade: "A+", score: 92, bestPrice: 1200, linksToMe: true,
    tags: ["business", "finance", "markets", "news", "leadership"], bias: -8,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 1300, maxPrice: 1450, quality: 5, delivery: 7, deliveryDays: 7, tat: 5, link: "Dofollow",
        example: "https://forbes.com/sites/example/2025/luxury-watches",
        conditions: ["Contributor vetting", "1 dofollow brand link", "800+ words", "No gambling / adult"],
        niche: { General: [1300, 1450], Gambling: [3200, 3800], Crypto: [2400, 2800] },
      },
      {
        name: "Vendor: John D.", type: "Vendor", updated: "10-06-2026 11:00",
        minPrice: 1200, maxPrice: 1200, quality: 3, delivery: 14, deliveryDays: 14, tat: 12, link: "Dofollow",
        example: "https://forbes.com/sites/example/2023/markets",
        conditions: ["Topic approval", "Permanent placement", "1 link"],
        niche: { General: [1200, 1200], Gambling: [3000, 3000] },
      },
    ],
  },
  {
    domain: "techcrunch.com",
    country: "US", lang: "EN", category: "Technology",
    dr: 92, drTrend: "up", traffic: 14200000, keywords: 1840000, refDomains: 184000,
    grade: "A", score: 78, bestPrice: 850, linksToMe: false,
    tags: ["technology", "startups", "news", "gadgets", "venture"], bias: -10,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 850, maxPrice: 950, quality: 5, delivery: 7, deliveryDays: 7, tat: 5, link: "Dofollow",
        example: "https://techcrunch.com/2025/example",
        conditions: ["Tech relevance required", "1 dofollow link", "700+ words", "No crypto promos"],
        niche: { General: [850, 950], Crypto: [1900, 2200] },
      },
    ],
  },
  {
    domain: "healthline.com",
    country: "US", lang: "EN", category: "Health / Medical",
    dr: 91, drTrend: "flat", traffic: 184000000, keywords: 4800000, refDomains: 92000,
    grade: "A+", score: 88, bestPrice: 1100, linksToMe: false,
    tags: ["health", "medical", "wellness", "nutrition", "fitness"], bias: 0,
    offers: [
      {
        name: "Adsy", type: "API", updated: "12-06-2026 08:10",
        minPrice: 1100, maxPrice: 1300, quality: 5, delivery: 7, deliveryDays: 7, tat: 6, link: "Dofollow",
        example: "https://healthline.com/example",
        conditions: ["Medical reviewer sign-off", "1 dofollow link", "Cited sources required", "No supplements promos"],
        niche: { General: [1100, 1300], CBD: [2400, 2800] },
      },
    ],
  },
  {
    domain: "pitchfork.com",
    country: "US", lang: "EN", category: "Music / Entertainment",
    dr: 88, drTrend: "down", traffic: 4200000, keywords: 480000, refDomains: 38000,
    grade: "B", score: 42, bestPrice: 560, linksToMe: false,
    tags: ["music", "reviews", "culture", "entertainment"], bias: 0,
    offers: [
      {
        name: "Getlinks", type: "API", updated: "11-06-2026 19:40",
        minPrice: 560, maxPrice: 620, quality: 4, delivery: 9, deliveryDays: 9, tat: 7, link: "Dofollow",
        example: "https://pitchfork.com/reviews/example",
        conditions: ["Music / culture fit", "1 dofollow link", "No gambling anchors"],
        niche: { General: [560, 620] },
      },
    ],
  },
];

const MIN_SHOWN = 25; // hide results below this match %
const LOW_RELEVANCE = 45; // if best match < this, show the empty / broaden state

export interface RelatedSearchFilters {
  country?: string;
  language?: string;
  traffic?: number | "any";
  dr?: number | "any";
  grade?: string;
  priceMin?: number;
  priceMax?: number;
  niche?: string;
}

export interface RelatedSearchParams {
  query?: string;
  ownSite?: string;
  hideLinked?: boolean;
  filters?: RelatedSearchFilters;
  sort?: SortState;
}

export interface RelatedSearchResult {
  results: RelatedSite[];
  lowRelevance: boolean;
  quota: { used: number; limit: number; remaining: number; resetLabel: string };
}

function scoreSite(site: RelatedSite, query: string): number {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 50;
  const tagText = (site.tags || []).join(" ").toLowerCase();
  const cat = (site.category || "").toLowerCase();
  const dom = (site.domain || "").toLowerCase();
  let raw = 0;
  words.forEach((w) => {
    if (tagText.includes(w)) raw += 30;
    else if (cat.includes(w)) raw += 18;
    else if (dom.includes(w)) raw += 12;
  });
  const ratio = raw / (words.length * 30);
  return Math.max(0, Math.min(98, Math.round(8 + ratio * 82 + (site.bias || 0))));
}

function passesFilters(site: RelatedSite, f: RelatedSearchFilters | undefined): boolean {
  if (!f) return true;
  if (f.country && f.country !== "any" && site.country !== f.country) return false;
  if (f.language && f.language !== "any" && site.lang !== f.language) return false;
  if (f.traffic && f.traffic !== "any" && (site.traffic || 0) < f.traffic) return false;
  if (f.dr && f.dr !== "any" && (site.dr || 0) < f.dr) return false;
  if (f.priceMax != null && (site.bestPrice == null || site.bestPrice > f.priceMax)) return false;
  if (f.priceMin != null && (site.bestPrice == null || site.bestPrice < f.priceMin)) return false;
  if (f.niche && f.niche !== "general" && f.niche !== "any") {
    const supports = (site.offers || []).some((o) => o.niche && Object.keys(o.niche).some((k) => k.toLowerCase().includes(f.niche!)));
    if (!supports) return false;
  }
  if (f.grade && f.grade !== "any") {
    if (!site.grade || !site.grade.startsWith(f.grade)) return false;
  }
  return true;
}

// Mimics an async network call — deterministic client-side semantic scoring
// so the demo behaves realistically without a real backend.
export function searchRelatedSites({
  query = "",
  ownSite = "",
  hideLinked = true,
  filters = {},
  sort = { key: "match", dir: "desc" },
}: RelatedSearchParams = {}): Promise<RelatedSearchResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hasSite = !!String(ownSite || "").trim();
      const results = LP_RELATED_DATA
        .map((s) => ({ ...s, match: scoreSite(s, query) }))
        .filter((s) => s.match >= MIN_SHOWN)
        .filter((s) => passesFilters(s, filters))
        .filter((s) => (hasSite && hideLinked ? !s.linksToMe : true));

      const bestMatch = results.reduce((m, s) => Math.max(m, s.match), 0);

      const m = sort.dir === "asc" ? 1 : -1;
      results.sort((a, b) => {
        const av = a[sort.key as keyof RelatedSite];
        const bv = b[sort.key as keyof RelatedSite];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * m;
        return ((av as number) - (bv as number)) * m;
      });

      resolve({
        results,
        lowRelevance: results.length === 0 || bestMatch < LOW_RELEVANCE,
        quota: { used: 2, limit: 10, remaining: 8, resetLabel: "Monday 00:00 UTC" },
      });
    }, 900);
  });
}
