// Step 1 of a chat turn: turn the message (plus what the conversation has
// established so far) into a plan the server can execute — an intent, a
// search spec with structured filters, or a reply.
//
// This is the piece the old homepage search did not have. It sent the raw
// sentence to the catalogue, which keyword-prefilters on the first six words
// of the query (see catalog-search.ts), so "I sell a VPN for small
// businesses. Get me guest posts on tech and cybersecurity sites, budget
// around $300" searched for "i sell a vpn for small" with no budget — and
// answered with a $6 press-release site. The planner extracts the topic
// ("cybersecurity VPN technology") and the constraints (≤ $300) so the
// catalogue is asked the question the user actually asked.

import { chatJson } from "./openai";
import { parseSearchSpec } from "./state";
import type { ChatState, Intent, SearchSpec, Understanding } from "./types";

const TIMEOUT_MS = 12_000;
const MAX_OUTPUT_TOKENS = 600;

const INTENTS: readonly Intent[] = ["search", "refine", "domain_lookup", "add_to_cart", "clarify", "chat", "offtopic"];

// Facts the planner may answer "chat" questions from. Kept deliberately
// short and only things that are true of the product today; anything not
// here the model is told not to invent.
export const FACT_SHEET = `LinkPricer compares guest-post and link-placement prices across 60+ link-building marketplaces and 670,000+ websites, shows the cheapest price per site, and places the order for the customer ("managed" order: LinkPricer handles the marketplace, the customer pays after the article is published). Fee: 15% of the price with a minimum of €25 per order; prices shown to customers already include it. Per site it shows Ahrefs Domain Rating (DR), monthly organic traffic, referring domains, main traffic country, language, category and whether links are dofollow. Typical delivery is about 14 days. Niches priced separately by publishers: gambling/iGaming, adult, CBD, loans, dating, crypto, forex. Customers can search, compare suppliers per site, add to cart and check out; there is also a public API and an MCP server for developers.`;

