"use client";

import { useEffect, useRef, useState } from "react";
import { planPrice } from "@/lib/pricing/plan-display";
import {
  BATCH_FIELDS, BATCH_RESPONSE_EXAMPLE, COMMON_ERROR_CODES, CURL_EXAMPLE, ERROR_EXAMPLE, JS_EXAMPLE, NICHE_CODES, PRICING_ERROR_CODES, PYTHON_EXAMPLE, REQUEST_EXAMPLE, RESPONSE_EXAMPLE, RESULT_ERROR_CODES, RESULT_FIELDS, SEARCH_CURL_EXAMPLE, SEARCH_ERROR_CODES, SEARCH_FILTERS, SEARCH_JS_EXAMPLE, SEARCH_PYTHON_EXAMPLE, SEARCH_REQUEST_EXAMPLE, SEARCH_RESPONSE_EXAMPLE, SEARCH_RESPONSE_FIELDS,
} from "@/lib/public-api/docs-content";

const NAV: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: "Getting started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "authentication", label: "Authentication" },
      { id: "limits", label: "Quota & Rate Limits" },
      { id: "common-errors", label: "Common Errors" },
    ],
  },
  {
    group: "Pricing API",
    items: [
      { id: "pricing", label: "Endpoint" },
      { id: "pricing-request", label: "Request" },
      { id: "pricing-response", label: "Response" },
      { id: "pricing-errors", label: "Errors" },
      { id: "pricing-examples", label: "Code Examples" },
    ],
  },
  {
    group: "Search API",
    items: [
      { id: "search", label: "Endpoint" },
      { id: "search-request", label: "Request" },
      { id: "search-response", label: "Response" },
      { id: "search-errors", label: "Errors" },
      { id: "search-examples", label: "Code Examples" },
    ],
  },
  {
    group: "Reference",
    items: [{ id: "result", label: "Domain Result" }],
  },
];

const RATE_TIERS = [
  { tier: "Starter", price: planPrice("starter", { period: "/mo" }), monthly: "1,000",  perMin: "10" },
  { tier: "Growth",  price: planPrice("growth",  { period: "/mo" }), monthly: "2,500",  perMin: "20" },
  { tier: "Scale",   price: planPrice("scale",   { period: "/mo" }), monthly: "10,000", perMin: "60" },
];

