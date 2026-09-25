"use client";

import { useState } from "react";
import { planPrice } from "@/lib/pricing/plan-display";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoint", label: "Endpoints" },
  { id: "batch", label: "Batch (v2)" },
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "errors", label: "Errors" },
  { id: "rate-limits", label: "Rate Limits" },
  { id: "examples", label: "Code Examples" },
];

const ERROR_CODES = [
  { code: "401", name: "missing_api_key", desc: "No x-api-key header was sent." },
  { code: "401", name: "invalid_api_key", desc: "The key is unknown, or its subscription is no longer active." },
  { code: "404", name: "domain_not_found", desc: "The domain is not in our catalog at all." },
  { code: "422", name: "invalid_domain", desc: "The domain parameter is missing or malformed. Does not consume quota." },
  { code: "422", name: "invalid_niche", desc: "The niche value is not one we price. Does not consume quota." },
  { code: "429", name: "rate_limit_exceeded", desc: "Per-minute burst limit hit. Retry-After is about 60 seconds." },
  { code: "429", name: "quota_exceeded", desc: "Monthly quota spent. Retry-After counts down to the 1st, 00:00 UTC." },
  { code: "500", name: "internal_error", desc: "Error on our side. Retry with exponential backoff. On the batch endpoint no lookups are charged." },
];

const BATCH_ERROR_CODES = [
  { code: "400", name: "invalid_request", desc: "The body is not an object with a domains array." },
  { code: "400", name: "invalid_json", desc: "The body is not valid JSON." },
  { code: "405", name: "method_not_allowed", desc: "Anything other than POST." },
  { code: "413", name: "payload_too_large", desc: "The body is larger than 128 KB." },
  { code: "422", name: "empty_batch", desc: "domains is an empty array." },
  { code: "422", name: "too_many_domains", desc: "More than 200 entries. Split the list into several requests." },
  { code: "422", name: "invalid_niche", desc: "The niche value is not one we price." },
  { code: "422", name: "no_valid_domains", desc: "Every entry was malformed. The body carries a results array saying why for each one." },
  { code: "429", name: "quota_exceeded", desc: "The batch needs more lookups than remain this month. The message names both numbers. Nothing is charged; send fewer distinct domains or wait for the reset." },
];

const BATCH_REQUEST_EXAMPLE = `POST /api/v2/public/domains/pricing
x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "domains": ["techblog.com", "https://www.newsdaily.io/about", "nosuchsite.org", "not a domain"],
  "niche": "gambling"
}`;

const BATCH_RESPONSE_EXAMPLE = `{
  "api_version": "2",
  "niche": "gambling",
  "summary": { "requested": 4, "unique_domains": 3, "ok": 2, "not_found": 1, "invalid": 1 },
  "usage": {
    "charged": 2,
    "monthly_limit": 10000,
    "monthly_remaining": 9412,
    "resets_at": "2026-10-01T00:00:00.000Z"
  },
  "results": [
    {
      "input": "techblog.com",
      "domain": "techblog.com",
      "status": "ok",
      "error": null,
      "data": { "domain": "techblog.com", "found": true, "currency": "USD", "pricing": { "gambling": { … } }, … }
    },
    {
      "input": "https://www.newsdaily.io/about",
      "domain": "newsdaily.io",
      "status": "ok",
      "error": null,
      "data": { … }
    },
    {
      "input": "nosuchsite.org",
      "domain": "nosuchsite.org",
      "status": "not_found",
      "error": { "code": "domain_not_found", "message": "No data found for this domain." },
      "data": null
    },
    {
      "input": "not a domain",
      "domain": null,
      "status": "invalid",
      "error": { "code": "invalid_domain", "message": "Not a valid domain. Send a bare host such as example.com." },
      "data": null
    }
  ]
}`;

const BATCH_CURL_EXAMPLE = `curl -X POST "https://www.linkpricer.ai/api/v2/public/domains/pricing" \\
  -H "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"domains": ["techblog.com", "newsdaily.io"], "niche": "gambling"}'`;

const BATCH_JS_EXAMPLE = `const res = await fetch("https://www.linkpricer.ai/api/v2/public/domains/pricing", {
  method: "POST",
  headers: {
    "x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ domains: ["techblog.com", "newsdaily.io"], niche: "gambling" }),
});
const batch = await res.json();
for (const r of batch.results) {
  if (r.status === "ok") console.log(r.domain, r.data.pricing.gambling?.linkpricer.lowest);
}`;

