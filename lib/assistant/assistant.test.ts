/**
 * The assistant's pure logic, pinned: how a model reply becomes a plan, how
 * a composition is validated against the sites it was given, how the client
 * state is sanitised, and how a customer budget becomes a marketplace price
 * bound. No network, no database.
 */

import { describe, it, expect } from "vitest";
import { parseUnderstanding, fallbackUnderstanding, normalizeDomainMention } from "@/lib/assistant/understand";
import { parseComposition, fallbackComposition } from "@/lib/assistant/compose";
import { parseState, parseSearchSpec, nextState, describeSpec, EMPTY_STATE } from "@/lib/assistant/state";
import { budgetToMarketplaceMax, applySpecInJs, sortForSpec, cleanAbout, blendedScore, displayCountry, cutCandidates, isThin, isHostedSubdomain } from "@/lib/assistant/retrieve";
import { withFeeUsd, minFeeCents } from "@/lib/pricing/fee";
import type { AssistantSite, ChatState, SearchSpec } from "@/lib/assistant/types";

const spec = (over: Partial<SearchSpec> = {}): SearchSpec => ({
  topic: "cybersecurity VPN technology", maxPrice: 300, minPrice: null, minDr: null, maxDr: null, minTraffic: null,
  countries: null, language: null, tlds: null, niche: null, linkType: null, sort: null, count: null, dofollowOnly: false, ...over,
});

const site = (domain: string, over: Partial<AssistantSite> = {}): AssistantSite => ({
  id: `00000000-0000-4000-8000-${Array.from(domain).map((c) => c.charCodeAt(0).toString(16)).join("").padEnd(12, "0").slice(0, 12)}`,
  domain, dr: 50, traffic: 1000, refDomains: 100, country: "United States", lang: "English", category: "Technology",
  about: null, fromPrice: 100, ourPrice: 129, priceOutlier: false, lowQuote: null, offerCount: 3, dofollow: true, bestOffer: null, matchPct: 80, ...over,
});

const withResults: ChatState = { ...EMPTY_STATE, goal: "tech links", search: spec(), resultIds: [site("a.com").id, site("b.com").id, site("c.com").id], resultDomains: ["a.com", "b.com", "c.com"] };