type Lang = "curl" | "javascript" | "python";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [lang, setLang] = useState<Lang>("curl");
  const [searchLang, setSearchLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // After a sidebar click the clicked link stays highlighted while the page
  // scrolls to it — near the bottom a short section never reaches the top.
  const scrollingToClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the sidebar on the section being read: the last section whose top
  // has passed just below the sticky header.
  useEffect(() => {
    const ids = NAV.flatMap((g) => g.items.map((i) => i.id));
    const onScroll = () => {
      if (scrollingToClick.current) return;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function go(id: string) {
    if (scrollingToClick.current) clearTimeout(scrollingToClick.current);
    scrollingToClick.current = setTimeout(() => (scrollingToClick.current = null), 1200);
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  const codeMap: Record<Lang, string> = { curl: CURL_EXAMPLE, javascript: JS_EXAMPLE, python: PYTHON_EXAMPLE };
  const searchCodeMap: Record<Lang, string> = { curl: SEARCH_CURL_EXAMPLE, javascript: SEARCH_JS_EXAMPLE, python: SEARCH_PYTHON_EXAMPLE };

  return (
    <>
      <style>{`
        .docs-wrap { display: grid; grid-template-columns: 240px 1fr; min-height: calc(100vh - 60px); max-width: 1280px; margin: 0 auto; }
        .docs-sidebar { border-right: 1px solid #e5e7eb; padding: 32px 0; position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; }
        .docs-sidebar-label { font-size: 10px; font-weight: 700; color: #9ca3af; letter-spacing: 0.8px; text-transform: uppercase; padding: 0 24px; margin-bottom: 8px; }
        .docs-sidebar-link { display: block; padding: 8px 24px; font-size: 13.5px; color: #4b5563; text-decoration: none; transition: all 0.1s; cursor: pointer; border-left: 3px solid transparent; }
        .docs-sidebar-link:hover { color: #0052cc; background: #f0f7ff; }
        .docs-sidebar-link.active { color: #0052cc; font-weight: 600; border-left-color: #0052cc; background: #f0f7ff; }
        .docs-content { padding: 48px 56px; max-width: 800px; min-width: 0; }
        .docs-section { margin-bottom: 72px; scroll-margin-top: 80px; }
        .docs-h2 { font-size: 28px; font-weight: 800; color: #111827; margin: 0 0 16px; letter-spacing: -0.5px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; }
        .docs-p { font-size: 14.5px; color: #374151; line-height: 1.8; margin: 0 0 16px; }
        .docs-h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 32px 0 12px; }
        .docs-code-block { background: #0f172a; border-radius: 10px; padding: 20px 24px; position: relative; overflow-x: auto; margin: 16px 0; }
        .docs-code-block pre { margin: 0; font-size: 13px; line-height: 1.7; font-family: "JetBrains Mono", "Fira Mono", monospace; color: #e2e8f0; white-space: pre; }
        .docs-copy-btn { position: absolute; top: 12px; right: 12px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 5px; cursor: pointer; transition: all 0.15s; }
        .docs-copy-btn:hover { background: #334155; color: #e2e8f0; }
        .docs-copy-btn.copied { color: #86efac; border-color: #86efac; }
        .docs-inline-code { background: #f3f4f6; border: 1px solid #e5e7eb; color: #0052cc; font-family: "JetBrains Mono", "Fira Mono", monospace; font-size: 12.5px; padding: 1px 6px; border-radius: 4px; }
        .docs-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13.5px; }
        .docs-table th { text-align: left; padding: 10px 14px; background: #f9fafb; font-weight: 600; color: #374151; border: 1px solid #e5e7eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
        .docs-table td { padding: 12px 14px; border: 1px solid #e5e7eb; color: #374151; vertical-align: top; }
        .docs-table tr:hover td { background: #f9fafb; }
        .docs-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; font-family: monospace; }
        .docs-badge-get { background: #dcfce7; color: #166534; }
        .docs-badge-post { background: #dbeafe; color: #1e40af; }
        .docs-badge-401 { background: #fef2f2; color: #991b1b; }
        .docs-badge-404 { background: #fef3c7; color: #92400e; }
        .docs-badge-429 { background: #fde68a; color: #92400e; }
        .docs-badge-500 { background: #fee2e2; color: #991b1b; }
        .docs-badge-200 { background: #dcfce7; color: #166534; }
        .docs-endpoint-box { background: #f0f7ff; border: 1px solid #cce5ff; border-radius: 10px; padding: 16px 20px; display: flex; align-items: center; gap: 12px; margin: 16px 0; font-family: "JetBrains Mono", monospace; font-size: 14px; color: #0052cc; }
        .docs-lang-tabs { display: flex; gap: 4px; margin-bottom: 0; }
        .docs-lang-tab { padding: 6px 14px; font-size: 12px; font-weight: 600; border-radius: 6px 6px 0 0; cursor: pointer; border: 1px solid #e5e7eb; border-bottom: none; color: #6b7280; background: #f9fafb; transition: all 0.1s; }
        .docs-lang-tab.active { background: #0f172a; color: #e2e8f0; border-color: #0f172a; }
        .docs-callout { background: #f0f7ff; border-left: 4px solid #0052cc; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 16px 0; font-size: 13.5px; color: #1e3a5f; }
        .docs-callout strong { font-weight: 700; }
        .docs-sidebar-label + .docs-sidebar-link { margin-top: 0; }
        .docs-sidebar-group { margin-bottom: 20px; }
        .docs-api-tag { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #0052cc; background: #f0f7ff; border: 1px solid #cce5ff; border-radius: 999px; padding: 3px 10px; margin-bottom: 10px; }
        .docs-part { font-size: 12px; font-weight: 700; color: #9ca3af; letter-spacing: 0.8px; text-transform: uppercase; margin: 0 0 32px; padding-top: 8px; border-top: 3px solid #111827; }
        .docs-api-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
        .docs-api-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; cursor: pointer; transition: border-color 0.1s, background 0.1s; }
        .docs-api-card:hover { border-color: #0052cc; background: #f0f7ff; }
        .docs-api-card-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
        .docs-api-card-path { font-family: "JetBrains Mono", monospace; font-size: 12px; color: #0052cc; margin-bottom: 8px; overflow-wrap: anywhere; }
        .docs-api-card-desc { font-size: 13px; color: #4b5563; line-height: 1.6; }
        @media (max-width: 900px) {
          .docs-wrap { grid-template-columns: 1fr; }
          .docs-table { display: block; overflow-x: auto; }
          .docs-endpoint-box { flex-wrap: wrap; font-size: 13px; overflow-wrap: anywhere; }
          .docs-inline-code { overflow-wrap: anywhere; }
          .docs-sidebar { display: none; }
          .docs-api-cards { grid-template-columns: 1fr; }
          .docs-content { padding: 32px 20px; }
        }
      `}</style>

      <div className="docs-wrap">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          {NAV.map((g) => (
            <div key={g.group} className="docs-sidebar-group">
              <div className="docs-sidebar-label">{g.group}</div>
              {g.items.map((s) => (
                <a key={s.id} className={`docs-sidebar-link${activeSection === s.id ? " active" : ""}`} onClick={() => go(s.id)}>
                  {s.label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <div className="docs-content">

          {/* ─── Getting started ─────────────────────────────────────────── */}

          {/* Overview */}
          <section className="docs-section" id="overview">
            <h2 className="docs-h2">Overview</h2>
            <p className="docs-p">
              The Linkpricer API gives developers programmatic access to domain pricing data aggregated from 50+ link-building marketplaces. For every domain and every niche you get two sets of prices side by side: what the marketplaces charge (<code className="docs-inline-code">marketplace</code> — the low, the mean and the high of the real market) and what Linkpricer charges to place it for you (<code className="docs-inline-code">linkpricer</code> — the same spread, fee included). Marketplace names are never exposed.
            </p>
            <p className="docs-p">There are two APIs. Pick the one that matches what you start with:</p>
            <div className="docs-api-cards">
              <div className="docs-api-card" onClick={() => go("pricing")}>
                <div className="docs-api-card-title">Pricing API</div>
                <div className="docs-api-card-path">POST /v1/public/domains/pricing</div>
                <div className="docs-api-card-desc">You have the domains. Send 1 to 200 and get the prices and metrics for each one.</div>
              </div>
              <div className="docs-api-card" onClick={() => go("search")}>
                <div className="docs-api-card-title">Search API</div>
                <div className="docs-api-card-path">POST /v1/public/domains/search</div>
                <div className="docs-api-card-desc">You have a brief. Send filters such as DR, country, language and price, and get up to 50 matching domains with their prices.</div>
              </div>
            </div>
            <p className="docs-p">
              Both use the same API key and the same monthly quota, and return the same <a href="#result" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>Domain Result</a> for each domain. All responses are JSON.
            </p>
            <div className="docs-callout">
              <strong>Base URL:</strong> <code className="docs-inline-code">https://www.linkpricer.ai/api</code>
            </div>
          </section>

          {/* Authentication */}
          <section className="docs-section" id="authentication">
            <h2 className="docs-h2">Authentication</h2>
            <p className="docs-p">
              Every request must include your API key in the <code className="docs-inline-code">x-api-key</code> header. You can get your key from the <a href="/developers/dashboard" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>developer dashboard</a>.
            </p>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "auth" ? " copied" : ""}`} onClick={() => copy(`x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx`, "auth")}>
                {copied === "auth" ? "Copied!" : "Copy"}
              </button>
              <pre>{`x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx`}</pre>
            </div>
            <p className="docs-p">
              API keys are prefixed with <code className="docs-inline-code">lp_live_</code>. Keep your key secret — do not expose it in client-side code or public repositories. The API is server-to-server only.
            </p>
          </section>

          {/* Quota & rate limits (both APIs) */}
          <section className="docs-section" id="limits">
            <h2 className="docs-h2">Quota &amp; Rate Limits</h2>
            <p className="docs-p">
              Each plan includes a monthly quota of <strong>lookups</strong> and a per-minute burst limit, shared by both APIs. Those are the only two limits — there is no daily cap. Quotas reset on the 1st of each calendar month, 00:00 UTC.
            </p>
            <table className="docs-table">
              <thead>
                <tr><th>Plan</th><th>Price</th><th>Monthly quota</th><th>Per-minute limit</th></tr>
              </thead>
              <tbody>
                {RATE_TIERS.map((r) => (
                  <tr key={r.tier}>
                    <td style={{ fontWeight: 600 }}>{r.tier}</td>
                    <td>{r.price}</td>
                    <td>{r.monthly} lookups</td>
                    <td>{r.perMin} req/min</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="docs-table">
              <thead>
                <tr><th>API</th><th>One lookup is</th><th>Not charged</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Pricing</td>
                  <td>One distinct domain you sent that is in our catalog — including one with no offers for the niche you filtered to (<code className="docs-inline-code">data.found: false</code>).</td>
                  <td>Domains not in our catalog, malformed entries, duplicates.</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Search</td>
                  <td>One domain returned.</td>
                  <td>A search that matches nothing.</td>
                </tr>
              </tbody>
            </table>
            <p className="docs-p">
              A request must fit your remaining quota as a whole. Pricing reserves its distinct valid domains when the request arrives; Search reserves its <code className="docs-inline-code">limit</code>. What goes unused is handed back when the request completes. If the reservation does not fit, the request is refused with <code className="docs-inline-code">429 quota_exceeded</code> and nothing is charged. A request rejected outright (400, 413, 422) or failing on our side (500, 503) costs nothing.
            </p>
            <p className="docs-p">
              The per-minute limit counts requests, not domains, and rejected requests (400, 413, 422) count toward it too. Both limits return <code className="docs-inline-code">429</code> with a <code className="docs-inline-code">Retry-After</code> header: about a minute for a burst (<code className="docs-inline-code">rate_limit_exceeded</code>), or the time until the 1st for a spent quota (<code className="docs-inline-code">quota_exceeded</code>).
            </p>
            <p className="docs-p">
              Every response to a request with a usable key, errors included, carries <code className="docs-inline-code">X-RateLimit-Limit</code>, <code className="docs-inline-code">X-RateLimit-Remaining</code> and <code className="docs-inline-code">X-RateLimit-Reset</code> (the monthly quota, after this request), <code className="docs-inline-code">X-RateLimit-Limit-Minute</code> and <code className="docs-inline-code">X-RateLimit-Remaining-Minute</code> for the burst limit, and <code className="docs-inline-code">X-Lookups-Charged</code>. A <code className="docs-inline-code">401</code> has no key to report on, so it carries none of them.
            </p>
          </section>

          {/* Common errors (both APIs) */}
          <section className="docs-section" id="common-errors">
            <h2 className="docs-h2">Common Errors</h2>
            <p className="docs-p">A request refused as a whole returns this shape, from either API. Each API&apos;s own errors are listed in its section.</p>
            <div className="docs-code-block">
              <pre>{ERROR_EXAMPLE}</pre>
            </div>
            <table className="docs-table">
              <thead>
                <tr><th>Status</th><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {COMMON_ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td><span className={`docs-badge docs-badge-${e.code === "401" || e.code === "500" || e.code === "503" ? "401" : e.code === "429" ? "429" : "404"}`}>{e.code}</span></td>
                    <td><code className="docs-inline-code">{e.name}</code></td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ─── Pricing API ─────────────────────────────────────────────── */}
          <div className="docs-part">Pricing API</div>

          {/* Pricing: endpoint */}
          <section className="docs-section" id="pricing">
            <div className="docs-api-tag">Pricing API</div>
            <h2 className="docs-h2">Price a list of domains</h2>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-post">POST</span>
              <span>/api/v1/public/domains/pricing</span>
            </div>
            <p className="docs-p">
              Use this when you already have the domains. It prices up to <strong>200 domains in one request</strong> — the same limit as the Linkpricer dashboard&apos;s Analyze page — in about a second. To price a single domain, send a list of one. Each domain found comes back with its full <a href="#result" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>Domain Result</a>: every niche&apos;s marketplace and Linkpricer prices, plus domain rating, traffic, referring domains and country.
            </p>
          </section>

          {/* Pricing: request */}
          <section className="docs-section" id="pricing-request">
            <h2 className="docs-h2">Pricing request</h2>
            <h3 className="docs-h3">Headers</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Header</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">x-api-key</code></td>
                  <td>Yes</td>
                  <td>Your Linkpricer API key.</td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">Content-Type</code></td>
                  <td>Yes</td>
                  <td><code className="docs-inline-code">application/json</code></td>
                </tr>
              </tbody>
            </table>

            <h3 className="docs-h3">Body</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">domains</code></td>
                  <td>string[]</td>
                  <td>Yes</td>
                  <td>
                    1 to 200 entries. Pasted URLs are fine: the protocol, a leading <code className="docs-inline-code">www.</code> and any path, query or fragment are stripped, so <code className="docs-inline-code">https://www.example.com/blog?x=1</code> is looked up as <code className="docs-inline-code">example.com</code>. Duplicates are allowed; each gets its own result but is looked up and charged once. The 200 limit counts entries as sent, before duplicates are removed.
                  </td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">niche</code></td>
                  <td>string</td>
                  <td>No</td>
                  <td>
                    Restrict every result to a single niche&apos;s pricing instead of all niches. One of{" "}
                    {NICHE_CODES.map((n, i) => (
                      <span key={n}><code className="docs-inline-code">{n}</code>{i < NICHE_CODES.length - 1 ? ", " : ""}</span>
                    ))}
                    . Omitted, null or blank means every niche.
                    <br />
                    <br />
                    These are the same nine niches the Linkpricer dashboard prices, and the
                    dashboard&apos;s own labels are accepted as synonyms so you can pass whichever you
                    have to hand: <code className="docs-inline-code">general</code> and{" "}
                    <code className="docs-inline-code">base</code> →{" "}
                    <code className="docs-inline-code">standard</code>,{" "}
                    <code className="docs-inline-code">igaming</code> →{" "}
                    <code className="docs-inline-code">gambling</code>,{" "}
                    <code className="docs-inline-code">loans</code> →{" "}
                    <code className="docs-inline-code">loan</code>,{" "}
                    <code className="docs-inline-code">forex</code> →{" "}
                    <code className="docs-inline-code">trading_forex</code>,{" "}
                    <code className="docs-inline-code">insertion</code> →{" "}
                    <code className="docs-inline-code">link_insertion</code>.
                    <br />
                    <br />
                    A niche only appears in a result when at least one source actually prices
                    that niche for that domain. An offer with no price set for a niche is left out
                    of it entirely rather than falling back to its base rate — so a{" "}
                    <code className="docs-inline-code">gambling</code> figure is always a real
                    gambling price, never a standard one relabelled.
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "req" ? " copied" : ""}`} onClick={() => copy(REQUEST_EXAMPLE, "req")}>
                {copied === "req" ? "Copied!" : "Copy"}
              </button>
              <pre>{REQUEST_EXAMPLE}</pre>
            </div>
          </section>

          {/* Pricing: response */}
          <section className="docs-section" id="pricing-response">
            <h2 className="docs-h2">Pricing response</h2>
            <p className="docs-p">
              HTTP <code className="docs-inline-code">200</code> whenever at least one entry was a valid domain — even if some were not found or malformed. <code className="docs-inline-code">results[i]</code> always answers <code className="docs-inline-code">domains[i]</code>, in the order you sent them.
            </p>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "batch-resp" ? " copied" : ""}`} onClick={() => copy(BATCH_RESPONSE_EXAMPLE, "batch-resp")}>
                {copied === "batch-resp" ? "Copied!" : "Copy"}
              </button>
              <pre>{BATCH_RESPONSE_EXAMPLE}</pre>
            </div>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {BATCH_FIELDS.map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Pricing: errors */}
          <section className="docs-section" id="pricing-errors">
            <h2 className="docs-h2">Pricing errors</h2>
            <p className="docs-p">On top of the <a href="#common-errors" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>common errors</a>, the whole request is refused for these. None of them is charged.</p>
            <table className="docs-table">
              <thead>
                <tr><th>Status</th><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {PRICING_ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td><span className={`docs-badge docs-badge-${e.code === "401" || e.code === "500" || e.code === "503" ? "401" : e.code === "429" ? "429" : "404"}`}>{e.code}</span></td>
                    <td><code className="docs-inline-code">{e.name}</code></td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="docs-h3">Per-domain errors</h3>
            <p className="docs-p">Inside a <code className="docs-inline-code">200</code> response, a domain that could not be priced carries its own <code className="docs-inline-code">results[].error</code>; the rest of the request is unaffected.</p>
            <table className="docs-table">
              <thead>
                <tr><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {RESULT_ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td><code className="docs-inline-code">{e.name}</code></td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Pricing: examples */}
          <section className="docs-section" id="pricing-examples">
            <h2 className="docs-h2">Pricing code examples</h2>
            <div className="docs-lang-tabs">
              {(["curl", "javascript", "python"] as Lang[]).map((l) => (
                <div key={l} className={`docs-lang-tab${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>
                  {l === "curl" ? "cURL" : l === "javascript" ? "JavaScript" : "Python"}
                </div>
              ))}
            </div>
            <div className="docs-code-block" style={{ borderRadius: "0 10px 10px 10px" }}>
              <button className={`docs-copy-btn${copied === "example" ? " copied" : ""}`} onClick={() => copy(codeMap[lang], "example")}>
                {copied === "example" ? "Copied!" : "Copy"}
              </button>
              <pre>{codeMap[lang]}</pre>
            </div>
          </section>

          {/* ─── Search API ──────────────────────────────────────────────── */}
          <div className="docs-part">Search API</div>

          {/* Search: endpoint */}
          <section className="docs-section" id="search">
            <div className="docs-api-tag">Search API</div>
            <h2 className="docs-h2">Find domains by filters</h2>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-post">POST</span>
              <span>/api/v1/public/domains/search</span>
            </div>
            <p className="docs-p">
              Use this when you do not have a list of domains — only what you are looking for. Send filters and get back up to <strong>50 matching domains</strong>, each with the same pricing body the pricing endpoint returns (see <a href="#result" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>Domain Result</a>). Same API key and same monthly quota as the Pricing API. A search usually takes 2 to 6 seconds.
            </p>

            <div className="docs-callout">
              <strong>Charged per domain returned.</strong> A search reserves its <code className="docs-inline-code">limit</code> (50 unless you set it) when it arrives and hands back whatever it did not use, so a search that returns 12 domains costs 12 lookups and one that returns none costs nothing. If fewer lookups remain than the limit, it is refused with <code className="docs-inline-code">429 quota_exceeded</code> and the message tells you what <code className="docs-inline-code">limit</code> would fit.
            </div>
          </section>

          {/* Search: request */}
          <section className="docs-section" id="search-request">
            <h2 className="docs-h2">Search request</h2>
            <p className="docs-p">Headers are the same as for every request: <code className="docs-inline-code">x-api-key</code> and <code className="docs-inline-code">Content-Type: application/json</code>.</p>
            <h3 className="docs-h3">Body</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">filters</code></td>
                  <td>object</td>
                  <td>Yes</td>
                  <td>At least one of the filters below. Every filter you set must match. A misspelled or unsupported filter is refused, never silently ignored.</td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">niche</code></td>
                  <td>string</td>
                  <td>No</td>
                  <td>Same values as the pricing endpoint. Only sites priced for this niche are returned, the price filter and price sort use this niche&apos;s price, and each result carries this niche only. Omitted means the <code className="docs-inline-code">standard</code> price is used for filtering and sorting, and each result carries every niche the site is priced for.</td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">sort</code></td>
                  <td>string</td>
                  <td>No</td>
                  <td><code className="docs-inline-code">dr</code> (default), <code className="docs-inline-code">traffic</code>, <code className="docs-inline-code">ref_domains</code> or <code className="docs-inline-code">price</code>.</td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">order</code></td>
                  <td>string</td>
                  <td>No</td>
                  <td><code className="docs-inline-code">asc</code> or <code className="docs-inline-code">desc</code>. Defaults to cheapest first for <code className="docs-inline-code">price</code> and highest first for the others. Sites with no value for the sort field always come last.</td>
                </tr>
                <tr>
                  <td><code className="docs-inline-code">limit</code></td>
                  <td>number</td>
                  <td>No</td>
                  <td>1 to 50. Default 50. Also the most lookups this request can cost.</td>
                </tr>
              </tbody>
            </table>

            <h3 className="docs-h3">Filters</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Filter</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {SEARCH_FILTERS.map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="docs-callout">
              <strong>A filter only matches sites where we know the value.</strong> We do not hold organic traffic or referring domains for every site (those are <code className="docs-inline-code">null</code> in the result), so setting <code className="docs-inline-code">min_traffic</code>, <code className="docs-inline-code">max_traffic</code> or a referring-domains filter leaves out every site with no figure on record — including with a <code className="docs-inline-code">max_</code> filter. Domain Rating is known for most of the catalog. If a traffic filter returns fewer sites than you expected, try the search without it.
            </div>

            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "search-req" ? " copied" : ""}`} onClick={() => copy(SEARCH_REQUEST_EXAMPLE, "search-req")}>
                {copied === "search-req" ? "Copied!" : "Copy"}
              </button>
              <pre>{SEARCH_REQUEST_EXAMPLE}</pre>
            </div>

          </section>

          {/* Search: response */}
          <section className="docs-section" id="search-response">
            <h2 className="docs-h2">Search response</h2>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "search-resp" ? " copied" : ""}`} onClick={() => copy(SEARCH_RESPONSE_EXAMPLE, "search-resp")}>
                {copied === "search-resp" ? "Copied!" : "Copy"}
              </button>
              <pre>{SEARCH_RESPONSE_EXAMPLE}</pre>
            </div>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {SEARCH_RESPONSE_FIELDS.map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="docs-p">
              A search that matches nothing is still a <code className="docs-inline-code">200</code>, with an empty <code className="docs-inline-code">results</code> array and nothing charged.
            </p>

          </section>

          {/* Search: errors */}
          <section className="docs-section" id="search-errors">
            <h2 className="docs-h2">Search errors</h2>
            <p className="docs-p">On top of the <a href="#common-errors" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>common errors</a>, the search is refused for these. None of them is charged.</p>
            <table className="docs-table">
              <thead>
                <tr><th>Status</th><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {SEARCH_ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td><span className={`docs-badge docs-badge-${"404"}`}>{e.code}</span></td>
                    <td><code className="docs-inline-code">{e.name}</code></td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Search: examples */}
          <section className="docs-section" id="search-examples">
            <h2 className="docs-h2">Search code examples</h2>
            <div className="docs-lang-tabs">
              {(["curl", "javascript", "python"] as Lang[]).map((l) => (
                <div key={l} className={`docs-lang-tab${searchLang === l ? " active" : ""}`} onClick={() => setSearchLang(l)}>
                  {l === "curl" ? "cURL" : l === "javascript" ? "JavaScript" : "Python"}
                </div>
              ))}
            </div>
            <div className="docs-code-block" style={{ borderRadius: "0 10px 10px 10px" }}>
              <button className={`docs-copy-btn${copied === "search-example" ? " copied" : ""}`} onClick={() => copy(searchCodeMap[searchLang], "search-example")}>
                {copied === "search-example" ? "Copied!" : "Copy"}
              </button>
              <pre>{searchCodeMap[searchLang]}</pre>
            </div>
          </section>

          {/* ─── Reference ───────────────────────────────────────────────── */}
          <div className="docs-part">Reference</div>

          {/* Domain result */}
          <section className="docs-section" id="result">
            <h2 className="docs-h2">Domain result</h2>
            <p className="docs-p">
              Both APIs return the same object for each domain, in <code className="docs-inline-code">results[].data</code>: the Pricing API for every entry with status <code className="docs-inline-code">ok</code>, the Search API for every result. A domain found by Search prices to exactly the same figures when you send it to Pricing.
            </p>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "resp" ? " copied" : ""}`} onClick={() => copy(RESPONSE_EXAMPLE, "resp")}>
                {copied === "resp" ? "Copied!" : "Copy"}
              </button>
              <pre>{RESPONSE_EXAMPLE}</pre>
            </div>

            <div className="docs-callout">
              <strong>Every price lives in one of two objects.</strong>
              <table className="docs-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr><th>Object</th><th>Fee</th><th>Means</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code className="docs-inline-code">marketplace</code></td>
                    <td>excluded</td>
                    <td>What the sources charge. The real market spread: <code className="docs-inline-code">lowest</code>, <code className="docs-inline-code">average</code>, <code className="docs-inline-code">highest</code>.</td>
                  </tr>
                  <tr>
                    <td><code className="docs-inline-code">linkpricer</code></td>
                    <td>included</td>
                    <td>What you pay us. Same spread plus <code className="docs-inline-code">recommended</code> (our vetted source). <code className="docs-inline-code">linkpricer.lowest</code> is the headline price.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="docs-h3">Marketplace prices vs. your price</h3>
            <p className="docs-p">
              Every price sits in one of two objects, and which object it is in tells you what it means.{" "}
              <code className="docs-inline-code">marketplace</code> holds <strong>marketplace prices</strong> — what the sources
              themselves charge, with no Linkpricer fee.{" "}
              <code className="docs-inline-code">linkpricer</code> holds <strong>your price</strong> — what you pay us to place
              the link, fee included. Nothing else in the response is money.
            </p>
            <p className="docs-p">
              The fee is the larger of two things: <code className="docs-inline-code">fee.percent</code> (currently 15%) of the
              source price, or <code className="docs-inline-code">fee.minimum_usd</code> (currently €25, converted). Handling a
              placement costs us the same whether it sells for $5 or $500, so below roughly $190 of source price the minimum is
              what applies and the effective markup is higher than 15% — a $20 source price becomes $49, not $23. Above that,
              the percentage is the larger number and nothing else enters into it. Prices are rounded to whole dollars, except
              the averages.
            </p>
            <p className="docs-p">
              The minimum is set in euros, so <code className="docs-inline-code">fee.minimum_usd</code> moves with the exchange
              rate and the crossover point moves slightly with it. Read the fee from the response rather than hardcoding either
              figure: every number under <code className="docs-inline-code">linkpricer</code> is computed as{" "}
              <code className="docs-inline-code">
                price + max(price × fee.percent ÷ 100, fee.minimum_usd)
              </code>
              , so you can always reproduce it exactly.
            </p>
            <p className="docs-p">
              <code className="docs-inline-code">linkpricer.average</code> is the mean of your price at each source computed
              individually, <em>not</em> <code className="docs-inline-code">marketplace.average</code> plus the fee. The two
              differ whenever any source falls below the crossover, because the minimum fee is not proportional — averaging
              first would understate what the placements actually cost.
            </p>

            <h3 className="docs-h3">Response fields</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {RESULT_FIELDS.map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </div>
      </div>
    </>
  );
}
