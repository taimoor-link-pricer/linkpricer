"use client";

import { useState } from "react";
import { planPrice } from "@/lib/pricing/plan-display";
import {
  ERROR_CODES, RESULT_ERROR_CODES, REQUEST_EXAMPLE, BATCH_RESPONSE_EXAMPLE, CURL_EXAMPLE, JS_EXAMPLE,
  PYTHON_EXAMPLE, RESPONSE_EXAMPLE, ERROR_EXAMPLE, NICHE_CODES, BATCH_FIELDS, RESULT_FIELDS,
} from "@/lib/public-api/docs-content";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoint", label: "Endpoint" },
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "result", label: "Domain Result" },
  { id: "metering", label: "Metering" },
  { id: "errors", label: "Errors" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "examples", label: "Code Examples" },
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
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const codeMap: Record<Lang, string> = { curl: CURL_EXAMPLE, javascript: JS_EXAMPLE, python: PYTHON_EXAMPLE };

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
        @media (max-width: 900px) {
          .docs-wrap { grid-template-columns: 1fr; }
          .docs-table { display: block; overflow-x: auto; }
          .docs-endpoint-box { flex-wrap: wrap; font-size: 13px; overflow-wrap: anywhere; }
          .docs-inline-code { overflow-wrap: anywhere; }
          .docs-sidebar { display: none; }
          .docs-content { padding: 32px 20px; }
        }
      `}</style>

      <div className="docs-wrap">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-label">Reference</div>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              className={`docs-sidebar-link${activeSection === s.id ? " active" : ""}`}
              onClick={() => {
                setActiveSection(s.id);
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {s.label}
            </a>
          ))}
        </aside>

        {/* Main content */}
        <div className="docs-content">

          {/* Overview */}
          <section className="docs-section" id="overview">
            <h2 className="docs-h2">Overview</h2>
            <p className="docs-p">
              The Linkpricer API gives developers programmatic access to domain pricing data aggregated from 50+ link-building marketplaces. For every domain and every niche you get two sets of prices side by side: what the marketplaces charge (<code className="docs-inline-code">marketplace</code> — the low, the mean and the high of the real market) and what Linkpricer charges to place it for you (<code className="docs-inline-code">linkpricer</code> — the same spread, fee included). Marketplace names are never exposed.
            </p>
            <p className="docs-p">
              There is one endpoint. Send it anywhere from 1 to 200 domains and get a result for each, in the order you sent them. All responses are JSON. Authentication uses an API key passed in a request header.
            </p>
            <div className="docs-callout">
              <strong>Base URL:</strong> <code className="docs-inline-code">https://www.linkpricer.ai/api</code>
              <br />
              <strong>Endpoint:</strong> <code className="docs-inline-code">POST /v1/public/domains/pricing</code>
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

          {/* Endpoint */}
          <section className="docs-section" id="endpoint">
            <h2 className="docs-h2">Endpoint</h2>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-post">POST</span>
              <span>/api/v1/public/domains/pricing</span>
            </div>
            <p className="docs-p">
              Prices up to <strong>200 domains in one request</strong> — the same limit as the Linkpricer dashboard&apos;s Analyze page — in about a second. To price a single domain, send a list of one. Each domain found comes back with its full pricing body: every niche&apos;s marketplace and Linkpricer prices, plus domain rating, traffic, referring domains and country.
            </p>
          </section>

          {/* Request */}
          <section className="docs-section" id="request">
            <h2 className="docs-h2">Request</h2>
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

          {/* Response */}
          <section className="docs-section" id="response">
            <h2 className="docs-h2">Response</h2>
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

          {/* Domain result */}
          <section className="docs-section" id="result">
            <h2 className="docs-h2">Domain result</h2>
            <p className="docs-p">
              Every <code className="docs-inline-code">results[i].data</code> with status <code className="docs-inline-code">ok</code> is the pricing body for that domain:
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

          {/* Metering */}
          <section className="docs-section" id="metering">
            <h2 className="docs-h2">Metering</h2>
            <div className="docs-callout">
              <strong>One lookup per distinct domain in our catalog.</strong> That includes a domain that has no offers for the niche you filtered to: it comes back with status <code className="docs-inline-code">ok</code> and <code className="docs-inline-code">data.found: false</code>, and its <code className="docs-inline-code">available_niches</code> is still worth having. Domains not in our catalog, malformed entries and duplicates cost nothing, and a request rejected outright (400, 413, 422) costs nothing. On a <code className="docs-inline-code">500</code> nothing is charged.
            </div>
            <p className="docs-p">
              A request must fit your remaining monthly quota as a whole: its distinct valid domains are reserved when the request arrives, and the ones we do not have are handed back when it completes. If they do not all fit, the request is refused with <code className="docs-inline-code">429 quota_exceeded</code>, the message says how many lookups remain, and nothing is charged — you never get a half-priced list. The per-minute limit counts requests, so one request is one against it however many domains it holds.
            </p>
            <p className="docs-p">
              Responses carry <code className="docs-inline-code">X-RateLimit-Limit</code>, <code className="docs-inline-code">X-RateLimit-Remaining</code> and <code className="docs-inline-code">X-RateLimit-Reset</code> (the monthly quota, after this request), <code className="docs-inline-code">X-RateLimit-Limit-Minute</code> and <code className="docs-inline-code">X-RateLimit-Remaining-Minute</code> for the burst limit, and <code className="docs-inline-code">X-Lookups-Charged</code>.
            </p>
          </section>

          {/* Errors */}
          <section className="docs-section" id="errors">
            <h2 className="docs-h2">Errors</h2>
            <p className="docs-p">A request that is refused as a whole returns this shape, with nothing charged except where noted:</p>
            <div className="docs-code-block">
              <pre>{ERROR_EXAMPLE}</pre>
            </div>
            <table className="docs-table" style={{ marginTop: 24 }}>
              <thead>
                <tr><th>Status</th><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <span className={`docs-badge docs-badge-${e.code === "401" || e.code === "500" ? "401" : e.code === "429" ? "429" : "404"}`}>
                        {e.code}
                      </span>
                    </td>
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

          {/* Rate Limits */}
          <section className="docs-section" id="rate-limits">
            <h2 className="docs-h2">Rate Limits</h2>
            <p className="docs-p">
              Each plan includes a monthly quota and a per-minute burst limit. Those are the only two limits — there is no daily cap, so you are free to spend a whole month&apos;s quota in one run. Both limits return <code className="docs-inline-code">429</code> with a <code className="docs-inline-code">Retry-After</code> header giving the seconds until that specific limit clears: about a minute for a burst (<code className="docs-inline-code">rate_limit_exceeded</code>), or the time remaining until the 1st for a spent quota (<code className="docs-inline-code">quota_exceeded</code>). The <code className="docs-inline-code">error</code> field tells the two apart, so a client can back off for a minute without mistaking it for a month.
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
            <div className="docs-callout">
              Monthly quotas reset on the 1st of each calendar month (UTC). A lookup is one distinct domain in a request that is in our catalog. Requests beyond your monthly quota return a <code className="docs-inline-code">429</code> until the next reset.
            </div>
          </section>

          {/* Code Examples */}
          <section className="docs-section" id="examples">
            <h2 className="docs-h2">Code Examples</h2>
            <p className="docs-p">A complete request in your language of choice:</p>
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

        </div>
      </div>
    </>
  );
}