describe("parseUnderstanding", () => {
  it("keeps a well-formed search plan and normalises its spec", () => {
    const u = parseUnderstanding({
      intent: "search", goal: "VPN vendor wants tech/cyber guest posts under $300", reply: null, chips: ["Only DR 50+"],
      search: { topic: "cybersecurity VPN technology", maxPrice: 300, countries: ["us"], language: "EN", tlds: [".de"], dofollowOnly: true, sort: "price", count: 3.4 },
      scope: "new", domains: [], topN: null, language: "en",
    }, "msg", EMPTY_STATE);
    expect(u.intent).toBe("search");
    expect(u.search).toMatchObject({ topic: "cybersecurity VPN technology", maxPrice: 300, countries: ["US"], language: "en", tlds: ["de"], dofollowOnly: true, sort: "price", count: 3 });
    expect(u.chips).toEqual(["Only DR 50+"]);
  });

  it("drops impossible filter values instead of passing them on", () => {
    const s = parseSearchSpec({ topic: "finance", minDr: 250, maxPrice: -5, countries: ["USA", "GB"], language: "english", minTraffic: "lots" });
    expect(s).toMatchObject({ topic: "finance", minDr: null, maxPrice: null, countries: ["GB"], language: null, minTraffic: null });
  });

  it("swaps an inverted DR or price range", () => {
    expect(parseSearchSpec({ topic: "x", minDr: 60, maxDr: 30, minPrice: 300, maxPrice: 100 })).toMatchObject({ minDr: 30, maxDr: 60, minPrice: 100, maxPrice: 300 });
  });

  it("turns refine without a previous search into a plain search", () => {
    const u = parseUnderstanding({ intent: "refine", search: { topic: "yoga" }, scope: "current" }, "yoga sites", EMPTY_STATE);
    expect(u.intent).toBe("search");
    expect(u.scope).toBe("new");
  });

  it("keeps scope current only when there are shown results", () => {
    const u = parseUnderstanding({ intent: "refine", search: spec({ count: 3 }), scope: "current" }, "pick 3", withResults);
    expect(u.intent).toBe("refine");
    expect(u.scope).toBe("current");
  });

  it("falls back to the previous spec when a refine reply carries none", () => {
    const u = parseUnderstanding({ intent: "refine", search: null, scope: "new" }, "cheaper", withResults);
    expect(u.search).toEqual(withResults.search);
  });

  it("turns add_to_cart with nothing shown into a clarification", () => {
    const u = parseUnderstanding({ intent: "add_to_cart", domains: ["a.com"] }, "add a.com", EMPTY_STATE);
    expect(u.intent).toBe("clarify");
    expect(u.reply).toMatch(/search first/i);
  });

  it("resolves add_to_cart targets by name and by top N", () => {
    const named = parseUnderstanding({ intent: "add_to_cart", domains: ["https://www.B.com/path"], topN: null }, "add b.com", withResults);
    expect(named.domains).toEqual(["b.com"]);
    const top = parseUnderstanding({ intent: "add_to_cart", domains: [], topN: 2 }, "add the top 2", withResults);
    expect(top.topN).toBe(2);
  });

  it("recovers domains from the message when the model forgot them", () => {
    const u = parseUnderstanding({ intent: "domain_lookup", domains: [] }, "what does itsecurityguru.org cost?", EMPTY_STATE);
    expect(u.intent).toBe("domain_lookup");
    expect(u.domains).toEqual(["itsecurityguru.org"]);
  });

  it("does not accept a reply-type intent with nothing to say", () => {
    const u = parseUnderstanding({ intent: "offtopic", reply: "" }, "tech blogs", EMPTY_STATE);
    expect(u.intent).toBe("search");
    expect(u.search?.topic).toContain("tech");
  });

  it("falls back to a word search when the reply is garbage", () => {
    const u = parseUnderstanding("nope", "I sell a VPN for small businesses, need links on tech sites", EMPTY_STATE);
    expect(u.intent).toBe("search");
    expect(u.search?.topic.split(" ").length).toBeLessThanOrEqual(6);
    expect(u.search?.topic).not.toMatch(/\b(for|links|need)\b/);
  });

  it("asks a question when the fallback has no words to search on", () => {
    expect(fallbackUnderstanding("I need backlinks", EMPTY_STATE).intent).toBe("clarify");
  });
});

describe("normalizeDomainMention", () => {
  it("strips protocol, www, paths and trailing punctuation", () => {
    expect(normalizeDomainMention("https://www.Example.com/blog?x=1")).toBe("example.com");
    expect(normalizeDomainMention("itsecurityguru.org,")).toBe("itsecurityguru.org");
    expect(normalizeDomainMention("(secureblitz.com)")).toBe("secureblitz.com");
    expect(normalizeDomainMention("cost")).toBeNull();
  });
});

