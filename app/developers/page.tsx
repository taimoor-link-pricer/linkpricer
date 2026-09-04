import Link from "next/link";

const TIERS = [
  {
    name: "Starter",
    price: "$10",
    period: "/mo",
    queries: "1,000 queries/mo",
    rateLimit: "10 req/min",
    features: ["Domain pricing endpoint", "Standard support", "API key dashboard"],
    highlight: false,
  },
  {
    name: "Growth",
    price: "$20",
    period: "/mo",
    queries: "2,500 queries/mo",
    rateLimit: "20 req/min",
    features: ["Domain pricing endpoint", "Priority support", "API key dashboard", "Usage analytics"],
    highlight: true,
  },
  {
    name: "Scale",
    price: "$50",
    period: "/mo",
    queries: "10,000 queries/mo",
    rateLimit: "60 req/min",
    features: ["Domain pricing endpoint", "Dedicated support", "API key dashboard", "Usage analytics", "SLA guarantee"],
    highlight: false,
  },
];

const FEATURES = [
  { icon: "🔍", title: "Full price spread, anonymized", body: "Query any domain and get the best, average and highest price across every marketplace we track — no marketplace names ever exposed." },
  { icon: "📊", title: "Rich domain metrics", body: "Domain rating, organic traffic, referring domains, country, and niche data bundled in every response." },
  { icon: "⚡", title: "Fast & reliable", body: "Prices are read live from source on every call — no stale cache layer in front of them. Data refreshed daily from 50+ marketplaces and growing." },
  { icon: "🔒", title: "Secure by default", body: "API key auth on every request. Server-to-server only — no browser CORS. Keys scoped per account." },
  { icon: "📈", title: "Rate limiting built in", body: "Every plan includes per-minute and per-month request limits. Overages return a clean 429 with retry headers." },
  { icon: "🧩", title: "Simple REST API", body: "One endpoint, predictable JSON response, full error codes. Integrates in minutes with any language." },
];