const BATCH_PYTHON_EXAMPLE = `import requests

domains = open("domains.txt").read().split()
for i in range(0, len(domains), 200):          # 200 per request
    res = requests.post(
        "https://www.linkpricer.ai/api/v2/public/domains/pricing",
        headers={"x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"},
        json={"domains": domains[i:i + 200], "niche": "gambling"},
    )
    res.raise_for_status()
    for r in res.json()["results"]:
        if r["status"] == "ok":
            print(r["domain"], r["data"]["pricing"].get("gambling", {}).get("linkpricer", {}).get("lowest"))`;

const RATE_TIERS = [
  { tier: "Starter", price: planPrice("starter", { period: "/mo" }), monthly: "1,000",  perMin: "10" },
  { tier: "Growth",  price: planPrice("growth",  { period: "/mo" }), monthly: "2,500",  perMin: "20" },
  { tier: "Scale",   price: planPrice("scale",   { period: "/mo" }), monthly: "10,000", perMin: "60" },
];

const RESPONSE_EXAMPLE = `{
  "domain": "techblog.com",
  "found": true,
  "currency": "USD",
  "fee": { "percent": 15, "minimum_usd": 28.50 },
  "pricing": {
    "standard": {
      "label":   "Standard / general",
      "summary": "LinkPricer best price for Standard / general: $299 (6 sources).",
      "marketplace": { "lowest": 260.00, "average": 264.50, "highest": 420.00 },
      "linkpricer":  { "lowest": 299, "average": 304.17, "highest": 483, "recommended": 345 },
      "offer_count":  6,
      "last_updated": "2026-06-20"
    },
    "gambling": {
      "label":   "Gambling / iGaming",
      "summary": "LinkPricer best price for Gambling / iGaming: $414 (3 sources).",
      "marketplace": { "lowest": 360.00, "average": 512.40, "highest": 900.00 },
      "linkpricer":  { "lowest": 414, "average": 589.26, "highest": 1035, "recommended": null },
      "offer_count":  3,
      "last_updated": "2026-05-02"
    }
  },
  "available_niches": ["standard", "gambling"],
  "metrics": {
    "domain_rating":   45,
    "organic_traffic": 12000,
    "ref_domains":     1200,
    "country":         "United States"
  },
  "last_updated": "2026-06-20"
}`;

const ERROR_EXAMPLE = `{
  "error": "domain_not_found",
  "message": "No data found for this domain.",
  "status": 404
}`;

const CURL_EXAMPLE = `curl -X GET \\
  "https://www.linkpricer.ai/api/v1/public/domains/techblog.com/pricing" \\
  -H "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"`;

const JS_EXAMPLE = `const res = await fetch(
  "https://www.linkpricer.ai/api/v1/public/domains/techblog.com/pricing",
  { headers: { "x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx" } }
);
const data = await res.json();
console.log(data.pricing.standard.linkpricer.lowest); // 299 — what you pay us`;

const PYTHON_EXAMPLE = `import requests

response = requests.get(
    "https://www.linkpricer.ai/api/v1/public/domains/techblog.com/pricing",
    headers={"x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"}
)
data = response.json()
print(data["pricing"]["standard"]["linkpricer"]["lowest"])  # 299 — what you pay us`;

