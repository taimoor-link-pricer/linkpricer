"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

type PreviewResult = {
  domain: string | null;
  price: number | null;
  currency: string | null;
  dr: number | null;
  monthlyTraffic: number | null;
};

function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "—";
  const sym = currency?.toUpperCase() === "USD" ? "$" : "€";
  return `${sym}${Math.round(price).toLocaleString()}`;
}

function formatTraffic(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDR(n: number | null): string {
  if (n == null) return "—";
  return String(Math.round(n));
}

export function HeroSection() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PreviewResult[] | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [searchedDomain, setSearchedDomain] = useState("");
  const [noResults, setNoResults] = useState(false);

  async function handleSearch() {
    const term = query.trim();
    if (!term || loading) return;

    setLoading(true);
    setResults(null);
    setNoResults(false);
    setRateLimited(false);
    setSearchedDomain(term);

    try {
      const res = await fetch(`/api/preview/search?domain=${encodeURIComponent(term)}`);

      if (res.status === 429) {
        setRateLimited(true);
        return;
      }

      if (!res.ok) {
        setNoResults(true);
        return;
      }

      const data = await res.json() as { results: PreviewResult[]; remaining: number };
      setRemaining(data.remaining);

      if (data.results.length === 0) {
        setNoResults(true);
      } else {
        setResults(data.results);
      }
    } catch {
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }

  const signupHref = `${ROUTES.signup}?domain=${encodeURIComponent(searchedDomain)}`;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes lp-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .hero-section { padding: 60px 40px; }
        .hero-h1 { font-size: 48px; }
        .hero-search-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
        .hero-search-input { flex: 1; }
        .hero-search-or { color: #9ca3af; }
        .stats-row { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
        .preview-result-row { display: grid; grid-template-columns: 1fr 100px 60px 90px 120px; align-items: center; padding: 14px 0; border-bottom: 1px solid #e8eaed; gap: 12px; }
        .preview-result-row:last-child { border-bottom: none; }
        @media (max-width: 768px) {
          .hero-section { padding: 36px 16px; }
          .hero-h1 { font-size: 28px; letter-spacing: -0.5px; }
          .hero-search-row { flex-direction: column; align-items: stretch; }
          .hero-search-or { display: none; }
          .hero-search-input { width: 100%; }
          .stats-row { gap: 20px; }
          .preview-result-row { grid-template-columns: 1fr 80px 50px; }
          .preview-col-traffic { display: none; }
          .preview-col-btn { display: none; }
        }
      `}</style>

      {/* Hero headline */}
      <section className="hero-section" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f6f8 100%)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h1 className="hero-h1" style={{ fontWeight: 900, color: "#000000", margin: "0 0 12px", letterSpacing: -1 }}>
            One search. 60+ vendors. Best price wins.
          </h1>
          <p style={{ fontSize: 17, color: "#4b5563", margin: "0 0 12px", maxWidth: 560, lineHeight: 1.6 }}>
            Compare backlink prices across all major marketplaces and find the best deal in seconds.
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            We aggregate marketplace offers across 40,000+ websites so you can save up to 70% on your link-building budget.
          </p>
        </div>
      </section>

      {/* Search & results */}
      <section className="hero-section" style={{ background: "#ffffff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Search box */}
          <div style={{ background: "#f5f6f8", borderRadius: 12, padding: 24, marginBottom: 40, border: "1px solid #e8eaed" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a202c", margin: "0 0 16px" }}>
              Domain Price Preview — See live prices from our marketplace
            </h3>
            <div className="hero-search-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="E.g., forbes.com"
                className="hero-search-input"
                style={{ padding: "11px 14px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", background: "#ffffff" }}
              />
              <span className="hero-search-or">or</span>
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                style={{ padding: "11px 24px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontWeight: 600, cursor: loading || !query.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, opacity: loading || !query.trim() ? 0.7 : 1, whiteSpace: "nowrap" }}
              >
                {loading && (
                  <span style={{ width: 14, height: 14, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                )}
                {loading ? "Searching…" : "Check Prices"}
              </button>
              <Link
                href={ROUTES.signup}
                style={{ padding: "11px 20px", border: "1px solid #0052cc", background: "#ffffff", color: "#0052cc", borderRadius: 10, fontWeight: 600, textDecoration: "none", fontSize: 14, textAlign: "center", whiteSpace: "nowrap" }}
              >
                Sign in for full access
              </Link>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                Try{" "}
                <button onClick={() => setQuery("forbes.com")} style={{ color: "#0052cc", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>forbes.com</button>
                {" "}or{" "}
                <button onClick={() => setQuery("techcrunch.com")} style={{ color: "#0052cc", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>techcrunch.com</button>
              </p>
              {remaining !== null && !rateLimited && (
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                  {remaining} free search{remaining !== 1 ? "es" : ""} remaining
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 17, color: "#1a202c", margin: 0 }}>
              Total domains in our database:{" "}
              <strong style={{ color: "#0052cc", fontSize: 22 }}>40,000+</strong> and counting
            </p>
          </div>

          {/* Results panel */}
          {(results || rateLimited || noResults) && (
            <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f6f8 100%)", borderRadius: 14, padding: 24, border: "1px solid #cce5ff", animation: "lp-fade-up 0.3s ease-out" }}>

              {/* Rate limited */}
              {rateLimited && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
                    You&apos;ve used all 5 free searches
                  </p>
                  <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px" }}>
                    Create a free account to get unlimited searches, full pricing data, and direct ordering.
                  </p>
                  <Link
                    href={`${ROUTES.signup}?domain=${encodeURIComponent(query.trim())}`}
                    style={{ display: "inline-block", padding: "13px 32px", background: "#0052cc", color: "#ffffff", borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: "none" }}
                  >
                    Sign up free — no credit card
                  </Link>
                </div>
              )}

              {/* No results */}
              {noResults && !rateLimited && (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>
                    No results found for &ldquo;{searchedDomain}&rdquo;
                  </p>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
                    This domain may not be in our marketplace yet. Sign up to request it.
                  </p>
                  <Link href={ROUTES.signup} style={{ color: "#0052cc", fontWeight: 600, fontSize: 13 }}>
                    Create free account →
                  </Link>
                </div>
              )}

              {/* Results */}
              {results && results.length > 0 && (
                <>
                  {/* Column headers */}
                  <div className="preview-result-row" style={{ borderBottom: "2px solid #e8eaed", paddingBottom: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Domain</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Best Price</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>DR</span>
                    <span className="preview-col-traffic" style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Traffic</span>
                    <span className="preview-col-btn" />
                  </div>

                  {results.map((row, i) => (
                    <div key={i} className="preview-result-row">
                      <span style={{ fontWeight: 600, color: "#0052cc", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.domain}
                      </span>
                      <span style={{ fontWeight: 700, color: "#006621", fontSize: 15 }}>
                        {formatPrice(row.price, row.currency)}
                      </span>
                      <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>
                        {formatDR(row.dr)}
                      </span>
                      <span className="preview-col-traffic" style={{ fontSize: 13, color: "#6b7280" }}>
                        {formatTraffic(row.monthlyTraffic)}
                      </span>
                      <span className="preview-col-btn">
                        <Link
                          href={`${ROUTES.signup}?domain=${encodeURIComponent(row.domain ?? searchedDomain)}`}
                          style={{ display: "inline-block", padding: "7px 16px", background: "#0052cc", color: "#ffffff", borderRadius: 8, fontWeight: 600, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          Get access →
                        </Link>
                      </span>
                    </div>
                  ))}

                  <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                      Showing top 3 of many results. Sign up to see all vendors and prices.
                    </p>
                    <Link
                      href={signupHref}
                      style={{ padding: "10px 24px", background: "#0052cc", color: "#ffffff", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
                    >
                      See full catalog (40,000+ domains) →
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Social proof */}
      <section className="hero-section" style={{ textAlign: "center", background: "#f5f6f8" }}>
        <div className="stats-row">
          {[
            { stat: "60+", label: "Vendors aggregated" },
            { stat: "1.5M+", label: "Offers indexed" },
            { stat: "3,000+", label: "Registered users" },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#0052cc" }}>{item.stat}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