const SYSTEM = `You are the planner for LinkPricer's assistant. ${FACT_SHEET}

Your job: read the conversation state and the new message, and return ONE JSON object telling the server what to do. You never answer searches yourself; the server searches the catalogue.

Return exactly this shape:
{
 "intent": "search" | "refine" | "domain_lookup" | "add_to_cart" | "clarify" | "chat" | "offtopic",
 "goal": "<one English line: what the user wants so far, including every constraint>",
 "reply": "<for clarify/chat/offtopic: what to say, in the user's language, max 60 words; otherwise null>",
 "chips": ["<2-4 short suggested next messages in the user's language>"],
 "search": <search object or null>,
 "scope": "new" | "current",
 "domains": ["example.com"],
 "topN": <number or null>,
 "language": "<ISO 639-1 code of the language the user wrote in>"
}

search object (required for search and refine, null otherwise):
{
 "topic": "<3-6 English words naming the kind of site wanted, in the words a site's own description would use: the subject, the niche, one or two synonyms, and the most specific product or audience term the customer used. No filler words such as sites, websites, blogs, links, guest post, and, for. Examples: 'cybersecurity VPN technology business'; iGaming → 'online casino sports betting gambling'; crypto → 'cryptocurrency bitcoin blockchain'; SaaS → 'SaaS software startups'>",
 "maxPrice": <USD the customer will pay per link, or null>,
 "minPrice": <number or null>,
 "minDr": <0-100 or null>, "maxDr": <0-100 or null>,
 "minTraffic": <number or null>,
 "countries": ["US","GB"] or null,
 "language": "en" or null,
 "languageExplicit": true only when the customer named a language in words ("in German", "English-language", "Spanish sites"); false otherwise,
 "tlds": ["de","co.uk"] or null,
 "niche": "gambling" | "adult" | "cbd" | "loan" | "dating" | "crypto" | "trading_forex" | null,
 "linkType": "guest_post" | "link_insertion" | null,
 "sort": "match" | "dr" | "traffic" | "price" | null,
 "count": <number or null>,
 "dofollowOnly": true | false
}

Intent rules:
- search: the message says what kind of sites or links they want, even loosely ("tech blogs", "yoga sites in Spain", "I run a VPN company and need links"). A kind of site is a topic even without a subject: "get quoted in high-end news", "top-tier publications", "major media" → topic "news media journalism", minDr 60, sort "dr"; "SaaS and tech listicles" → topic "SaaS software technology reviews"; "magazines" → topic "magazine lifestyle culture". A described business, product or audience IS a topic — never ask what niche they want when they have told you what they sell: "We're a Shopify app for abandoned cart recovery, where should we get links?" → search, topic "ecommerce Shopify online store marketing"; "I run a dental clinic in Leeds" → search, topic "dental health local business", countries ["GB"].
- refine: a current search exists in the state and the message changes or narrows it (budget, DR, country, "cheaper", "only dofollow", "more like these", "top 3 of these", "which is best for me"). Return the FULL updated search object: start from the current search and apply the change, keeping every constraint the user did not remove. Removing one ("any budget", "forget the DR limit") sets that field to null.
  scope = "current" ONLY when the user asks about the sites already shown ("which of these", "pick 3", "compare them", "the cheapest of those") and adds no new filter. Otherwise scope = "new".
- domain_lookup: the message names specific websites and asks about them (price, DR, traffic, dofollow, "do you have example.com"). Put the bare domains in "domains".
- add_to_cart: asks to add, buy or order shown sites ("add the top 3 to my cart", "add itsecurityguru.org", "buy all of them"). "domains" = named domains; "topN" = N for "top N" or "first N"; both empty means all shown sites.
- clarify: ONLY when there is nothing at all to search on — no topic, no business, no product, no domain ("I need backlinks", "help", "hi", "what do you have?"). Ask ONE short question for the missing piece (the topic or niche first; budget is optional) and give chips with concrete example answers.
- chat: a question about LinkPricer or buying links in general ("how does this work", "what is DR", "how do you charge", "how long does it take"). Answer briefly in "reply" using only the facts above; never invent prices or policies.
- offtopic: unrelated to buying links or websites (maths, jokes, code, chores). "reply" is one friendly sentence saying what you can help with.

Extraction rules:
- Budget: "budget $300", "around $300", "max 300", "up to 300", "under 300" → maxPrice 300. "$100-$300" → minPrice 100, maxPrice 300. "cheap" with no number → sort "price", maxPrice null. Convert EUR ×1.1 and GBP ×1.3 to USD and round sensibly.
- "DR 50+", "DR above 50", "authority 50" → minDr 50. "high authority", "strong sites" → minDr 50. "DR 30-60" → minDr 30, maxDr 60.
- "traffic 10k+" → minTraffic 10000; "real traffic", "with traffic" → minTraffic 1000.
- Country: "UK sites", "sites in Germany", "US audience" → countries. "German sites" → countries ["DE"] and language "de". "in German", "German-language" → language "de" only. ".de domains" → tlds ["de"]. Set language ONLY when the customer names one; never infer it from the language they wrote in, and never set it to "en" for an English message.
- Niche (changes the price): casino, gambling, betting, iGaming, poker → "gambling"; crypto, bitcoin, blockchain → "crypto"; CBD, cannabis → "cbd"; adult; dating; loans, payday → "loan"; forex, trading → "trading_forex". The topic still describes the content ("online casino sports betting").
- "niche edit", "link insertion", "existing article" → linkType "link_insertion"; "guest post", "sponsored post", "article" → "guest_post".
- "cheapest" → sort "price"; "highest DR", "most authoritative" → "dr"; "most traffic" → "traffic"; otherwise null.
- "top 3", "5 sites", "a couple" → count 3, 5, 2.
- dofollowOnly is true only when the user says dofollow or follow links.
- Messages in other languages: the topic is translated to English; reply and chips stay in the user's language.
- chips are messages the customer might send next, written as they would type them. For search/refine: useful narrowings such as "Only DR 50+", "Under $150", "Dofollow only", "Sites in the UK". For clarify: example answers such as "Tech blogs under $200", "Finance sites, DR 50+". For domain_lookup: "Find similar sites", "Cheaper alternatives". For chat/offtopic: example searches. Never offer things the assistant cannot do (writing content, contacting publishers).`;

function stateBlock(state: ChatState): string {
  const lines: string[] = [];
  lines.push(`goal: ${state.goal || "(none yet)"}`);
  lines.push(`current search: ${state.search ? JSON.stringify(state.search) : "none"}`);
  lines.push(`sites currently shown (best first): ${state.resultDomains.length ? state.resultDomains.slice(0, 15).join(", ") : "none"}`);
  if (state.turns.length) {
    lines.push("last turns:");
    for (const t of state.turns.slice(-4)) {
      lines.push(`User: ${t.user}`);
      lines.push(`Assistant: ${t.assistant}`);
    }
  }
  return lines.join("\n");
}

