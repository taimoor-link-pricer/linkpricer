// Shared shapes for the homepage assistant: what the planner extracts from a
// message, what the retrieval step hands the composer, and the state the
// client carries between turns.
//
// The state travels through the client on purpose. The chat is served from
// serverless functions, so an in-memory session map would forget the
// conversation on the next cold start; the state is small (a one-line goal,
// a search spec, up to 30 result ids, the last few turns) and nothing in it is
// secret, so round-tripping it is simpler and more robust than a session
// table. It is still untrusted input: parseState in state.ts validates every
// field before the server uses it.

import type { CatalogSearchOffer } from "@/lib/search/catalog-search";

export const NICHE_IDS = ["standard", "gambling", "adult", "cbd", "loan", "dating", "crypto", "trading_forex"] as const;
export type NicheId = (typeof NICHE_IDS)[number];

export type LinkType = "guest_post" | "link_insertion";
export type SortKey = "match" | "dr" | "traffic" | "price";

export interface SearchSpec {
  // Short English noun phrase describing the sites wanted ("cybersecurity
  // and VPN technology blogs"). This is what the catalogue is searched with.
  topic: string;
  // Customer budget per link in USD, fee included — what they would pay.
  maxPrice: number | null;
  minPrice: number | null;
  minDr: number | null;
  maxDr: number | null;
  minTraffic: number | null;
  // ISO 3166-1 alpha-2 codes, any of which matches.
  countries: string[] | null;
  // ISO 639-1 code of the site's language.
  language: string | null;
  // Domain endings without the dot.
  tlds: string[] | null;
  niche: NicheId | null;
  linkType: LinkType | null;
  sort: SortKey | null;
  // How many sites the user asked for ("top 3", "10 cheapest").
  count: number | null;
  dofollowOnly: boolean;
}

export type Intent =
  | "search"        // a new request for sites
  | "refine"        // narrows/changes the previous request, or asks about the shown sites
  | "domain_lookup" // asks about specific named sites
  | "add_to_cart"   // asks to put shown sites in the cart
  | "clarify"       // not enough to search on; ask one question back
  | "chat"          // a question about LinkPricer / link building, answerable from the fact sheet
  | "offtopic";     // nothing to do with buying links

export interface Understanding {
  intent: Intent;
  // One line describing what the user wants so far, carried in the state so
  // later turns keep the context ("VPN vendor wants tech/cyber guest posts
  // under $300").
  goal: string;
  // What to say for clarify / chat / offtopic (in the user's language).
  reply: string | null;
  // 2-4 suggested next messages, in the user's language.
  chips: string[];
  search: SearchSpec | null;
  // "current": answer from the sites already shown (pick 3 of these,
  // compare them) instead of searching again.
  scope: "new" | "current";
  // domain_lookup / add_to_cart: which sites. For add_to_cart, "top" entries
  // like "top 3" are resolved against the current results by the server.
  domains: string[];
  // How many of the current results an add_to_cart "the top N" refers to.
  topN: number | null;
  // ISO 639-1 code of the language the user wrote in.
  language: string;
}

export interface AssistantSite {
  id: string;
  domain: string;
  dr: number;
  traffic: number;
  refDomains: number;
  country: string;
  lang: string;
  category: string;
  // The AI-written description of the site, when one exists.
  about: string | null;
  // Cheapest marketplace quote (USD, no fee) and the same with our fee.
  fromPrice: number | null;
  ourPrice: number | null;
  // When the cheapest quote is far below what the site's other suppliers
  // ask (a $63 quote on a DR 90 national newspaper whose median is $1,200),
  // it is a listing error, not a bargain: ourPrice/fromPrice/bestOffer then
  // describe the median supplier, and the suspicious quote is kept here so
  // the card can show it as unverified.
  priceOutlier: boolean;
  lowQuote: number | null;
  offerCount: number;
  dofollow: boolean;
  // The cheapest offer — what Buy / Add to cart act on.
  bestOffer: CatalogSearchOffer | null;
  matchPct: number;
  // Filled by the composer.
  reason?: string;
}

export interface Composition {
  summary: string;
  // Domains in the order to show, best first. Only domains from the input.
  order: string[];
  reasons: Record<string, string>;
  chips: string[];
}

export interface ChatTurn {
  user: string;
  assistant: string;
}

export interface ChatState {
  v: 1;
  goal: string;
  search: SearchSpec | null;
  // The current result set, best first — what "these", "the top 3" and
  // "add them to the cart" refer to.
  resultIds: string[];
  resultDomains: string[];
  turns: ChatTurn[];
}

// Wire format: newline-delimited JSON, one event per line, in this order.
export type ChatEvent =
  | { type: "status"; stage: "understanding" | "searching" | "ranking" }
  | { type: "understood"; intent: Intent; filters: string[]; spec: SearchSpec | null }
  | { type: "message"; text: string; chips: string[]; state: ChatState }
  | { type: "results"; sites: AssistantSite[]; lowRelevance: boolean; total: number }
  // `sites` are the ordered, explained sites in full — the client renders
  // from these, so a guest who was sent only part of the candidate list
  // still sees every site the answer names.
  | { type: "answer"; summary: string; order: string[]; reasons: Record<string, string>; sites: AssistantSite[]; chips: string[]; state: ChatState }
  | { type: "action"; action: "add_to_cart"; sites: AssistantSite[]; text: string; state: ChatState }
  | { type: "error"; message: string }
  | { type: "done" };
