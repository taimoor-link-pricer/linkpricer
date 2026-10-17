// The conversation state the client carries between turns, and the
// validation that makes it safe to trust.
//
// Everything here arrives from the browser, so nothing is taken at face
// value: types are checked, strings are clipped, lists are capped, unknown
// keys are dropped. A malformed state degrades to "fresh conversation", never
// to a crash or to a query the user did not build.

import { NICHE_IDS, type ChatState, type ChatTurn, type NicheId, type SearchSpec, type SortKey, type LinkType } from "./types";

export const MAX_TURNS = 6;
export const MAX_RESULT_IDS = 30;
const MAX_GOAL_CHARS = 300;
const MAX_TURN_CHARS = 600;
const MAX_TOPIC_CHARS = 120;
const MAX_LIST = 10;

export const EMPTY_STATE: ChatState = { v: 1, goal: "", search: null, resultIds: [], resultDomains: [], turns: [] };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < lo || v > hi) return null;
  return v;
}

function codeList(v: unknown, pattern: RegExp, transform: (s: string) => string): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => transform(x.trim())).filter((x) => pattern.test(x)))];
  return out.length ? out.slice(0, MAX_LIST) : null;
}

/**
 * Normalizes a search spec from any source (the planner's reply or the
 * client's state) into the exact shape the retrieval step expects. Values
 * that make no sense (DR 250, a budget of -5, a three-letter country code)
 * are dropped rather than passed on.
 */
export function parseSearchSpec(raw: unknown): SearchSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const topic = str(r.topic, MAX_TOPIC_CHARS);
  if (!topic) return null;
  const sort = typeof r.sort === "string" && ["match", "dr", "traffic", "price"].includes(r.sort) ? (r.sort as SortKey) : null;
  const niche = typeof r.niche === "string" && (NICHE_IDS as readonly string[]).includes(r.niche) ? (r.niche as NicheId) : null;
  const linkType = r.linkType === "guest_post" || r.linkType === "link_insertion" ? (r.linkType as LinkType) : null;
  // The planner keeps setting language to the language the customer wrote
  // in, however it is told not to; so a language counts only when it also
  // says the customer named one. A spec coming back from the client's state
  // has already been through this and carries no flag, so absent means kept.
  const explicit = r.languageExplicit === undefined ? true : r.languageExplicit === true;
  const language = explicit && typeof r.language === "string" && /^[a-z]{2}$/.test(r.language.trim().toLowerCase()) ? r.language.trim().toLowerCase() : null;
  let minDr = num(r.minDr, 0, 100);
  let maxDr = num(r.maxDr, 0, 100);
  if (minDr != null && maxDr != null && minDr > maxDr) [minDr, maxDr] = [maxDr, minDr];
  let minPrice = num(r.minPrice, 0, 1_000_000);
  let maxPrice = num(r.maxPrice, 0, 1_000_000);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];
  if (maxPrice === 0) maxPrice = null;
  const count = num(r.count, 1, 30);
  return {
    topic,
    maxPrice,
    minPrice: minPrice === 0 ? null : minPrice,
    minDr,
    maxDr,
    minTraffic: num(r.minTraffic, 0, 1_000_000_000),
    countries: codeList(r.countries, /^[A-Z]{2}$/, (s) => s.toUpperCase()),
    language,
    tlds: codeList(r.tlds, /^[a-z0-9.-]{2,12}$/, (s) => s.toLowerCase().replace(/^\./, "")),
    niche: niche === "standard" ? null : niche,
    linkType,
    sort,
    count: count != null ? Math.round(count) : null,
    dofollowOnly: r.dofollowOnly === true,
  };
}

/** Validates the state the client sent back; anything off-shape becomes a fresh state. */
export function parseState(raw: unknown): ChatState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return EMPTY_STATE;
  const turns: ChatTurn[] = Array.isArray(r.turns)
    ? r.turns
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .map((t) => ({ user: str(t.user, MAX_TURN_CHARS), assistant: str(t.assistant, MAX_TURN_CHARS) }))
        .filter((t) => t.user)
        .slice(-MAX_TURNS)
    : [];
  const resultIds = Array.isArray(r.resultIds)
    ? r.resultIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAX_RESULT_IDS)
    : [];
  const resultDomains = Array.isArray(r.resultDomains)
    ? r.resultDomains.filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase().slice(0, 253)).slice(0, MAX_RESULT_IDS)
    : [];
  return {
    v: 1,
    goal: str(r.goal, MAX_GOAL_CHARS),
    search: parseSearchSpec(r.search),
    resultIds,
    resultDomains: resultDomains.length === resultIds.length ? resultDomains : [],
    turns,
  };
}

/** The state after a turn: new goal and spec, the shown result set, and the last few exchanges. */
export function nextState(
  prev: ChatState,
  update: { goal?: string; search?: SearchSpec | null; results?: { id: string; domain: string }[]; user: string; assistant: string }
): ChatState {
  const results = update.results ?? null;
  return {
    v: 1,
    goal: str(update.goal ?? prev.goal, MAX_GOAL_CHARS),
    search: update.search === undefined ? prev.search : update.search,
    resultIds: results ? results.slice(0, MAX_RESULT_IDS).map((r) => r.id) : prev.resultIds,
    resultDomains: results ? results.slice(0, MAX_RESULT_IDS).map((r) => r.domain) : prev.resultDomains,
    turns: [...prev.turns, { user: str(update.user, MAX_TURN_CHARS), assistant: str(update.assistant, MAX_TURN_CHARS) }].slice(-MAX_TURNS),
  };
}

/** Human-readable chips for a spec — what the UI shows as the active filters. */
export function describeSpec(spec: SearchSpec | null): string[] {
  if (!spec) return [];
  const out: string[] = [];
  if (spec.topic) out.push(spec.topic);
  if (spec.niche) out.push({ gambling: "iGaming pricing", adult: "Adult pricing", cbd: "CBD pricing", loan: "Loans pricing", dating: "Dating pricing", crypto: "Crypto pricing", trading_forex: "Forex pricing", standard: "" }[spec.niche]);
  if (spec.linkType === "link_insertion") out.push("Link insertion");
  if (spec.maxPrice != null && spec.minPrice != null) out.push(`$${spec.minPrice}–$${spec.maxPrice}`);
  else if (spec.maxPrice != null) out.push(`≤ $${spec.maxPrice}`);
  else if (spec.minPrice != null) out.push(`≥ $${spec.minPrice}`);
  if (spec.minDr != null && spec.maxDr != null) out.push(`DR ${spec.minDr}–${spec.maxDr}`);
  else if (spec.minDr != null) out.push(`DR ≥ ${spec.minDr}`);
  else if (spec.maxDr != null) out.push(`DR ≤ ${spec.maxDr}`);
  if (spec.minTraffic != null) out.push(`Traffic ≥ ${spec.minTraffic >= 1000 ? `${Math.round(spec.minTraffic / 1000)}K` : spec.minTraffic}`);
  if (spec.countries?.length) out.push(spec.countries.join(", "));
  if (spec.language) out.push(`Language: ${spec.language.toUpperCase()}`);
  if (spec.tlds?.length) out.push(spec.tlds.map((t) => `.${t}`).join(", "));
  if (spec.dofollowOnly) out.push("Dofollow");
  if (spec.sort && spec.sort !== "match") out.push({ dr: "Highest DR first", traffic: "Most traffic first", price: "Cheapest first" }[spec.sort]);
  return out.filter(Boolean);
}
