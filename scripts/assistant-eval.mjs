// Live evaluation of the homepage assistant (app/api/assistant/chat).
//
// Runs a battery of conversations against a running server, records what
// each turn understood, retrieved and answered, checks the hard constraints
// the user stated (budget, DR, traffic, country, dofollow, count) against
// the sites actually shown, and writes a report.
//
//   node scripts/assistant-eval.mjs [--base http://localhost:3100] [--only name] [--out dir]
//
// Each scenario is a list of messages sent in order with the state carried
// between them, exactly as the page does it.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = opt("--base", "http://localhost:3100");
const ONLY = opt("--only", null);
const OUT = opt("--out", "scripts/assistant-eval-out");

// expect: what must hold for the primary (ordered) sites of the final turn.
const SCENARIOS = [
  {
    name: "vpn-prose-budget",
    messages: ["I sell a VPN for small businesses. Get me guest posts on tech and cybersecurity sites, budget around $300 per link"],
    expect: { intent: "search", maxPrice: 300, topicWords: ["cyber", "vpn", "secur", "tech"] },
  },
  {
    name: "vpn-then-refine-then-pick",
    messages: [
      "I sell a VPN for small businesses. Get me guest posts on tech and cybersecurity sites, budget around $300 per link",
      "Only cybersecurity sites with DR 50 or more and under $150",
      "Which 3 would you pick and why?",
    ],
    expect: { intent: "refine", maxPrice: 150, minDr: 50, count: 3 },
  },
  { name: "vague", messages: ["I need backlinks"], expect: { intent: "clarify" } },
  { name: "vague-then-answer", messages: ["I need backlinks", "yoga and meditation, around $100"], expect: { intent: "search", maxPrice: 100, topicWords: ["yoga", "medit"] } },
  { name: "offtopic", messages: ["what is 2+2"], expect: { intent: "offtopic" } },
  { name: "chat-fees", messages: ["how do you charge, what is the fee?"], expect: { intent: "chat", replyWords: ["15", "25"] } },
  { name: "chip-tech-under-200", messages: ["Tech blogs under $200 with DR 40+"], expect: { intent: "search", maxPrice: 200, minDr: 40 } },
  { name: "igaming-uk", messages: ["iGaming sites in the UK"], expect: { intent: "search", niche: "gambling", countries: ["GB"] } },
  { name: "german-finance-dofollow", messages: ["German finance sites, dofollow only"], expect: { intent: "search", language: "de", dofollow: true } },
  { name: "cheapest-saas", messages: ["10 cheapest SaaS and software sites with real traffic"], expect: { intent: "search", sort: "price", count: 10, minTraffic: 1000 } },
  { name: "top-dr-crypto", messages: ["5 highest DR crypto sites, any price"], expect: { intent: "search", niche: "crypto", sort: "dr", count: 5 } },
  { name: "domain-lookup", messages: ["what does itsecurityguru.org cost and is it dofollow?"], expect: { intent: "domain_lookup", domains: ["itsecurityguru.org"] } },
  { name: "domain-lookup-missing", messages: ["do you have vpnunlimited.com?"], expect: { intent: "domain_lookup" } },
  { name: "spanish", messages: ["Busco blogs de viajes en España, presupuesto 150 dólares"], expect: { intent: "search", maxPrice: 150, countries: ["ES"], topicWords: ["travel"] } },
  { name: "french-tld", messages: ["sites .fr about cuisine et gastronomie"], expect: { intent: "search", tlds: ["fr"] } },
  { name: "traffic-health-us", messages: ["US health and wellness sites with at least 10k monthly traffic, DR 30-60"], expect: { intent: "search", minTraffic: 10000, minDr: 30, maxDr: 60, countries: ["US"] } },
  { name: "niche-edit", messages: ["link insertions on existing articles about home improvement, cheap"], expect: { intent: "search", linkType: "link_insertion", sort: "price" } },
  { name: "euro-budget", messages: ["Reise-Blogs aus Deutschland, Budget 200 Euro"], expect: { intent: "search", countries: ["DE"], maxPrice: [200, 240] } },
  { name: "add-to-cart-flow", messages: ["Tech blogs under $200 with DR 40+", "add the top 2 to my cart"], expect: { intent: "add_to_cart", cartCount: 2 } },
  { name: "remove-constraint", messages: ["finance sites under $100", "forget the budget, show me the strongest ones"], expect: { intent: "refine", maxPrice: null, sort: "dr" } },
  { name: "nothing-matches", messages: ["sites about underwater basket weaving in Iceland under $20"], expect: { intent: "search" } },
  { name: "business-described", messages: ["We're a Shopify app for abandoned cart recovery. Where should we get links?"], expect: { intent: "search", topicWords: ["ecommerce", "shopify", "commerce", "marketing"] } },
  { name: "pigeon-saas-listicles", messages: ["Get into SaaS + tech listicles"], expect: { intent: "search" } },
  { name: "pigeon-legal", messages: ["Rank for legal & attorney keywords"], expect: { intent: "search", topicWords: ["legal", "law", "attorney"] } },
  { name: "pigeon-high-end-news", messages: ["Get quoted in high-end news"], expect: { intent: "search" } },
];