type Lang = "curl" | "javascript" | "python";
type Mode = "single" | "batch";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [lang, setLang] = useState<Lang>("curl");
  const [mode, setMode] = useState<Mode>("single");
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const codeMap: Record<Mode, Record<Lang, string>> = {
    single: { curl: CURL_EXAMPLE, javascript: JS_EXAMPLE, python: PYTHON_EXAMPLE },
    batch: { curl: BATCH_CURL_EXAMPLE, javascript: BATCH_JS_EXAMPLE, python: BATCH_PYTHON_EXAMPLE },
  };

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
              The API is a simple REST interface. All responses are JSON. Authentication uses an API key passed in a request header.
            </p>
            <div className="docs-callout">
              <strong>Base URL:</strong> <code className="docs-inline-code">https://www.linkpricer.ai/api</code>
              <br />
              <strong>Single domain:</strong> <code className="docs-inline-code">GET /v1/public/domains/{"{domain}"}/pricing</code>
              <br />
              <strong>Batch, up to 200 domains:</strong> <code className="docs-inline-code">POST /v2/public/domains/pricing</code>
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
            <p className="docs-p">There are two endpoints. Both return the same pricing body for a domain; the batch endpoint returns it for up to 200 domains at a time.</p>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-get">GET</span>
              <span>/api/v1/public/domains/<strong>{"{domain}"}</strong>/pricing</span>
            </div>
            <p className="docs-p">
              Returns pricing and domain metrics for one domain. The <code className="docs-inline-code">{"{domain}"}</code> parameter should be the bare domain without protocol — e.g. <code className="docs-inline-code">techblog.com</code>, not <code className="docs-inline-code">https://techblog.com</code>.
            </p>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-post">POST</span>
              <span>/api/v2/public/domains/pricing</span>
            </div>
            <p className="docs-p">Prices up to 200 domains in one request. See <a href="#batch" style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>Batch (v2)</a>.</p>
            <p className="docs-p">The Request, Response and Errors sections below describe the single-domain endpoint. Everything in Response applies to each batch result too.</p>
          </section>

          {/* Batch */}
          <section className="docs-section" id="batch">
            <h2 className="docs-h2">Batch (v2)</h2>
            <p className="docs-p">
              Price up to <strong>200 domains in one request</strong> — the same limit as the Linkpricer dashboard&apos;s Analyze page. Each domain comes back with exactly the body the single-domain endpoint returns for it, so code that already reads a v1 response reads a batch result unchanged.
            </p>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-post">POST</span>
              <span>/api/v2/public/domains/pricing</span>
            </div>

            <h3 className="docs-h3">Request body</h3>
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
                  <td>Applies to every domain in the batch. Same values and synonyms as the single-domain <code className="docs-inline-code">niche</code> parameter; omitted, null or blank means every niche.</td>
                </tr>
              </tbody>
            </table>
            <div className="docs-code-block">
              <button className={`docs-copy-btn${copied === "batch-req" ? " copied" : ""}`} onClick={() => copy(BATCH_REQUEST_EXAMPLE, "batch-req")}>
                {copied === "batch-req" ? "Copied!" : "Copy"}
              </button>
              <pre>{BATCH_REQUEST_EXAMPLE}</pre>
            </div>

            <h3 className="docs-h3">Response</h3>
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
                {[
                  ["api_version", "string", "Always \"2\"."],
                  ["niche", "string | null", "The niche every result was filtered to, as its canonical id (a synonym you sent is resolved). null for all niches."],
                  ["summary.requested", "number", "Entries you sent."],
                  ["summary.unique_domains", "number", "Distinct valid domains looked up."],
                  ["summary.ok / not_found / invalid", "number", "Results per status, counted per entry (duplicates included)."],
                  ["usage.charged", "number", "Lookups this request took from your monthly quota — one per distinct domain found."],
                  ["usage.monthly_limit", "number", "Your monthly lookup quota."],
                  ["usage.monthly_remaining", "number", "Lookups left this month after this request."],
                  ["usage.resets_at", "string", "When the quota resets (the 1st, 00:00 UTC), ISO 8601."],
                  ["results[].input", "string | null", "The entry exactly as you sent it. null if it was not a string."],
                  ["results[].domain", "string | null", "The normalized domain that was looked up. null when the entry was invalid."],
                  ["results[].status", "string", "\"ok\", \"not_found\" (not in our catalog) or \"invalid\" (malformed entry)."],
                  ["results[].error", "object | null", "{ code, message } when status is not ok, otherwise null."],
                  ["results[].data", "object | null", "When status is ok: the single-domain response body — every field in Response above. Otherwise null. As with v1, data.found is false when the domain is catalogued but nothing is priced for the niche you asked for."],
                ].map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="docs-h3">How a batch is metered</h3>
            <div className="docs-callout">
              <strong>One lookup per distinct domain found.</strong> Domains not in our catalog, malformed entries and duplicates cost nothing, and a request rejected outright (400, 413, 422) costs nothing. On a <code className="docs-inline-code">500</code> nothing is charged.
            </div>
            <p className="docs-p">
              A batch must fit your remaining monthly quota as a whole: its distinct valid domains are reserved when the request arrives, and the ones we do not have are handed back when it completes. If they do not all fit, the request is refused with <code className="docs-inline-code">429 quota_exceeded</code>, the message says how many lookups remain, and nothing is charged — you never get a half-priced list. The per-minute limit counts requests, so one batch is one request against it however many domains it holds.
            </p>
            <p className="docs-p">
              Responses carry the same <code className="docs-inline-code">X-RateLimit-*</code> headers as v1, reflecting the quota after this request, plus <code className="docs-inline-code">X-Lookups-Charged</code>.
            </p>

            <h3 className="docs-h3">Batch errors</h3>
            <p className="docs-p">Request-level errors use the same <code className="docs-inline-code">{"{ error, message, status }"}</code> envelope. In addition to <code className="docs-inline-code">missing_api_key</code>, <code className="docs-inline-code">invalid_api_key</code>, <code className="docs-inline-code">rate_limit_exceeded</code> and <code className="docs-inline-code">internal_error</code>:</p>
            <table className="docs-table">
              <thead>
                <tr><th>Status</th><th>Error</th><th>Description</th></tr>
              </thead>
              <tbody>
                {BATCH_ERROR_CODES.map((e) => (
                  <tr key={e.name}>
                    <td><span className={`docs-badge docs-badge-${e.code === "429" ? "429" : "404"}`}>{e.code}</span></td>
                    <td><code className="docs-inline-code">{e.name}</code></td>
                    <td>{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Request */}
          <section className="docs-section" id="request">
            <h2 className="docs-h2">Request</h2>
            <h3 className="docs-h3">Path parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">domain</code></td>
                  <td>string</td>
                  <td>Yes</td>
                  <td>The domain to look up. Bare domain only — no protocol, no path. E.g. <code className="docs-inline-code">techblog.com</code></td>
                </tr>
              </tbody>
            </table>

            <h3 className="docs-h3">Query parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">niche</code></td>
                  <td>string</td>
                  <td>No</td>
                  <td>
                    Restrict the response to a single niche&apos;s pricing instead of all niches. One of{" "}
                    <code className="docs-inline-code">standard</code>,{" "}
                    <code className="docs-inline-code">gambling</code>,{" "}
                    <code className="docs-inline-code">adult</code>,{" "}
                    <code className="docs-inline-code">cbd</code>,{" "}
                    <code className="docs-inline-code">loan</code>,{" "}
                    <code className="docs-inline-code">dating</code>,{" "}
                    <code className="docs-inline-code">crypto</code>,{" "}
                    <code className="docs-inline-code">trading_forex</code>,{" "}
                    <code className="docs-inline-code">link_insertion</code>. Omit it to get every niche in one call.
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
                    A niche only appears in the response when at least one source actually prices
                    that niche for that domain. An offer with no price set for a niche is left out
                    of it entirely rather than falling back to its base rate — so a{" "}
                    <code className="docs-inline-code">gambling</code> figure is always a real
                    gambling price, never a standard one relabelled.
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 className="docs-h3">Headers</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Header</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code className="docs-inline-code">x-api-key</code></td>
                  <td>Yes</td>
                  <td>Your Linkpricer API key.</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Response */}
          <section className="docs-section" id="response">
            <h2 className="docs-h2">Response</h2>
            <p className="docs-p">
              A successful response returns HTTP <code className="docs-inline-code">200</code> with the following JSON body:
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
                {[
                  ["domain", "string", "The normalized domain you queried."],
                  ["found", "boolean", "false when nothing in this response is priced — either no source prices the domain at all, or the niche you filtered to has no offers. pricing is then {} and last_updated is null. available_niches still tells you what the domain IS priced for."],
                  ["currency", "string", "Always \"USD\". Source prices in other currencies are converted before any comparison."],
                  ["fee", "object", "The Linkpricer fee applied to every figure under linkpricer. Identical for every niche, so it is stated once here rather than repeated."],
                  ["fee.percent", "number", "The percentage part of the fee. Currently 15. It is the larger of this percentage and fee.minimum_usd that is actually charged, so on a cheap placement the effective markup is higher than this number."],
                  ["fee.minimum_usd", "number", "The minimum fee, charged whenever it exceeds fee.percent of the source price — the usual case below roughly $190. Set in euros by us (currently €25), so this figure tracks the exchange rate. Use it to reproduce any linkpricer figure."],
                  ["pricing", "object", "One entry per niche that at least one source prices for this domain. A niche nobody prices is absent — never present with nulls."],
                  ["pricing.<niche>.label", "string", "Human-readable niche name, e.g. \"Gambling / iGaming\"."],
                  ["pricing.<niche>.summary", "string", "One sentence naming what this niche's headline price is for. For display only — every figure in it is also a number below, and the wording may change at any time, so do not parse it."],
                  ["pricing.<niche>.marketplace", "object", "What the sources charge, WITHOUT the Linkpricer fee. Anonymized — we never say which source a price came from."],
                  ["pricing.<niche>.marketplace.lowest", "number", "WITHOUT fee. Lowest price any source charges for this niche, in USD."],
                  ["pricing.<niche>.marketplace.average", "number", "WITHOUT fee. Mean price across every source that prices this niche, in USD."],
                  ["pricing.<niche>.marketplace.highest", "number", "WITHOUT fee. Highest price any source charges for this niche, in USD."],
                  ["pricing.<niche>.linkpricer", "object", "What you pay Linkpricer, fee INCLUDED."],
                  ["pricing.<niche>.linkpricer.lowest", "number", "WITH fee. What Linkpricer charges to place this for you at the best price. Identical to the price shown on the dashboard's Buy button."],
                  ["pricing.<niche>.linkpricer.average", "number", "WITH fee. The mean of your price at every source. NOT marketplace.average plus the fee — each source is priced individually and then averaged, so the minimum fee on cheap placements is reflected honestly."],
                  ["pricing.<niche>.linkpricer.highest", "number", "WITH fee. Your price at the most expensive source."],
                  ["pricing.<niche>.linkpricer.recommended", "number | null", "WITH fee. What Linkpricer charges via the cheapest source our team has vetted. null when no vetted source prices this niche for this domain — the placement is still available at linkpricer.lowest."],
                  ["pricing.<niche>.offer_count", "number", "How many independent sources back these figures."],
                  ["pricing.<niche>.last_updated", "string | null", "Date the prices for THIS niche were last refreshed, from the sources that actually price it. null when no contributing source carries a timestamp."],
                  ["available_niches", "string[]", "Every niche this domain is priced for, regardless of any niche filter. Use it to tell \"no source sells this niche here\" apart from \"you filtered it out\" — without spending a second request."],
                  ["metrics.domain_rating", "number | null", "Ahrefs Domain Rating (0–100)."],
                  ["metrics.organic_traffic", "number | null", "Estimated monthly organic traffic."],
                  ["metrics.ref_domains", "number | null", "Number of referring domains."],
                  ["metrics.country", "string | null", "Primary traffic country, full name (e.g. \"United States\") — not an ISO code."],
                  ["last_updated", "string | null", "The most recent of the per-niche dates in this response. null when nothing is priced."],
                ].map(([field, type, desc]) => (
                  <tr key={field}>
                    <td><code className="docs-inline-code">{field}</code></td>
                    <td style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{type}</td>
                    <td>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Errors */}
          <section className="docs-section" id="errors">
            <h2 className="docs-h2">Errors</h2>
            <p className="docs-p">All error responses follow this shape:</p>
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
                      <span className={`docs-badge docs-badge-${e.code === "401" || e.code === "500" ? "401" : e.code === "404" ? "404" : "429"}`}>
                        {e.code}
                      </span>
                    </td>
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
              Each plan includes a monthly quota and a per-minute burst limit. Those are the only two limits — there is no daily cap, so you are free to spend a whole month&apos;s quota in one batch run. Both limits return <code className="docs-inline-code">429</code> with a <code className="docs-inline-code">Retry-After</code> header giving the seconds until that specific limit clears: about a minute for a burst (<code className="docs-inline-code">rate_limit_exceeded</code>), or the time remaining until the 1st for a spent quota (<code className="docs-inline-code">quota_exceeded</code>). The <code className="docs-inline-code">error</code> field tells the two apart, so a client can back off for a minute without mistaking it for a month.
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
              Monthly quotas reset on the 1st of each calendar month (UTC). A lookup is one single-domain request, or one distinct domain found in a batch. Requests beyond your monthly quota return a <code className="docs-inline-code">429</code> until the next reset.
            </div>
          </section>

          {/* Code Examples */}
          <section className="docs-section" id="examples">
            <h2 className="docs-h2">Code Examples</h2>
            <p className="docs-p">A complete request in your language of choice:</p>
            <div className="docs-lang-tabs" style={{ marginBottom: 12 }}>
              {(["single", "batch"] as Mode[]).map((m) => (
                <div
                  key={m}
                  className={`docs-lang-tab${mode === m ? " active" : ""}`}
                  style={{ borderRadius: 6, borderBottom: "1px solid #e5e7eb" }}
                  onClick={() => setMode(m)}
                >
                  {m === "single" ? "Single domain (v1)" : "Batch (v2)"}
                </div>
              ))}
            </div>
            <div className="docs-lang-tabs">
              {(["curl", "javascript", "python"] as Lang[]).map((l) => (
                <div key={l} className={`docs-lang-tab${lang === l ? " active" : ""}`} onClick={() => setLang(l)}>
                  {l === "curl" ? "cURL" : l === "javascript" ? "JavaScript" : "Python"}
                </div>
              ))}
            </div>
            <div className="docs-code-block" style={{ borderRadius: "0 10px 10px 10px" }}>
              <button className={`docs-copy-btn${copied === "example" ? " copied" : ""}`} onClick={() => copy(codeMap[mode][lang], "example")}>
                {copied === "example" ? "Copied!" : "Copy"}
              </button>
              <pre>{codeMap[mode][lang]}</pre>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