describe("parseComposition", () => {
  const sites = [site("a.com"), site("b.com"), site("c.com")];

  it("keeps only listed domains, in the model's order, with their reasons", () => {
    const c = parseComposition({ summary: "ok", order: ["B.com", "fake.com", "www.a.com", "b.com"], reasons: { "b.com": "DR 50", "fake.com": "x" }, chips: ["one", "two", "three", "four"] }, sites, 10);
    expect(c?.order).toEqual(["b.com", "a.com"]);
    expect(c?.reasons).toEqual({ "b.com": "DR 50" });
    expect(c?.chips).toHaveLength(3);
  });

  it("caps the order at the wanted count", () => {
    const c = parseComposition({ summary: "ok", order: ["a.com", "b.com", "c.com"] }, sites, 2);
    expect(c?.order).toEqual(["a.com", "b.com"]);
  });

  it("falls back to retrieval order when the model named nothing usable", () => {
    const c = parseComposition({ summary: "ok", order: ["nope.com"] }, sites, 10);
    expect(c?.order).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("rejects a reply without a summary", () => {
    expect(parseComposition({ order: ["a.com"] }, sites, 10)).toBeNull();
  });

  it("writes a factual fallback when the model is unavailable", () => {
    const c = fallbackComposition({ message: "m", goal: "", language: "en", spec: spec(), filters: ["cybersecurity VPN technology", "≤ $300"], mode: "search", lowRelevance: false, total: 3, sites });
    expect(c.order).toEqual(["a.com", "b.com", "c.com"]);
    expect(c.summary).toContain("a.com");
    expect(c.summary).toContain("≤ $300");
  });
});

describe("state", () => {
  it("treats anything off-shape as a fresh conversation", () => {
    expect(parseState(null)).toEqual(EMPTY_STATE);
    expect(parseState({ v: 2, goal: "x" })).toEqual(EMPTY_STATE);
    expect(parseState("[]")).toEqual(EMPTY_STATE);
  });

  it("drops ids that are not uuids and keeps domains only when they line up", () => {
    const s = parseState({ v: 1, goal: "g", search: spec(), resultIds: [site("a.com").id, "DROP TABLE domains"], resultDomains: ["a.com", "evil.com"], turns: [{ user: "u", assistant: "a" }, { user: "", assistant: "x" }] });
    expect(s.resultIds).toEqual([site("a.com").id]);
    expect(s.resultDomains).toEqual([]);
    expect(s.turns).toEqual([{ user: "u", assistant: "a" }]);
  });

  it("keeps only the last six turns and the shown result set", () => {
    let s = EMPTY_STATE;
    for (let i = 0; i < 8; i++) s = nextState(s, { user: `u${i}`, assistant: `a${i}` });
    expect(s.turns).toHaveLength(6);
    expect(s.turns[0].user).toBe("u2");
    s = nextState(s, { user: "x", assistant: "y", results: [{ id: "1", domain: "a.com" }] });
    expect(s.resultIds).toEqual(["1"]);
    expect(s.resultDomains).toEqual(["a.com"]);
  });

  it("describes a spec as filter chips", () => {
    expect(describeSpec(spec({ minDr: 50, countries: ["GB"], dofollowOnly: true, sort: "price", niche: "gambling" })))
      .toEqual(["cybersecurity VPN technology", "iGaming pricing", "≤ $300", "DR ≥ 50", "GB", "Dofollow", "Cheapest first"]);
  });
});

describe("budgetToMarketplaceMax", () => {
  const floor = minFeeCents({ EUR: 1.14 });

  it("never admits a marketplace price whose fee-inclusive price exceeds the budget", () => {
    for (const budget of [30, 50, 80, 100, 150, 190, 200, 300, 500, 1000, 5000]) {
      const cap = budgetToMarketplaceMax(budget, floor);
      expect(withFeeUsd(cap, floor)).toBeLessThanOrEqual(budget);
      // And it is tight: a dollar more would break the budget.
      expect(withFeeUsd(cap + 1, floor)).toBeGreaterThan(budget);
    }
  });

  it("floors at $1 for budgets the minimum fee alone exceeds", () => {
    expect(budgetToMarketplaceMax(10, floor)).toBe(1);
  });
});

describe("applySpecInJs / sortForSpec", () => {
  const sites = [
    site("a.com", { dr: 70, traffic: 5000, ourPrice: 400, dofollow: true }),
    site("b.com", { dr: 40, traffic: 50, ourPrice: 90, dofollow: false }),
    site("c.com", { dr: 55, traffic: 2000, ourPrice: 150, dofollow: true }),
  ];

  it("applies DR, traffic, price and dofollow bounds to a set loaded by id", () => {
    expect(applySpecInJs(sites, spec({ maxPrice: 200 })).map((s) => s.domain)).toEqual(["b.com", "c.com"]);
    expect(applySpecInJs(sites, spec({ maxPrice: null, minDr: 50 })).map((s) => s.domain)).toEqual(["a.com", "c.com"]);
    expect(applySpecInJs(sites, spec({ maxPrice: null, dofollowOnly: true, minTraffic: 3000 })).map((s) => s.domain)).toEqual(["a.com"]);
  });

  it("orders by the requested metric and leaves match order alone", () => {
    expect(sortForSpec(sites, spec({ sort: "price" })).map((s) => s.domain)).toEqual(["b.com", "c.com", "a.com"]);
    expect(sortForSpec(sites, spec({ sort: "dr" })).map((s) => s.domain)).toEqual(["a.com", "c.com", "b.com"]);
    expect(sortForSpec(sites, spec({ sort: "traffic" })).map((s) => s.domain)).toEqual(["a.com", "c.com", "b.com"]);
    expect(sortForSpec(sites, spec({ sort: "match" })).map((s) => s.domain)).toEqual(["a.com", "c.com", "b.com"]);
  });

  it("blends match with authority and pushes thin sites down", () => {
    const strong = site("s.com", { matchPct: 70, dr: 75, traffic: 50000 });
    const topical = site("t.com", { matchPct: 95, dr: 6, traffic: 0 });
    const mid = site("m.com", { matchPct: 80, dr: 40, traffic: 800 });
    expect(sortForSpec([topical, mid, strong], spec({ sort: null })).map((s) => s.domain)).toEqual(["s.com", "m.com", "t.com"]);
    expect(blendedScore(topical)).toBeLessThan(blendedScore(mid));
  });

  it("moves sites in another known language down, never unknown ones", () => {
    const fr = site("fr.com", { matchPct: 80, dr: 40, traffic: 500, lang: "French" });
    const en = site("en.com", { matchPct: 80, dr: 40, traffic: 500, lang: "English" });
    const unknown = site("x.com", { matchPct: 80, dr: 40, traffic: 500, lang: "" });
    expect(blendedScore(fr, "en")).toBeLessThan(blendedScore(en, "en"));
    expect(blendedScore(unknown, "en")).toBe(blendedScore(en, "en"));
    expect(blendedScore(fr, null)).toBe(blendedScore(en, null));
    expect(cutCandidates([fr, en, unknown], "en", 2).map((s) => s.domain)).toEqual(["en.com", "x.com"]);
  });

  it("sorts by price within tiers: traffic first, then authority, then thin", () => {
    const thin = site("thin.com", { dr: 2, traffic: 0, ourPrice: 31 });
    const real = site("real.com", { dr: 34, traffic: 0, ourPrice: 33 });
    const traffic = site("tr.com", { dr: 5, traffic: 900, ourPrice: 35 });
    const big = site("big.com", { dr: 75, traffic: 79000, ourPrice: 44 });
    expect(isThin(thin)).toBe(true);
    expect(isThin(real)).toBe(false);
    expect(isThin(traffic)).toBe(false);
    expect(sortForSpec([thin, real, big, traffic], spec({ sort: "price" })).map((s) => s.domain)).toEqual(["tr.com", "big.com", "real.com", "thin.com"]);
  });

  it("recognises blog-hosting subdomains", () => {
    expect(isHostedSubdomain("improvementhub.home.blog")).toBe(true);
    expect(isHostedSubdomain("foo.wordpress.com")).toBe(true);
    expect(isHostedSubdomain("wordpress.com")).toBe(false);
    expect(isHostedSubdomain("hometalk.com")).toBe(false);
  });
});

describe("language is a filter only when the customer named one", () => {
  it("drops an inferred language and keeps an explicit one", () => {
    expect(parseSearchSpec({ topic: "finance", language: "en", languageExplicit: false })?.language).toBeNull();
    expect(parseSearchSpec({ topic: "finance", language: "de", languageExplicit: true })?.language).toBe("de");
    // A spec from the client's state carries no flag and keeps its language.
    expect(parseSearchSpec({ topic: "finance", language: "de" })?.language).toBe("de");
  });
});

describe("cleanAbout", () => {
  it("drops the page-title prefix and collapses whitespace", () => {
    expect(cleanAbout("Page Title: SecureBlitz Cybersecurity. SecureBlitz is a blog.")).toBe("SecureBlitz is a blog.");
    expect(cleanAbout("Page Title: Cyber Kendra.\n\nCyber Kendra is a digital platform.")).toBe("Cyber Kendra is a digital platform.");
    expect(cleanAbout("Page Title: TechGroup21.com. TechGroup21.com is a technology site.")).toBe("TechGroup21.com is a technology site.");
    expect(cleanAbout("Page Title: Hacker9 | CyberSecurity, Hacking Tools\nHacker9 is a blog.")).toBe("Hacker9 is a blog.");
    expect(cleanAbout("Plain description.")).toBe("Plain description.");
    expect(cleanAbout("  ")).toBeNull();
  });
});

describe("displayCountry", () => {
  it("shows codes as names and hides placeholders", () => {
    expect(displayCountry("IN")).toBe("India");
    expect(displayCountry("United States")).toBe("United States");
    expect(displayCountry("unknown")).toBe("");
    expect(displayCountry("--")).toBe("");
    expect(displayCountry(null)).toBe("");
  });
});