async function sendTurn(message, state) {
  const t0 = Date.now();
  // The bypass header is honoured outside production only (see the route).
  const res = await fetch(`${BASE}/api/assistant/chat`, { method: "POST", headers: { "Content-Type": "application/json", "x-eval-bypass": "1" }, body: JSON.stringify({ message, state }) });
  if (!res.ok) return { error: `HTTP ${res.status}`, ms: Date.now() - t0, events: [] };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const events = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) events.push({ at: Date.now() - t0, ev: JSON.parse(line) });
    }
  }
  return { ms: Date.now() - t0, events };
}

function summarizeTurn(turn) {
  const by = (t) => turn.events.find((e) => e.ev.type === t);
  const understood = by("understood")?.ev;
  const results = by("results")?.ev;
  const answer = by("answer")?.ev;
  const message = by("message")?.ev;
  const action = by("action")?.ev;
  const error = by("error")?.ev;
  const intent = understood?.intent ?? (message ? "message" : action ? "add_to_cart" : error ? "error" : "?");
  const sitesByDomain = new Map((results?.sites ?? []).map((s) => [s.domain, s]));
  const primary = answer ? answer.order.map((d) => sitesByDomain.get(d)).filter(Boolean) : [];
  return {
    intent,
    spec: understood?.spec ?? null,
    filters: understood?.filters ?? [],
    tUnderstood: by("understood")?.at ?? by("message")?.at ?? by("action")?.at ?? null,
    tResults: by("results")?.at ?? null,
    tAnswer: by("answer")?.at ?? by("message")?.at ?? by("action")?.at ?? null,
    total: turn.ms,
    candidates: results?.sites?.length ?? 0,
    lowRelevance: results?.lowRelevance ?? null,
    primary: primary.map((s) => ({ domain: s.domain, dr: s.dr, traffic: s.traffic, country: s.country, lang: s.lang, price: s.ourPrice, dofollow: s.dofollow, offers: s.offerCount, hasAbout: !!s.about, reason: answer?.reasons?.[s.domain] ?? "" })),
    summary: answer?.summary ?? message?.text ?? action?.text ?? error?.message ?? "",
    chips: answer?.chips ?? message?.chips ?? [],
    cartSites: action?.sites?.map((s) => s.domain) ?? null,
    state: answer?.state ?? message?.state ?? action?.state ?? null,
  };
}