const EXAMPLE_RESPONSE = `{
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

export default function DevelopersPage() {
  return (
    <>
      <style>{`
        .dev-hero { padding: 80px 32px 60px; background: linear-gradient(160deg, #f0f7ff 0%, #ffffff 60%); text-align: center; }
        .dev-hero-inner { max-width: 760px; margin: 0 auto; }
        .dev-hero-eyebrow { display: inline-block; background: #e6f2ff; color: #0052cc; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; margin-bottom: 20px; text-transform: uppercase; }
        .dev-h1 { font-size: 52px; font-weight: 900; color: #111827; margin: 0 0 20px; line-height: 1.1; letter-spacing: -1.5px; }
        .dev-h1 span { color: #0052cc; }
        .dev-sub { font-size: 18px; color: #4b5563; margin: 0 0 36px; line-height: 1.7; }
        .dev-hero-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }
        .dev-btn-primary { padding: 13px 28px; background: #0052cc; color: #fff; border-radius: 9px; font-weight: 700; font-size: 15px; text-decoration: none; transition: background 0.15s; }
        .dev-btn-primary:hover { background: #003a99; }
        .dev-btn-secondary { padding: 13px 28px; background: #fff; color: #0052cc; border: 1.5px solid #0052cc; border-radius: 9px; font-weight: 600; font-size: 15px; text-decoration: none; transition: all 0.15s; }
        .dev-btn-secondary:hover { background: #f0f7ff; }

        .dev-code-preview { background: #0f172a; border-radius: 14px; padding: 24px 28px; text-align: left; max-width: 680px; margin: 0 auto; overflow-x: auto; }
        .dev-code-label { font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 12px; text-transform: uppercase; }
        .dev-code-preview pre { margin: 0; font-size: 13px; line-height: 1.7; font-family: "JetBrains Mono", "Fira Mono", "Courier New", monospace; color: #e2e8f0; white-space: pre; }
        .dev-code-key { color: #7dd3fc; }
        .dev-code-str { color: #86efac; }
        .dev-code-num { color: #fbbf24; }
        .dev-code-null { color: #94a3b8; }

        .dev-section { padding: 80px 32px; max-width: 1200px; margin: 0 auto; }
        .dev-section-h2 { font-size: 36px; font-weight: 800; color: #111827; margin: 0 0 12px; letter-spacing: -0.8px; text-align: center; }
        .dev-section-sub { font-size: 16px; color: #6b7280; text-align: center; margin: 0 0 48px; }

        .dev-feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .dev-feat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; transition: all 0.2s; }
        .dev-feat:hover { border-color: #0052cc; box-shadow: 0 6px 20px rgba(0,82,204,0.08); transform: translateY(-3px); }
        .dev-feat-icon { font-size: 28px; margin-bottom: 14px; }
        .dev-feat h3 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 8px; }
        .dev-feat p { font-size: 13px; color: #4b5563; margin: 0; line-height: 1.6; }

        .dev-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .dev-tier { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 14px; padding: 32px; position: relative; transition: all 0.2s; }
        .dev-tier.highlighted { border-color: #0052cc; box-shadow: 0 8px 32px rgba(0,82,204,0.12); }
        .dev-tier-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #0052cc; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 14px; border-radius: 20px; letter-spacing: 0.3px; white-space: nowrap; }
        .dev-tier-name { font-size: 13px; font-weight: 700; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px; }
        .dev-tier-price { font-size: 42px; font-weight: 900; color: #111827; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
        .dev-tier-price span { font-size: 16px; font-weight: 500; color: #6b7280; }
        .dev-tier-queries { font-size: 13px; color: #0052cc; font-weight: 600; margin-bottom: 4px; }
        .dev-tier-rate { font-size: 12px; color: #9ca3af; margin-bottom: 24px; }
        .dev-tier-divider { border: none; border-top: 1px solid #e5e7eb; margin: 0 0 20px; }
        .dev-tier-feat { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: #374151; margin-bottom: 10px; }
        .dev-tier-check { color: #0052cc; font-weight: 700; flex-shrink: 0; }
        .dev-tier-cta { display: block; margin-top: 24px; padding: 11px; text-align: center; border-radius: 9px; font-weight: 600; font-size: 14px; text-decoration: none; transition: all 0.15s; }
        .dev-tier-cta-primary { background: #0052cc; color: #fff; }
        .dev-tier-cta-primary:hover { background: #003a99; }
        .dev-tier-cta-outline { background: #fff; color: #0052cc; border: 1.5px solid #0052cc; }
        .dev-tier-cta-outline:hover { background: #f0f7ff; }

        .dev-cta-strip { background: linear-gradient(135deg, #0052cc 0%, #003a99 100%); border-radius: 16px; padding: 60px 40px; text-align: center; margin: 0 32px 80px; max-width: 1200px; margin-left: auto; margin-right: auto; }
        .dev-cta-strip h2 { font-size: 34px; font-weight: 900; color: #fff; margin: 0 0 12px; letter-spacing: -0.5px; }
        .dev-cta-strip p { color: #cce5ff; font-size: 16px; margin: 0 0 28px; }

        @media (max-width: 1024px) {
          .dev-feat-grid, .dev-pricing-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .dev-h1 { font-size: 34px; }
          .dev-feat-grid, .dev-pricing-grid { grid-template-columns: 1fr; }
          .dev-section { padding: 60px 16px; }
          .dev-hero { padding: 60px 16px 40px; }
          .dev-cta-strip { margin: 0 16px 60px; padding: 40px 20px; }
          .dev-cta-strip h2 { font-size: 26px; }
        }
      `}</style>

      {/* Hero */}
      <section className="dev-hero">
        <div className="dev-hero-inner">
          <div className="dev-hero-eyebrow">Public API · Beta</div>
          <h1 className="dev-h1">
            Domain pricing data<br />
            <span>built for developers</span>
          </h1>
          <p className="dev-sub">
            Query any domain and get the full price spread from across 50+ marketplaces,
            for every niche. One endpoint, clean JSON, ready in minutes.
          </p>
          <div className="dev-hero-cta">
            <Link href="/developers/dashboard" className="dev-btn-primary">Get your API key</Link>
            <Link href="/developers/docs" className="dev-btn-secondary">Read the docs</Link>
          </div>

          {/* Code preview */}
          <div className="dev-code-preview">
            <div className="dev-code-label">Example response — GET /api/v1/public/domains/techblog.com/pricing</div>
            <pre>
              <SyntaxHighlight code={EXAMPLE_RESPONSE} />
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <div style={{ background: "#f9fafb" }}>
        <div className="dev-section">
          <h2 className="dev-section-h2">Everything you need</h2>
          <p className="dev-section-sub">One endpoint with all the data your integration needs.</p>
          <div className="dev-feat-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="dev-feat">
                <div className="dev-feat-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="dev-section">
        <h2 className="dev-section-h2">Simple, usage-based pricing</h2>
        <p className="dev-section-sub">Flat monthly subscription. Cancel anytime.</p>
        <div className="dev-pricing-grid">
          {TIERS.map((tier) => (
            <div key={tier.name} className={`dev-tier${tier.highlight ? " highlighted" : ""}`}>
              {tier.highlight && <div className="dev-tier-badge">Most popular</div>}
              <div className="dev-tier-name">{tier.name}</div>
              <div className="dev-tier-price">{tier.price}<span>{tier.period}</span></div>
              <div className="dev-tier-queries">{tier.queries}</div>
              <div className="dev-tier-rate">{tier.rateLimit}</div>
              <hr className="dev-tier-divider" />
              {tier.features.map((feat) => (
                <div key={feat} className="dev-tier-feat">
                  <span className="dev-tier-check">✓</span>
                  {feat}
                </div>
              ))}
              <Link
                href="/developers/dashboard"
                className={`dev-tier-cta ${tier.highlight ? "dev-tier-cta-primary" : "dev-tier-cta-outline"}`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#9ca3af" }}>
          Need more? <Link href="mailto:hello@linkpricer.com" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>Contact us</Link> for Enterprise pricing.
        </p>
      </div>

      {/* CTA */}
      <div className="dev-cta-strip">
        <h2>Ready to build?</h2>
        <p>Sign up, get your API key, and make your first request in under 5 minutes.</p>
        <Link href="/developers/dashboard" className="dev-btn-primary" style={{ display: "inline-block", background: "#fff", color: "#0052cc" }}>
          Get your API key
        </Link>
      </div>
    </>
  );
}

function SyntaxHighlight({ code }: { code: string }) {
  const parts = code.split(/("(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|null)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^"[^"]*":/.test(part + ":") && i % 2 === 1) {
          return <span key={i} style={{ color: "#7dd3fc" }}>{part}</span>;
        }
        if (/^"/.test(part)) return <span key={i} style={{ color: "#86efac" }}>{part}</span>;
        if (/^\d/.test(part)) return <span key={i} style={{ color: "#fbbf24" }}>{part}</span>;
        if (part === "null") return <span key={i} style={{ color: "#94a3b8" }}>{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
