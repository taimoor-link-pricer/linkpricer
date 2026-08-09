// Shared shapes for the Karolis design system's sample/demo data.
// Mirrors the object shape used throughout data/sample.js, data/related.js
// and v1-app.jsx in the design handoff — kept loose (nullable fields) since
// this is demo/sample data, not a real API contract.

export type OfferType = "API" | "DB" | "Vendor";

export interface Offer {
  name: string;
  type: OfferType;
  updated: string;
  minPrice: number;
  maxPrice?: number;
  quality: number;
  // Only meaningfully set by real API data (lib/search/catalog-search.ts) —
  // omitted by demo/sample data, in which case RatingBadge just renders
  // `quality` as-is (see lib/design-v1/icons.tsx).
  ratingCount?: number;
  hasEnoughRatings?: boolean;
  delivery: number;
  deliveryDays?: number;
  tat: number;
  link: "Dofollow" | "Nofollow";
  links?: number;
  example: string | null;
  conditions?: string[];
  niche?: Record<string, [number, number]>;
  gambling?: [number, number];
  crypto?: [number, number];
}

export interface Domain {
  domain: string;
  country?: string | null;
  lang?: string;
  category?: string | null;
  dr?: number;
  drTrend?: "up" | "down" | "flat";
  traffic?: number;
  keywords?: number;
  refDomains?: number;
  grade?: string;
  score?: number;
  bestPrice?: number | null;
  yourPrice?: number | null;
  noPrice?: boolean;
  notFound?: boolean;
  offers?: Offer[];
  match?: number;
}

export interface RelatedSite extends Domain {
  linksToMe?: boolean;
  tags?: string[];
  bias?: number;
}

export interface Niche {
  id: string;
  label: string;
}

export type Currency = "USD" | "EUR" | "GBP";

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export type BuyHandler = (d: Domain, o: Offer) => void;