function check(scn, last, turns) {
  const problems = [];
  const e = scn.expect;
  const spec = last.spec ?? last.state?.search ?? null;
  const intentOk = e.intent ? (e.intent === "chat" || e.intent === "clarify" || e.intent === "offtopic" ? last.intent === "message" || last.intent === e.intent : last.intent === e.intent) : true;
  if (!intentOk) problems.push(`intent ${last.intent} (wanted ${e.intent})`);
  if (e.intent === "clarify" && !/\?/.test(last.summary)) problems.push("clarify reply has no question");
  if (e.replyWords) for (const w of e.replyWords) if (!last.summary.includes(w)) problems.push(`reply lacks "${w}"`);
  if (e.topicWords && spec) {
    const t = spec.topic.toLowerCase();
    if (!e.topicWords.some((w) => t.includes(w))) problems.push(`topic "${spec.topic}" has none of ${e.topicWords.join("/")}`);
  }
  const num = (k) => (spec ? spec[k] : undefined);
  if (e.maxPrice !== undefined) {
    if (e.maxPrice === null) { if (num("maxPrice") != null) problems.push(`maxPrice still ${num("maxPrice")}`); }
    else if (Array.isArray(e.maxPrice)) { if (!(num("maxPrice") >= e.maxPrice[0] && num("maxPrice") <= e.maxPrice[1])) problems.push(`maxPrice ${num("maxPrice")} not in ${e.maxPrice}`); }
    else if (num("maxPrice") !== e.maxPrice) problems.push(`maxPrice ${num("maxPrice")} (wanted ${e.maxPrice})`);
  }
  for (const k of ["minDr", "maxDr", "minTraffic", "count"]) if (e[k] !== undefined && num(k) !== e[k]) problems.push(`${k} ${num(k)} (wanted ${e[k]})`);
  if (e.sort && num("sort") !== e.sort) problems.push(`sort ${num("sort")} (wanted ${e.sort})`);
  if (e.niche && num("niche") !== e.niche) problems.push(`niche ${num("niche")} (wanted ${e.niche})`);
  if (e.linkType && num("linkType") !== e.linkType) problems.push(`linkType ${num("linkType")} (wanted ${e.linkType})`);
  if (e.language && num("language") !== e.language) problems.push(`language ${num("language")} (wanted ${e.language})`);
  if (e.dofollow && !spec?.dofollowOnly) problems.push("dofollowOnly not set");
  if (e.countries && JSON.stringify(spec?.countries) !== JSON.stringify(e.countries)) problems.push(`countries ${JSON.stringify(spec?.countries)} (wanted ${JSON.stringify(e.countries)})`);
  if (e.tlds && JSON.stringify(spec?.tlds) !== JSON.stringify(e.tlds)) problems.push(`tlds ${JSON.stringify(spec?.tlds)}`);
  if (e.domains && last.primary.length && !e.domains.every((d) => last.primary.some((p) => p.domain === d))) problems.push(`lookup missing ${e.domains}`);
  if (e.cartCount != null && (last.cartSites?.length ?? 0) !== e.cartCount) problems.push(`cart has ${last.cartSites?.length ?? 0} (wanted ${e.cartCount})`);
  // Hard constraints against what is shown.
  if (spec && last.primary.length) {
    for (const p of last.primary) {
      if (spec.maxPrice != null && (p.price == null || p.price > spec.maxPrice)) problems.push(`${p.domain} $${p.price} over budget ${spec.maxPrice}`);
      if (spec.minDr != null && p.dr < spec.minDr) problems.push(`${p.domain} DR ${p.dr} < ${spec.minDr}`);
      if (spec.maxDr != null && p.dr > spec.maxDr) problems.push(`${p.domain} DR ${p.dr} > ${spec.maxDr}`);
      if (spec.minTraffic != null && p.traffic < spec.minTraffic) problems.push(`${p.domain} traffic ${p.traffic} < ${spec.minTraffic}`);
      if (spec.dofollowOnly && !p.dofollow) problems.push(`${p.domain} not dofollow`);
    }
    if (spec.count != null && last.primary.length > spec.count) problems.push(`showed ${last.primary.length} > count ${spec.count}`);
    const withoutReason = last.primary.filter((p) => !p.reason).length;
    if (withoutReason) problems.push(`${withoutReason} sites without a reason`);
    const zeroTraffic = last.primary.filter((p) => p.traffic === 0).length;
    // A "cheapest first" list is allowed to be mostly thin, as long as a
    // real site with traffic made the top three.
    if (spec.sort === "price") {
      if (!last.primary.slice(0, 3).some((p) => p.traffic > 0)) problems.push("no site with traffic in the top 3 of a cheapest-first list");
    } else if (zeroTraffic > last.primary.length / 2) problems.push(`${zeroTraffic}/${last.primary.length} shown sites have no traffic`);
  }
  if (last.intent === "search" && last.primary.length === 0 && !/couldn|no |not /i.test(last.summary)) problems.push("no sites and the summary does not say so");
  if (turns.some((t) => t.intent === "error")) problems.push("a turn errored");
  return problems;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const report = [];
  const md = [`# Assistant eval ${stamp}`, "", `Base: ${BASE}`, ""];
  for (const scn of SCENARIOS) {
    if (ONLY && !ONLY.split(",").includes(scn.name)) continue;
    let state = null;
    const turns = [];
    for (const m of scn.messages) {
      const raw = await sendTurn(m, state);
      const t = raw.error ? { intent: "error", summary: raw.error, primary: [], total: raw.ms, state } : summarizeTurn(raw);
      t.message = m;
      turns.push(t);
      state = t.state ?? state;
    }
    const last = turns[turns.length - 1];
    const problems = check(scn, last, turns);
    report.push({ name: scn.name, turns, problems });
    const ok = problems.length === 0;
    console.log(`${ok ? "PASS" : "FAIL"} ${scn.name.padEnd(28)} ${String(last.total).padStart(6)}ms  ${last.intent.padEnd(14)} ${last.primary.length} shown  ${problems.join("; ")}`);
    md.push(`## ${ok ? "✅" : "❌"} ${scn.name}`, "");
    for (const t of turns) {
      md.push(`**User:** ${t.message}`, "");
      md.push(`- intent: \`${t.intent}\` · understood ${t.tUnderstood ?? "-"}ms · results ${t.tResults ?? "-"}ms · answer ${t.tAnswer ?? "-"}ms · total ${t.total}ms · candidates ${t.candidates ?? 0}${t.lowRelevance ? " · LOW RELEVANCE" : ""}`);
      if (t.filters?.length) md.push(`- filters: ${t.filters.map((f) => `\`${f}\``).join(" ")}`);
      md.push(`- **Assistant:** ${t.summary}`);
      if (t.primary?.length) {
        md.push("", "| # | domain | DR | traffic | country | price | dofollow | offers | reason |", "|---|---|---|---|---|---|---|---|---|");
        t.primary.forEach((p, i) => md.push(`| ${i + 1} | ${p.domain} | ${p.dr} | ${p.traffic} | ${p.country} | ${p.price != null ? `$${p.price}` : "-"} | ${p.dofollow ? "yes" : "no"} | ${p.offers} | ${p.reason.replace(/\|/g, "/")} |`));
      }
      if (t.cartSites?.length) md.push(`- cart: ${t.cartSites.join(", ")}`);
      if (t.chips?.length) md.push(`- chips: ${t.chips.map((c) => `\`${c}\``).join(" ")}`);
      md.push("");
    }
    if (problems.length) md.push(`**Problems:** ${problems.join("; ")}`, "");
  }
  const passed = report.filter((r) => r.problems.length === 0).length;
  const line = `${passed}/${report.length} scenarios passed`;
  console.log(line);
  md.splice(3, 0, `**${line}**`, "");
  fs.writeFileSync(path.join(OUT, `eval-${stamp}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, `eval-${stamp}.md`), md.join("\n"));
  console.log(`report: ${path.join(OUT, `eval-${stamp}.md`)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
