"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const DEMO_ROWS = [
  { domain: "forbes.com", vendor: "Marketplace A", price: "$1,450", dr: 83, traffic: "803.9K" },
  { domain: "techcrunch.com", vendor: "Marketplace B", price: "$1,100", dr: 79, traffic: "521.2K" },
  { domain: "theverge.com", vendor: "Marketplace C", price: "$920", dr: 76, traffic: "417.5K" },
];

export function HeroSection() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowResults(true);
    }, 1800);
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .hero-section { padding: 60px 40px; }
        .hero-h1 { font-size: 48px; }
        .hero-search-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
        .hero-search-input { flex: 1; }
        .hero-search-or { color: #9ca3af; }
        .stats-row { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
        @media (max-width: 768px) {
          .hero-section { padding: 36px 16px; }
          .hero-h1 { font-size: 28px; letter-spacing: -0.5px; }
          .hero-search-row { flex-direction: column; align-items: stretch; }
          .hero-search-or { display: none; }
          .hero-search-input { width: 100%; }
          .stats-row { gap: 20px; }
        }
      `}</style>

      {/* Hero */}
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

      {/* Search & Results */}
      <section className="hero-section" style={{ background: "#ffffff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Search box */}
          <div style={{ background: "#f5f6f8", borderRadius: 12, padding: 24, marginBottom: 40, border: "1px solid #e8eaed" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a202c", margin: "0 0 16px" }}>
              Domain Price Comparison — Check domain prices across marketplaces
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
                disabled={loading}
                style={{ padding: "11px 24px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, opacity: loading ? 0.8 : 1, whiteSpace: "nowrap" }}
              >
                {loading && (
                  <span style={{ width: 14, height: 14, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                )}
                {loading ? "Searching…" : "Use Bulk Search"}
              </button>
              <Link
                href={ROUTES.signup}
                style={{ padding: "11px 20px", border: "1px solid #0052cc", background: "#ffffff", color: "#0052cc", borderRadius: 10, fontWeight: 600, textDecoration: "none", fontSize: 14, textAlign: "center", whiteSpace: "nowrap" }}
              >
                Sign in for more
              </Link>
            </div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
              For example, try{" "}
              <button onClick={() => setQuery("forbes.com")} style={{ color: "#0052cc", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>forbes.com</button>
              {" "}or{" "}
              <button onClick={() => setQuery("techcrunch.com")} style={{ color: "#0052cc", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>techcrunch.com</button>
            </p>
          </div>

          {/* Stats */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 17, color: "#1a202c", margin: 0 }}>
              Total domains in our database:{" "}
              <strong style={{ color: "#0052cc", fontSize: 22 }}>40,000+</strong> and counting
            </p>
          </div>

          {/* Results */}
          {showResults && (
            <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #f5f6f8 100%)", borderRadius: 14, padding: 24, border: "1px solid #cce5ff" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 400 }}>
                  <thead>
                    <tr>
                      {["Domain", "Vendor", "Price", "DR", "Traffic"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "10px 0", fontWeight: 700, color: "#1a202c", borderBottom: "1px solid #e8eaed", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_ROWS.map((row) => (
                      <tr key={row.domain}>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5", fontWeight: 600, color: "#0052cc" }}>{row.domain}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5", color: "#6b7280", fontWeight: 500 }}>{row.vendor}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5", color: "#006621", fontWeight: 700 }}>{row.price}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5" }}>{row.dr}</td>
                        <td style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5" }}>{row.traffic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <Link
                  href={ROUTES.signup}
                  style={{ padding: "12px 28px", background: "#0052cc", color: "#ffffff", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", display: "inline-block" }}
                >
                  Show Full Catalog (40,000+ domains)
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Social proof stats */}
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
