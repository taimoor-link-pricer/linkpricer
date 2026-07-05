"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";

// Same self-contained token/style approach as app/dashboard/search/page.tsx.
const C = {
  bg: "#f6f7f9", ink: "#0f1620", ink2: "#374151", ink3: "#6b7280",
  mute: "#9ca3af", mute2: "#d1d5db", line: "#e5e7eb", line2: "#f3f4f6", bg3: "#f3f4f6",
  accent: "#0052cc", accent700: "#003a99", accent50: "#e6f2ff",
  good: "#0a8a4a", bad: "#b91c1c", warn: "#a35d00",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}
function priceFmt(usd: number | null): string {
  if (usd == null) return "—";
  return "$" + Math.round(usd).toLocaleString();
}
function withFee(p: number): number {
  return Math.max(Math.round(p * 1.15), Math.floor(p) + 1);
}
function countryFlag(code: string): string {
  const flags: Record<string, string> = { US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", CA: "🇨🇦", AU: "🇦🇺" };
  return flags[code] ?? "🌐";
}
function gradeStyle(grade: string): { background: string; color: string } {
  const g = (grade ?? "C")[0].toUpperCase();
  if (g === "A") return { background: "#e6f6ed", color: C.good };
  if (g === "B") return { background: "#fef3c7", color: C.warn };
  return { background: "#fee2e2", color: C.bad };
}
function matchStyle(pct: number): { background: string; color: string } {
  if (pct >= 60) return { background: "#e6f6ed", color: C.good };
  return { background: "#fce8c6", color: C.warn };
}

interface RelatedSite {
  domain: string;
  matchPct: number;
  country: string;
  lang: string;
  category: string;
  dr: number;
  drTrend: "up" | "flat" | "down";
  traffic: number;
  keywords: number;
  refDomains: number;
  grade: string;
  score: number;
  bestPrice: number | null;
}

interface Quota {
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
}

const FILTER_DEFS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  { key: "country", label: "Country", options: [{ value: "", label: "All countries" }, { value: "US", label: "United States" }, { value: "GB", label: "United Kingdom" }, { value: "DE", label: "Germany" }, { value: "CA", label: "Canada" }] },
  { key: "language", label: "Language", options: [{ value: "", label: "All languages" }, { value: "en", label: "English" }, { value: "de", label: "German" }, { value: "es", label: "Spanish" }] },
  { key: "minTraffic", label: "Traffic", options: [{ value: "", label: "Any traffic" }, { value: "1000", label: "1K+" }, { value: "10000", label: "10K+" }, { value: "100000", label: "100K+" }, { value: "1000000", label: "1M+" }] },
  { key: "drRange", label: "DR Range", options: [{ value: "", label: "Any DR" }, { value: "0-30", label: "0–30" }, { value: "30-60", label: "30–60" }, { value: "60-80", label: "60–80" }, { value: "80-100", label: "80+" }] },
  { key: "maxPrice", label: "Price Range", options: [{ value: "", label: "Any price" }, { value: "200", label: "Under $200" }, { value: "500", label: "Under $500" }, { value: "1000", label: "Under $1,000" }, { value: "5000", label: "Under $5,000" }] },
  { key: "category", label: "Niche", options: [{ value: "", label: "Any niche" }, { value: "News", label: "News" }, { value: "Technology", label: "Technology" }, { value: "Sports", label: "Sports" }, { value: "Finance", label: "Finance" }, { value: "Gaming", label: "Gaming" }] },
  { key: "grade", label: "Value Grade", options: [{ value: "", label: "Any grade" }, { value: "A+", label: "A+" }, { value: "A", label: "A" }, { value: "B+", label: "B+" }, { value: "B", label: "B" }] },
];

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function RelatedSitesPage() {
  const { loading } = useAuthContext();
  const [query, setQuery] = useState("football news");
  const [hideLinking, setHideLinking] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<RelatedSite[] | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [sortBy, setSortBy] = useState<"match" | "dr" | "traffic" | "price">("match");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/related-sites")
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => q && setQuota(q))
      .catch(() => {});
  }, []);

  function toggleFav(domain: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function handleSearch() {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    try {
      const parsedFilters: Record<string, string | number> = {};
      if (filters.country) parsedFilters.country = filters.country;
      if (filters.language) parsedFilters.language = filters.language;
      if (filters.minTraffic) parsedFilters.minTraffic = Number(filters.minTraffic);
      if (filters.maxPrice) parsedFilters.maxPrice = Number(filters.maxPrice);
      if (filters.category) parsedFilters.category = filters.category;
      if (filters.grade) parsedFilters.grade = filters.grade;
      if (filters.drRange) {
        const [lo, hi] = filters.drRange.split("-").map(Number);
        parsedFilters.minDr = lo;
        if (hi < 100) parsedFilters.maxDr = hi;
      }

      const res = await fetch("/api/related-sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filters: parsedFilters }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        if (data.remaining != null) setQuota({ used: data.used, remaining: data.remaining, limit: data.limit, resetsAt: data.resetsAt });
        setResults(null);
        return;
      }
      setResults(data.results);
      setQuota({ used: data.used, remaining: data.remaining, limit: data.limit, resetsAt: data.resetsAt });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const sorted = results
    ? [...results].sort((a, b) => {
        if (sortBy === "dr") return b.dr - a.dr;
        if (sortBy === "traffic") return b.traffic - a.traffic;
        if (sortBy === "price") return (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity);
        return b.matchPct - a.matchPct;
      })
    : [];

  const resetsLabel = quota
    ? new Date(quota.resetsAt).toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : "";

  return (
    <div style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* TopBar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
          <span style={{ marginLeft: 4, color: C.mute, fontSize: 12 }}>/ app / related sites</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link href="/dashboard/search" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: C.mute, textDecoration: "none" }}>Analyze</Link>
          <span style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, color: C.ink }}>Related Sites</span>
          <Link href="/dashboard/favorites" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: C.mute, textDecoration: "none" }}>Favorites</Link>
          <Link href="/dashboard/orders" style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: C.mute, textDecoration: "none" }}>Orders</Link>
        </nav>
      </header>

      {/* Hero card */}
      <div style={{ background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)", border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.mute, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
            🔍 Related Sites
          </div>
          {quota && (
            <span style={{ fontSize: 12.5, color: C.mute, whiteSpace: "nowrap" }}>
              ⏱ {quota.remaining} of {quota.limit} weekly searches left · resets {resetsLabel}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>Find sites by topic, not domain</h1>
        <p style={{ fontSize: 14, color: C.ink3, margin: "0 0 20px" }}>
          Describe what you want in plain language. We rank every site in the marketplace by how well it matches — same prices, conditions and one-click ordering as Domain Analysis.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", border: `1px solid ${C.line}`, borderRadius: 10, background: "#fff" }}>
            <span style={{ color: C.mute }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. football news, SaaS tools for startups, vegan recipes…"
              style={{ flex: 1, border: "none", outline: "none", padding: "12px 0", fontSize: 14, color: C.ink }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim() || (quota?.remaining ?? 1) <= 0}
            style={{
              padding: "0 22px", background: searching || (quota?.remaining ?? 1) <= 0 ? C.mute2 : C.accent, color: "#fff",
              border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            }}
          >
            🔍 {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: C.bad }}>{error}</div>}

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.mute }}>
            🔗 Sites that already link to you are detected using your saved backlink data (coming soon) — the toggle is ready, filtering logic isn&apos;t wired up yet.
          </span>
          <button
            onClick={() => setHideLinking((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer",
              fontSize: 12.5, color: C.ink2, fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 34, height: 18, borderRadius: 999, background: hideLinking ? C.accent : C.mute2, position: "relative", transition: "background 0.15s" }}>
              <span style={{ position: "absolute", top: 2, left: hideLinking ? 18 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
            </span>
            Hide sites that already link to me
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {FILTER_DEFS.map((f) => (
          <div key={f.key} style={{ flex: "1 1 120px", minWidth: 120 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: C.mute, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>{f.label}</label>
            <select
              value={filters[f.key] ?? ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", color: C.ink2, fontSize: 12.5, fontWeight: 600 }}
            >
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Results */}
      {results !== null && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0 }}>Related sites</h2>
            <span style={{ background: C.accent50, color: C.accent, borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{results.length} results</span>
            <span style={{ fontSize: 12, color: C.mute }}>ranked by semantic match</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: C.mute }}>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              style={{ padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", color: C.ink2, fontSize: 12.5, fontWeight: 600 }}
            >
              <option value="match">Best match</option>
              <option value="dr">Highest DR</option>
              <option value="traffic">Highest traffic</option>
              <option value="price">Lowest price</option>
            </select>
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.mute, fontSize: 13.5 }}>
              No sites matched &quot;{query}&quot; with the current filters. Try a broader topic or loosen a filter.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Site", "Match", "Actions", "Value", "Country", "DR", "Traffic", "Keywords", "Category"].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${C.line}`, background: C.line2, textAlign: "left", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, idx) => {
                    const gs = gradeStyle(row.grade);
                    const ms = matchStyle(row.matchPct);
                    const isFav = favorites.has(row.domain);
                    const isLast = idx === sorted.length - 1;
                    const td: React.CSSProperties = { padding: "12px 14px", borderBottom: isLast ? "none" : `1px solid ${C.line}`, fontSize: 13, verticalAlign: "middle" };
                    return (
                      <tr key={row.domain}>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent50, color: C.accent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {row.domain.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontFamily: C.mono, fontWeight: 600, color: C.ink, fontSize: 13 }}>{row.domain}</div>
                              <div style={{ fontSize: 11, color: C.ink3 }}>{row.lang} · {fmtNum(row.refDomains)} ref. domains</div>
                            </div>
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{ background: ms.background, color: ms.color, borderRadius: 6, padding: "3px 9px", fontWeight: 700, fontSize: 12 }}>{row.matchPct}% match</span>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              onClick={() => toggleFav(row.domain)}
                              style={{ background: "transparent", border: `1px solid ${isFav ? "#fca5a5" : C.line}`, borderRadius: 7, padding: "5px 8px", cursor: "pointer", fontSize: 15, lineHeight: 1, color: isFav ? C.bad : C.mute }}
                            >
                              {isFav ? "♥" : "♡"}
                            </button>
                            {row.bestPrice ? (
                              <button style={{ padding: "5px 12px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                                Buy {priceFmt(withFee(row.bestPrice))}
                              </button>
                            ) : (
                              <button disabled style={{ padding: "5px 12px", background: C.line2, color: C.mute, border: "none", borderRadius: 7, fontSize: 12, cursor: "not-allowed" }}>No pricing</button>
                            )}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{ background: gs.background, color: gs.color, borderRadius: 6, padding: "3px 9px", fontWeight: 700, fontSize: 13 }}>{row.grade} {row.score}</span>
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: 16 }}>{countryFlag(row.country)}</span>
                          <span style={{ marginLeft: 5, color: C.ink2, fontWeight: 600, fontSize: 12 }}>{row.country}</span>
                        </td>
                        <td style={td}>
                          <span style={{ fontWeight: 700, color: C.ink }}>{row.dr}</span>
                        </td>
                        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.traffic)}</td>
                        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.keywords)}</td>
                        <td style={td}>
                          <span style={{ background: C.line2, color: C.ink3, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{row.category}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {results === null && !searching && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Describe a topic above and click Search</div>
          <div style={{ fontSize: 13, color: C.mute }}>We&apos;ll rank every site in the marketplace by how well it matches.</div>
        </div>
      )}
    </div>
  );
}
