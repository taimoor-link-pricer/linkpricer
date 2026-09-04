"use client";

import { useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "endpoint", label: "Endpoint" },
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
  { code: "500", name: "internal_error", desc: "Error on our side. Retry with exponential backoff." },
];

const RATE_TIERS = [
  { tier: "Starter", price: "$10/mo", monthly: "1,000",  perMin: "10" },
  { tier: "Growth",  price: "$20/mo", monthly: "2,500",  perMin: "20" },
  { tier: "Scale",   price: "$50/mo", monthly: "10,000", perMin: "60" },
];

const RESPONSE_EXAMPLE = `{
  "domain": "techblog.com",
  "found": true,
  "pricing": {
    "standard": {
      "best_price":        150.00,
      "average_price":     264.50,
      "highest_price":     420.00,
      "our_price":         173,
      "recommended_price": 219,
      "offer_count":       6,
      "currency":          "USD"
    },
    "gambling": {
      "best_price":        350.00,
      "average_price":     512.40,
      "highest_price":     890.00,
      "our_price":         402,
      "recommended_price": null,
      "offer_count":       3,
      "currency":          "USD"
    }
  },
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
console.log(data.pricing.standard.best_price); // 150`;

const PYTHON_EXAMPLE = `import requests

response = requests.get(
    "https://www.linkpricer.ai/api/v1/public/domains/techblog.com/pricing",
    headers={"x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"}
)
data = response.json()
print(data["pricing"]["standard"]["best_price"])  # 150`;

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

  const codeMap: Record<Lang, string> = {
    curl: CURL_EXAMPLE,
    javascript: JS_EXAMPLE,
    python: PYTHON_EXAMPLE,
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
        .docs-content { padding: 48px 56px; max-width: 800px; }
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
              The Linkpricer API gives developers programmatic access to domain pricing data aggregated from 50+ link-building marketplaces. For every domain and every niche you get the full spread — best, average and highest price on the market — plus what Linkpricer charges to place it for you, without any marketplace names ever being exposed.
            </p>
            <p className="docs-p">
              The API is a simple REST interface. All responses are JSON. Authentication uses an API key passed in a request header.
            </p>
            <div className="docs-callout">
              <strong>Base URL:</strong> <code className="docs-inline-code">https://www.linkpricer.ai/api/v1/public</code>
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
            <p className="docs-p">There is currently one endpoint available:</p>
            <div className="docs-endpoint-box">
              <span className="docs-badge docs-badge-get">GET</span>
              <span>/api/v1/public/domains/<strong>{"{domain}"}</strong>/pricing</span>
            </div>
            <p className="docs-p">
              Returns the lowest available price and domain metrics for the given domain. The <code className="docs-inline-code">{"{domain}"}</code> parameter should be the bare domain without protocol — e.g. <code className="docs-inline-code">techblog.com</code>, not <code className="docs-inline-code">https://techblog.com</code>.
            </p>
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

            <h3 className="docs-h3">Response fields</h3>
            <table className="docs-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Description</th></tr>
              </thead>
              <tbody>
                {[
                  ["domain", "string", "The normalized domain you queried."],
                  ["found", "boolean", "false when nothing in this response is priced — either no source prices the domain at all, or the niche you filtered to has no offers. pricing is then {} and last_updated is null."],
                  ["pricing", "object", "One entry per niche that at least one source prices for this domain. A niche nobody prices is absent — never present with nulls."],
                  ["pricing.<niche>.best_price", "number", "Lowest price any source charges for this niche, in USD. This is the market low, anonymized — we never say which source it came from."],
                  ["pricing.<niche>.average_price", "number", "Mean price across every source that prices this niche, in USD."],
                  ["pricing.<niche>.highest_price", "number", "Highest price any source charges for this niche, in USD."],
                  ["pricing.<niche>.our_price", "number", "What Linkpricer charges to place this for you at the best price. Identical to the price shown on the dashboard's Buy button."],
                  ["pricing.<niche>.recommended_price", "number | null", "What Linkpricer charges via the cheapest source our team has vetted. null when no vetted source prices this niche for this domain — the placement is still available at our_price."],
                  ["pricing.<niche>.offer_count", "number", "How many independent sources back these figures."],
                  ["pricing.<niche>.currency", "string", "Always \"USD\". Source prices in other currencies are converted before any comparison."],
                  ["metrics.domain_rating", "number | null", "Ahrefs Domain Rating (0–100)."],
                  ["metrics.organic_traffic", "number | null", "Estimated monthly organic traffic."],
                  ["metrics.ref_domains", "number | null", "Number of referring domains."],
                  ["metrics.country", "string | null", "Primary traffic country, full name (e.g. \"United States\") — not an ISO code."],
                  ["last_updated", "string | null", "Date the underlying prices were last refreshed. null when nothing is priced."],
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
                  <tr key={e.code}>
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
                    <td>{r.monthly} queries</td>
                    <td>{r.perMin} req/min</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="docs-callout">
              Monthly quotas reset on the 1st of each calendar month (UTC). Requests beyond your monthly quota return a <code className="docs-inline-code">429</code> until the next reset.
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