/** Bare host from whatever the user typed: URL, "www.", trailing path or punctuation. */
export function normalizeDomainMention(raw: string): string | null {
  let s = raw.trim().toLowerCase().replace(/^[("'\[<]+/, "");
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split(/[/?#\s,;]/)[0] ?? "";
  s = s.replace(/[.)\]]+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s.slice(0, 253);
}

const STOPWORDS = new Set(["i", "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with", "about", "me", "my", "we", "our", "need", "want", "get", "find", "some", "please", "sites", "site", "websites", "website", "blogs", "blog", "links", "link", "backlinks", "backlink", "guest", "post", "posts"]);

/**
 * What a turn means when the model is unavailable: a plain search on the
 * message's own words, so the chat still answers instead of erroring.
 */
export function fallbackUnderstanding(message: string, state: ChatState): Understanding {
  const words = message.toLowerCase().replace(/[^\p{L}\p{N}\s.-]/gu, " ").split(/\s+/).filter((w) => w && !STOPWORDS.has(w)).slice(0, 6);
  const topic = words.join(" ").trim();
  if (!topic) {
    return {
      intent: "clarify", goal: state.goal, reply: "What kind of websites are you looking for, and do you have a budget per link?",
      chips: ["Tech blogs under $200", "Finance sites with DR 50+", "iGaming sites in the UK"], search: null, scope: "new", domains: [], topN: null, language: "en",
    };
  }
  const base: SearchSpec = state.search ?? { topic, maxPrice: null, minPrice: null, minDr: null, maxDr: null, minTraffic: null, countries: null, language: null, tlds: null, niche: null, linkType: null, sort: null, count: null, dofollowOnly: false };
  return { intent: state.search ? "refine" : "search", goal: state.goal || message.slice(0, 200), reply: null, chips: [], search: { ...base, topic }, scope: "new", domains: [], topN: null, language: "en" };
}

/** Validates and reconciles the model's plan against what the state allows. */
export function parseUnderstanding(raw: unknown, message: string, state: ChatState): Understanding {
  if (!raw || typeof raw !== "object") return fallbackUnderstanding(message, state);
  const r = raw as Record<string, unknown>;
  let intent: Intent = typeof r.intent === "string" && INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : "search";
  const search = parseSearchSpec(r.search);
  const reply = typeof r.reply === "string" && r.reply.trim() ? r.reply.trim().slice(0, 600) : null;
  const chips = Array.isArray(r.chips)
    ? r.chips.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim().slice(0, 80)).slice(0, 4)
    : [];
  const domains = Array.isArray(r.domains)
    ? [...new Set(r.domains.filter((d): d is string => typeof d === "string").map(normalizeDomainMention).filter((d): d is string => !!d))].slice(0, 10)
    : [];
  const topN = typeof r.topN === "number" && Number.isFinite(r.topN) && r.topN >= 1 ? Math.min(30, Math.round(r.topN)) : null;
  const language = typeof r.language === "string" && /^[a-z]{2}$/i.test(r.language.trim()) ? r.language.trim().toLowerCase() : "en";
  const goal = typeof r.goal === "string" ? r.goal.trim().slice(0, 300) : state.goal;
  let scope: "new" | "current" = r.scope === "current" ? "current" : "new";

  const hasShown = state.resultIds.length > 0;
  if (intent === "refine" && !state.search && !search) intent = "clarify";
  if (intent === "refine" && !state.search) intent = "search";
  if (scope === "current" && !hasShown) scope = "new";
  if (intent === "add_to_cart" && !hasShown) {
    return { intent: "clarify", goal, reply: reply ?? "Run a search first, then tell me which sites to add to the cart.", chips: chips.length ? chips : ["Tech blogs under $200", "Finance sites with DR 50+"], search: null, scope: "new", domains: [], topN: null, language };
  }
  if (intent === "domain_lookup" && domains.length === 0) {
    const fromMessage = message.split(/\s+/).map(normalizeDomainMention).filter((d): d is string => !!d);
    if (fromMessage.length === 0) intent = search ? "search" : "clarify";
    else domains.push(...fromMessage.slice(0, 10));
  }
  if ((intent === "search" || intent === "refine")) {
    let spec = search ?? state.search;
    if (!spec) return fallbackUnderstanding(message, state);
    // languageExplicit is judged per message, so a refine ("only DR 50+")
    // after "German sites" would come back with no language. A language the
    // conversation already has is kept unless this message names another.
    if (intent === "refine" && state.search?.language && !spec.language) spec = { ...spec, language: state.search.language };
    return { intent, goal, reply: null, chips, search: spec, scope, domains, topN, language };
  }
  if ((intent === "clarify" || intent === "chat" || intent === "offtopic") && !reply) {
    // A reply-type intent with nothing to say is useless; search on the message instead.
    if (search) return { intent: state.search ? "refine" : "search", goal, reply: null, chips, search, scope: "new", domains, topN, language };
    return fallbackUnderstanding(message, state);
  }
  return { intent, goal, reply, chips, search: search ?? state.search, scope, domains, topN, language };
}

export interface UnderstandResult {
  understanding: Understanding;
  ms: number;
  usedModel: boolean;
}

export async function understand(message: string, state: ChatState): Promise<UnderstandResult> {
  const t0 = Date.now();
  const user = `Conversation state:\n${stateBlock(state)}\n\nNew message: """${message.replace(/"""/g, '"')}"""`;
  const res = await chatJson({ system: SYSTEM, user, maxTokens: MAX_OUTPUT_TOKENS, timeoutMs: TIMEOUT_MS, tag: "understand" });
  if (!res) return { understanding: fallbackUnderstanding(message, state), ms: Date.now() - t0, usedModel: false };
  return { understanding: parseUnderstanding(res.json, message, state), ms: Date.now() - t0, usedModel: true };
}
