"use client";

// Ported verbatim from the confirmed design source: v1-interactive/related-sites.jsx
// (RS_FILTERS option sets, RSDropdown/RSToggle components, 4-step tour copy,
// skeleton loading state, low-relevance empty state — all taken directly from
// that file, not reconstructed from screenshots). Reuses the exact same
// expand-to-compare-offers row UX as Domain Analysis via
// components/dashboard/results-shared.tsx.
//
// Real backend: /api/related-sites queries the same catalog /api/analyze
// uses, with a real weekly quota. Relevance is keyword-based (not true
// semantic/embeddings — see the route file for why) so match quality won't
// match the reference screenshots exactly; that's a disclosed, known gap
// pending an embeddings API key decision, not something faked here.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ProfileMenu } from "@/components/dashboard/profile-menu";
import { C, ExpandedPanel, countryFlag, fmtNum, gradeStyle, hydrateRates, priceFmt, withFee, type CartItem, type Currency, type Offer } from "@/components/dashboard/results-shared";

// ── searchable dropdown (ported from RSDropdown) ────────────────────────────
interface DropdownOption { id: string; label: string }

function RSDropdown({
  label, value, options, onChange, minWidth = 128, align = "left", searchable = false,
}: {
  label?: string; value: string; options: DropdownOption[]; onChange: (id: string) => void;
  minWidth?: number; align?: "left" | "right"; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQ(""); return; }
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 20);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = options.find((o) => o.id === value) ?? options[0];
  const ql = q.trim().toLowerCase();
  const filtered = searchable && ql ? options.filter((o) => o.label.toLowerCase().includes(ql) || o.id.toLowerCase().includes(ql)) : options;

  return (
    <div ref={ref} style={{ position: "relative", flex: label ? "1 1 128px" : "0 0 auto", minWidth }}>
      {label && <div style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#fff", border: `1px solid ${open ? C.accent : C.line}`, borderRadius: 10, padding: "9px 11px", fontWeight: 600, fontSize: 13, color: C.ink2, cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current?.label}</span>
        <span style={{ color: C.mute, fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", zIndex: 40, [align]: 0, minWidth: "100%", width: "max-content", maxWidth: 260, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(15,22,32,0.12)", padding: 4, maxHeight: 300, overflow: "auto" }}>
          {searchable && (
            <div style={{ position: "sticky", top: -4, background: "#fff", padding: "2px 2px 6px", margin: "-2px -2px 2px", borderBottom: `1px solid ${C.line2}` }}>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${(label ?? "").toLowerCase()}…`}
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, color: C.ink, outline: "none" }}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 10px", fontSize: 12.5, color: C.mute, textAlign: "center" }}>No matches</div>
          ) : filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, width: "100%", padding: "8px 10px", borderRadius: 7, border: "none", background: value === o.id ? C.accent50 : "transparent", color: value === o.id ? C.accent700 : C.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" }}
            >
              <span>{o.label}</span>
              {value === o.id && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RSToggle({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" disabled={disabled} onClick={() => !disabled && onChange(!checked)} aria-pressed={checked}
      style={{ width: 38, height: 22, borderRadius: 999, border: "none", padding: 2, flexShrink: 0, background: disabled ? C.line : checked ? C.accent : C.mute2, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", transition: "background .15s" }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: checked ? "translateX(16px)" : "translateX(0)", transition: "transform .15s" }} />
    </button>
  );
}

// ── filter option sets (verbatim from RS_FILTERS) ────────────────────────────
const RS_FILTERS: Record<string, DropdownOption[]> = {
  country: [
    { id: "any", label: "All countries" }, { id: "US", label: "United States" }, { id: "GB", label: "United Kingdom" },
    { id: "CA", label: "Canada" }, { id: "AU", label: "Australia" }, { id: "IE", label: "Ireland" }, { id: "DE", label: "Germany" },
    { id: "FR", label: "France" }, { id: "ES", label: "Spain" }, { id: "IT", label: "Italy" }, { id: "PT", label: "Portugal" },
    { id: "NL", label: "Netherlands" }, { id: "BE", label: "Belgium" }, { id: "CH", label: "Switzerland" }, { id: "AT", label: "Austria" },
    { id: "SE", label: "Sweden" }, { id: "NO", label: "Norway" }, { id: "DK", label: "Denmark" }, { id: "FI", label: "Finland" },
    { id: "PL", label: "Poland" }, { id: "LT", label: "Lithuania" }, { id: "BR", label: "Brazil" }, { id: "MX", label: "Mexico" },
    { id: "IN", label: "India" }, { id: "JP", label: "Japan" }, { id: "CN", label: "China" }, { id: "KR", label: "South Korea" },
    { id: "SG", label: "Singapore" }, { id: "AE", label: "United Arab Emirates" }, { id: "ZA", label: "South Africa" }, { id: "NZ", label: "New Zealand" },
  ],
  language: [
    { id: "any", label: "All languages" }, { id: "EN", label: "English" }, { id: "ES", label: "Spanish" }, { id: "FR", label: "French" },
    { id: "DE", label: "German" }, { id: "IT", label: "Italian" }, { id: "PT", label: "Portuguese" }, { id: "NL", label: "Dutch" },
    { id: "SV", label: "Swedish" }, { id: "NO", label: "Norwegian" }, { id: "DA", label: "Danish" }, { id: "FI", label: "Finnish" },
    { id: "PL", label: "Polish" }, { id: "LT", label: "Lithuanian" }, { id: "RU", label: "Russian" }, { id: "TR", label: "Turkish" },
    { id: "AR", label: "Arabic" }, { id: "HI", label: "Hindi" }, { id: "JA", label: "Japanese" }, { id: "ZH", label: "Chinese" }, { id: "KO", label: "Korean" },
  ],
  dr: [
    { id: "any", label: "Any DR" }, { id: "30", label: "DR 30+" }, { id: "50", label: "DR 50+" }, { id: "70", label: "DR 70+" }, { id: "90", label: "DR 90+" },
  ],
  price: [
    { id: "any", label: "Any price" }, { id: "lt300", label: "Under $300" }, { id: "300-700", label: "$300 – $700" }, { id: "700-1200", label: "$700 – $1,200" }, { id: "gt1200", label: "$1,200+" },
  ],
  niche: [
    { id: "any", label: "Any niche" }, { id: "general", label: "General" }, { id: "gambling", label: "Gambling / iGaming" }, { id: "crypto", label: "Crypto" }, { id: "cbd", label: "CBD" },
  ],
  grade: [
    { id: "any", label: "Any grade" }, { id: "A+", label: "A+ only" }, { id: "A", label: "A & above" }, { id: "B+", label: "B+ & above" }, { id: "B", label: "B & above" },
  ],
};

const RS_PRICE_MAP: Record<string, { priceMin?: number; priceMax?: number }> = {
  any: {}, lt300: { priceMax: 300 }, "300-700": { priceMin: 300, priceMax: 700 }, "700-1200": { priceMin: 700, priceMax: 1200 }, gt1200: { priceMin: 1200 },
};

// Sortable columns mirror lib/search/catalog-search.ts's CatalogSortBy —
// "match" (Claude semantic rerank, the default) has no asc/desc concept, so
// its header just resets back to neutral rather than cycling a direction.
type SortableColumn = "match" | "dr" | "traffic" | "keywords";
type SortDir = "asc" | "desc";
const RS_COLUMNS: { label: string; sortKey?: SortableColumn }[] = [
  { label: "" }, { label: "Site" }, { label: "Match", sortKey: "match" }, { label: "Actions" },
  { label: "Value" }, { label: "Country" }, { label: "DR", sortKey: "dr" }, { label: "Traffic", sortKey: "traffic" },
  { label: "Keywords", sortKey: "keywords" }, { label: "Category" },
];
const PAGE_SIZE = 25;

const RS_DEFAULT_FILTERS = { country: "any", language: "any", dr: "any", price: "any", niche: "any", grade: "any" };

// ── tour (verbatim copy from RSTour/tourSteps) ───────────────────────────────
type TourStep = { selector: string; title: string; body: string };
const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="search"]', title: "Search by topic, not domain", body: 'Describe the kind of sites you want in plain language — e.g. "football news" — and we rank every site in the marketplace by how well it matches.' },
  { selector: '[data-tour="mysite"]', title: "Add your domain", body: "Enter your own website and we'll skip any site that already links to you — so you only see new referring domains, never the ones you've already got." },
  { selector: '[data-tour="filters"]', title: "Narrow it down", body: "Filter by country, language, traffic, DR, price, niche and value grade. The Country and Language menus are searchable — just start typing." },
  { selector: '[data-tour="results"]', title: "Compare & order, right here", body: "Every result shows its match score, metrics and live prices. Click any row to expand it, compare marketplaces side by side, save to Favorites, and order in one click." },
];

function Tour({ stepIndex, setStepIndex, onClose }: { stepIndex: number; setStepIndex: (i: number) => void; onClose: () => void }) {
  const step = TOUR_STEPS[stepIndex];
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    let raf: number;
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (el) { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector(step.selector);
      if (el) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - 248)); }
    }, 200);
    return () => clearTimeout(t);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = stepIndex === TOUR_STEPS.length - 1;
  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, background: C.accent, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 };
  const btnGhost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "transparent", color: C.ink2, border: `1px solid ${C.line}`, cursor: "pointer", fontWeight: 600, fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div style={{ position: "absolute", inset: 0 }} onClick={(e) => e.stopPropagation()} />
      {hole && <div style={{ position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 12, boxShadow: "0 0 0 9999px rgba(15,23,42,0.62)", border: `2px solid ${C.accent}`, pointerEvents: "none" }} />}
      {rect && (
        <div style={{ position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)", zIndex: 2002, background: "#fff", borderRadius: 14, boxShadow: "0 12px 32px rgba(15,23,42,0.22)", border: `1px solid ${C.line}`, padding: "16px 18px", width: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.accent }}>Step {stepIndex + 1} of {TOUR_STEPS.length}</div>
            <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.mute, fontSize: 16 }}>×</button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{step.title}</div>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>{TOUR_STEPS.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i === stepIndex ? C.accent : C.mute2 }} />)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {stepIndex > 0 && <button onClick={() => setStepIndex(stepIndex - 1)} style={btnGhost}>Back</button>}
              {!last ? <button onClick={() => setStepIndex(stepIndex + 1)} style={btnPrimary}>Next</button> : <button onClick={onClose} style={btnPrimary}>Got it</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── skeleton loading (ported from SkeletonResults) ───────────────────────────
function shimmer(w: number, h: number, r = 6): React.CSSProperties {
  return { width: w, height: h, borderRadius: r, background: "linear-gradient(90deg, #eef0f4 0%, #f6f7f9 50%, #eef0f4 100%)", backgroundSize: "200% 100%", animation: "lp-shimmer 1.4s infinite" };
}

function SkeletonResults() {
  return (
    <section style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <style>{`@keyframes lp-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 16, height: 16, border: "2px solid #cbd5e1", borderTopColor: C.accent, borderRadius: "50%", display: "inline-block", animation: "lp-shimmer 1s linear infinite" }} />
        <span style={{ fontSize: 13.5, color: C.mute, fontWeight: 600 }}>Scoring the marketplace against your search…</span>
      </header>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: `1px solid ${C.line2}` }}>
          <div style={shimmer(20, 20, 6)} />
          <div style={{ flex: 1 }}><div style={shimmer(150, 12, 4)} /><div style={{ ...shimmer(90, 10, 4), marginTop: 7 }} /></div>
          <div style={shimmer(80, 22, 999)} />
          <div style={shimmer(110, 30, 8)} />
          <div style={shimmer(52, 22, 6)} />
          <div style={shimmer(40, 12, 4)} />
          <div style={shimmer(36, 12, 4)} />
          <div style={shimmer(52, 12, 4)} />
          <div style={shimmer(96, 22, 999)} />
        </div>
      ))}
    </section>
  );
}

function EmptyState({ query, hasResults, activeFilterCount, onClear }: { query: string; hasResults: boolean; activeFilterCount: number; onClear: () => void }) {
  return (
    <section style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 16, padding: "56px 32px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 999, background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>🔍</div>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.ink }}>
        {hasResults ? "Only weak matches" : "No strong matches"}{query.trim() ? <> for &ldquo;{query.trim()}&rdquo;</> : null}
      </h3>
      <p style={{ margin: "8px auto 0", fontSize: 14, color: C.mute, maxWidth: 460, lineHeight: 1.55 }}>
        Try a broader phrase — e.g. <strong style={{ color: C.ink3 }}>&ldquo;sports news&rdquo;</strong> instead of a very specific one{activeFilterCount > 0 ? " — or relax your filters." : "."}
      </p>
      {activeFilterCount > 0 && (
        <button onClick={onClear} style={{ marginTop: 20, padding: "9px 16px", border: `1px solid ${C.line}`, borderRadius: 9, background: "#fff", color: C.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ✕ Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
        </button>
      )}
    </section>
  );
}

interface RelatedSite {
  domain: string; matchPct: number; country: string; lang: string; category: string;
  dr: number; drTrend: "up" | "flat" | "down"; traffic: number; keywords: number; refDomains: number;
  grade: string; score: number; bestPrice: number | null; yourPrice: number | null; offers: Offer[];
}
interface Quota { used: number; remaining: number; limit: number; resetsAt: string }

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f6f7f9" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

// ── row (mirrors DomainRow, but with the extra Match column) ─────────────────
function ResultRow({ row, isLast, expanded, onToggle, isFav, onFav, currency, onAddToCart }: {
  row: RelatedSite; isLast: boolean; expanded: boolean; onToggle: () => void; isFav: boolean; onFav: () => void; currency: Currency; onAddToCart: (item: CartItem) => void;
}) {
  const gs = gradeStyle(row.grade);
  const matchStyle = row.matchPct >= 60 ? { background: "#e6f6ed", color: C.good } : { background: "#fce8c6", color: C.warn };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: isLast && !expanded ? "none" : `1px solid ${C.line}`, fontSize: 13, verticalAlign: "middle" };

  return (
    <>
      <tr>
        <td style={{ ...td, width: 36, textAlign: "center", cursor: "pointer" }} onClick={onToggle}>
          <span style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", color: C.ink3 }}>▸</span>
        </td>
        <td style={td} onClick={onToggle} onKeyDown={undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent50, color: C.accent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.domain.slice(0, 2).toUpperCase()}</div>
            <div><div style={{ fontFamily: C.mono, fontWeight: 600, color: C.ink, fontSize: 13 }}>{row.domain}</div><div style={{ fontSize: 11, color: C.ink3 }}>{row.lang} · {fmtNum(row.refDomains)} ref. domains</div></div>
          </div>
        </td>
        <td style={td}><span style={{ background: matchStyle.background, color: matchStyle.color, borderRadius: 6, padding: "3px 9px", fontWeight: 700, fontSize: 12 }}>{row.matchPct}% match</span></td>
        <td style={td}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={onFav} style={{ background: "transparent", border: `1px solid ${isFav ? "#fca5a5" : C.line}`, borderRadius: 7, padding: "5px 8px", cursor: "pointer", fontSize: 15, lineHeight: 1, color: isFav ? C.bad : C.mute }}>{isFav ? "♥" : "♡"}</button>
            {row.bestPrice ? (
              <button onClick={() => onAddToCart({ domain: row.domain, dr: row.dr, traffic: row.traffic, offerName: row.offers[0]?.name ?? "Marketplace", offerType: row.offers[0]?.type ?? "DB", price: row.bestPrice ?? 0, delivery: row.offers[0]?.delivery ?? 14, link: row.offers[0]?.link ?? "Dofollow" })} style={{ padding: "5px 12px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Buy {priceFmt(withFee(row.bestPrice), currency)}
              </button>
            ) : (
              <button disabled style={{ padding: "5px 12px", background: C.line2, color: C.mute, border: "none", borderRadius: 7, fontSize: 12, cursor: "not-allowed" }}>No pricing</button>
            )}
          </div>
        </td>
        <td style={td}><span style={{ background: gs.background, color: gs.color, borderRadius: 6, padding: "3px 9px", fontWeight: 700, fontSize: 13 }}>{row.grade} {row.score}</span></td>
        <td style={td}><span style={{ fontSize: 16 }}>{countryFlag(row.country)}</span><span style={{ marginLeft: 5, color: C.ink2, fontWeight: 600, fontSize: 12 }}>{row.country}</span></td>
        <td style={td}><span style={{ fontWeight: 700, color: C.ink }}>{row.dr}</span></td>
        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.traffic)}</td>
        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.keywords)}</td>
        <td style={td}><span style={{ background: C.line2, color: C.ink3, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{row.category}</span></td>
      </tr>
      {expanded && (
        <tr><td colSpan={10} style={{ padding: 0 }}><ExpandedPanel domainData={row} currency={currency} onAddToCart={onAddToCart} /></td></tr>
      )}
    </>
  );
}

export default function RelatedSitesPage() {
  const { loading } = useAuthContext();
  const [query, setQuery] = useState("football news");
  const [ownSite, setOwnSite] = useState("");
  const [hideLinked, setHideLinked] = useState(true);
  const [filters, setFilters] = useState(RS_DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortableColumn>("match");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<RelatedSite[]>([]);
  // Traffic used to be a fixed-bucket dropdown (10K+/100K+/...) applied as a
  // SQL pre-filter, so it silently zeroed out results for any query whose
  // matches don't clear that bucket (median catalog traffic is ~100 —
  // "10K+" alone excludes over 96% of all domains). Instead this is now a
  // client-side threshold bounded by the *current* result set's actual
  // min/max traffic, so it can never filter everything out.
  const [trafficMin, setTrafficMin] = useState(0);
  const trafficBounds = useMemo(() => {
    if (results.length === 0) return { min: 0, max: 0 };
    const vals = results.map((r) => r.traffic || 0);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [results]);
  const filteredResults = useMemo(
    () => (trafficMin > trafficBounds.min ? results.filter((r) => (r.traffic || 0) >= trafficMin) : results),
    [results, trafficMin, trafficBounds.min]
  );
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lowRelevance, setLowRelevance] = useState(false);
  const [degradedAhrefs, setDegradedAhrefs] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const hasSite = !!ownSite.trim();
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== "any").length + (trafficMin > trafficBounds.min ? 1 : 0);

  useEffect(() => {
    hydrateRates();
    fetch("/api/related-sites").then((r) => (r.ok ? r.json() : null)).then((q) => q && setQuota(q)).catch(() => {});
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setFavorites(new Set((data.favorites as { domain: string }[]).map((f) => f.domain))))
      .catch(() => {});
  }, []);

  async function runSearch(overrides?: { sortBy?: SortableColumn; sortDir?: SortDir; countAsSearch?: boolean }) {
    if (!query.trim() || searching) return;
    const useSortBy = overrides?.sortBy ?? sortBy;
    const useSortDir = overrides?.sortDir ?? sortDir;
    const countAsSearch = overrides?.countAsSearch ?? true;
    setSearching(true);
    setError(null);
    try {
      const parsedFilters: Record<string, string | number> = {};
      if (filters.country !== "any") parsedFilters.country = filters.country;
      if (filters.language !== "any") parsedFilters.language = filters.language;
      if (filters.dr !== "any") parsedFilters.minDr = Number(filters.dr);
      if (filters.niche !== "any") parsedFilters.category = filters.niche;
      if (filters.grade !== "any") parsedFilters.grade = filters.grade;
      const priceRange = RS_PRICE_MAP[filters.price];
      if (priceRange.priceMin != null) parsedFilters.minPrice = priceRange.priceMin;
      if (priceRange.priceMax != null) parsedFilters.maxPrice = priceRange.priceMax;

      const res = await fetch("/api/related-sites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          filters: parsedFilters,
          ownSite: hasSite ? ownSite.trim() : undefined,
          hideLinked: hasSite && hideLinked,
          sortBy: useSortBy,
          sortDir: useSortDir,
          countAsSearch,
        }),
      });
      const data = await res.json();
      setHasSearched(true);
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        if (data.remaining != null) setQuota({ used: data.used, remaining: data.remaining, limit: data.limit, resetsAt: data.resetsAt });
        setResults([]);
        return;
      }
      setResults(data.results);
      // Reset the traffic slider to this query's actual floor — each search
      // has a different result set, so a threshold carried over from the
      // previous query could zero out the new one.
      const newTrafficVals = (data.results as RelatedSite[]).map((r) => r.traffic || 0);
      setTrafficMin(newTrafficVals.length ? Math.min(...newTrafficVals) : 0);
      setLowRelevance(data.lowRelevance ?? false);
      setDegradedAhrefs(data.degradedAhrefs ?? false);
      setQuota({ used: data.used, remaining: data.remaining, limit: data.limit, resetsAt: data.resetsAt });
      setPage(1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleSearchClick() {
    setSortBy("match");
    setSortDir("desc");
    runSearch({ sortBy: "match", sortDir: "desc", countAsSearch: true });
  }

  function cycleColumnSort(col: Exclude<SortableColumn, "match">) {
    if (searching || !hasSearched) return;
    let nextBy: SortableColumn = "match";
    let nextDir: SortDir = "desc";
    if (sortBy !== col) {
      nextBy = col; nextDir = "desc";
    } else if (sortDir === "desc") {
      nextBy = col; nextDir = "asc";
    } // else: already asc on this column -> falls back to "match" (neutral)
    setSortBy(nextBy);
    setSortDir(nextDir);
    runSearch({ sortBy: nextBy, sortDir: nextDir, countAsSearch: false });
  }

  function resetToMatchSort() {
    if (searching || !hasSearched || sortBy === "match") return;
    setSortBy("match");
    setSortDir("desc");
    runSearch({ sortBy: "match", sortDir: "desc", countAsSearch: false });
  }

  function exportCsv() {
    if (filteredResults.length === 0) return;
    const headers = ["Domain", "Match %", "Country", "Language", "Category", "DR", "Traffic", "Keywords", "Ref Domains", "Grade", "Score", "Best Price"];
    const escape = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredResults.map((r) => [r.domain, r.matchPct, r.country, r.lang, r.category, r.dr, r.traffic, r.keywords, r.refDomains, r.grade, r.score, r.bestPrice].map(escape).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `related-sites-${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearFilters() { setFilters(RS_DEFAULT_FILTERS); setTrafficMin(trafficBounds.min); }
  function handleTrafficChange(v: number) { setTrafficMin(v); setPage(1); }
  function toggleRow(domain: string) { setExpanded((prev) => { const n = new Set(prev); n.has(domain) ? n.delete(domain) : n.add(domain); return n; }); }
  function toggleFav(row: RelatedSite) {
    const wasFav = favorites.has(row.domain);
    setFavorites((prev) => { const n = new Set(prev); wasFav ? n.delete(row.domain) : n.add(row.domain); return n; });
    if (wasFav) {
      fetch(`/api/favorites?domain=${encodeURIComponent(row.domain)}`, { method: "DELETE" }).catch(() => {});
    } else {
      fetch("/api/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: row.domain, dr: row.dr, traffic: row.traffic, category: row.category }),
      }).catch(() => {});
    }
  }
  function addToCart(item: CartItem) { setCartItems((prev) => [...prev, item]); }

  // Sorting now happens server-side (lib/search/catalog-search.ts) — `results`
  // already arrives in the correct order for the active sortBy/sortDir, and
  // filtering by the traffic slider preserves that order (Array.filter is
  // stable). Pagination is a pure client-side slice over `filteredResults`,
  // so CSV export (which uses the same array) always matches the same
  // sequence the table is showing, page or no page.
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const pageResults = filteredResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <LoadingSpinner />;

  const resetsLabel = quota ? new Date(quota.resetsAt).toLocaleString("en-US", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "";

  return (
    <div style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {tourActive && <Tour stepIndex={tourStep} setStepIndex={setTourStep} onClose={() => setTourActive(false)} />}

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
          <ProfileMenu />
        </nav>
      </header>

      <section style={{ background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)", border: `1px solid ${C.line}`, borderRadius: 16, padding: 28, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.mute, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>🔍 Related Sites</div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: C.ink }}>Find sites by topic, not domain</h1>
            <p style={{ margin: "6px 0 0", color: C.ink3, fontSize: 14, maxWidth: 560 }}>Describe what you want in plain language. We rank every site in the marketplace by how well it matches — same prices, conditions and one-click ordering as Domain Analysis.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <button onClick={() => { setTourStep(0); setTourActive(true); }} style={{ padding: "7px 14px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", color: C.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ How to use this page</button>
            {quota && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12, color: C.ink3, whiteSpace: "nowrap" }}>
                ⏱ <span><strong style={{ color: C.ink, fontWeight: 700 }}>{quota.remaining}</strong> of {quota.limit} weekly searches left</span>
                <span style={{ color: C.line }}>·</span>
                <span style={{ color: C.mute }}>resets {resetsLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div data-tour="search" style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 16, color: C.mute, pointerEvents: "none" }}>🔍</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearchClick()} placeholder="Describe the sites you want, e.g. football news" style={{ width: "100%", height: 52, padding: "0 16px 0 46px", fontSize: 16, fontWeight: 500, border: `1px solid ${C.line}`, borderRadius: 10, outline: "none", color: C.ink }} />
          </div>
          <button onClick={handleSearchClick} disabled={searching || (quota?.remaining ?? 1) <= 0} style={{ height: 52, padding: "0 26px", fontSize: 15.5, background: searching || (quota?.remaining ?? 1) <= 0 ? C.mute2 : C.accent, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: searching ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            {searching ? "Searching…" : "🔍 Search"}
          </button>
        </div>

        {error && <div style={{ marginTop: 10, fontSize: 12.5, color: C.bad }}>{error}</div>}
        {quota && quota.remaining <= 0 && <div style={{ marginTop: 10, fontSize: 12.5, color: C.warn }}>Weekly limit reached — contact support if you need to increase it.</div>}

        <div data-tour="mysite" style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 240, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 14, color: C.mute2, fontSize: 13, pointerEvents: "none" }}>🔗</span>
            <input value={ownSite} onChange={(e) => setOwnSite(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearchClick()} placeholder="Your website (optional), e.g. mysite.com" style={{ width: "100%", height: 42, padding: "0 14px 0 40px", fontSize: 13, fontFamily: C.mono, border: `1px solid ${C.line}`, borderRadius: 10, outline: "none", color: C.ink }} />
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: hasSite ? "pointer" : "default", fontSize: 13.5, fontWeight: 600, color: hasSite ? C.ink2 : C.mute }}>
            <RSToggle checked={hideLinked && hasSite} disabled={!hasSite} onChange={(v) => setHideLinked(v)} />
            Hide sites that already link to me
            {!hasSite && <span style={{ fontWeight: 500, color: C.mute2, fontSize: 12.5 }}>— add your site to enable</span>}
          </label>
        </div>

        {hasSearched && hasSite && hideLinked && degradedAhrefs && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.warn }}>
            ⚠ Exclusion data temporarily unavailable — results below may include sites that already link to you.
          </div>
        )}
      </section>

      <section data-tour="filters" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <RSDropdown label="Country" value={filters.country} options={RS_FILTERS.country} onChange={(v) => setFilters((f) => ({ ...f, country: v }))} searchable />
          <RSDropdown label="Language" value={filters.language} options={RS_FILTERS.language} onChange={(v) => setFilters((f) => ({ ...f, language: v }))} searchable />
          <div style={{ flex: "1 1 180px", minWidth: 180 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>Traffic</span>
              <span style={{ color: C.ink3, textTransform: "none", fontWeight: 600 }}>
                {trafficBounds.max > trafficBounds.min ? `${fmtNum(trafficMin)}+` : ""}
              </span>
            </div>
            <input
              type="range"
              min={trafficBounds.min}
              max={trafficBounds.max}
              value={Math.min(Math.max(trafficMin, trafficBounds.min), trafficBounds.max)}
              disabled={results.length === 0 || trafficBounds.max <= trafficBounds.min}
              onChange={(e) => handleTrafficChange(Number(e.target.value))}
              title={
                results.length === 0
                  ? "Run a search to enable this filter"
                  : `Range reflects this search's ${results.length} result${results.length === 1 ? "" : "s"}: ${fmtNum(trafficBounds.min)} – ${fmtNum(trafficBounds.max)} monthly organic traffic`
              }
              style={{ width: "100%", height: 34, cursor: results.length === 0 || trafficBounds.max <= trafficBounds.min ? "not-allowed" : "pointer" }}
            />
          </div>
          <RSDropdown label="DR range" value={filters.dr} options={RS_FILTERS.dr} onChange={(v) => setFilters((f) => ({ ...f, dr: v }))} />
          <RSDropdown label="Price range" value={filters.price} options={RS_FILTERS.price} onChange={(v) => setFilters((f) => ({ ...f, price: v }))} />
          <RSDropdown label="Niche" value={filters.niche} options={RS_FILTERS.niche} onChange={(v) => setFilters((f) => ({ ...f, niche: v }))} />
          <RSDropdown label="Value grade" value={filters.grade} options={RS_FILTERS.grade} onChange={(v) => setFilters((f) => ({ ...f, grade: v }))} />
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ height: 38, padding: "0 14px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", color: C.ink2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✕ Clear ({activeFilterCount})</button>
          )}
        </div>
      </section>

      {!hasSearched && !searching ? (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Describe a topic above and click Search</div>
          <div style={{ fontSize: 13, color: C.mute }}>We&apos;ll rank every site in the marketplace by how well it matches.</div>
        </div>
      ) : searching ? (
        <SkeletonResults />
      ) : results.length === 0 || lowRelevance ? (
        <EmptyState query={query} hasResults={results.length > 0} activeFilterCount={activeFilterCount} onClear={clearFilters} />
      ) : (
        <section data-tour="results" style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Related sites</h2>
              <span style={{ background: C.accent50, color: C.accent, borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{filteredResults.length} {filteredResults.length === 1 ? "result" : "results"}</span>
              <span style={{ fontSize: 12, color: C.mute }}>{sortBy === "match" ? "ranked by semantic match" : `sorted by ${sortBy} (${sortDir === "desc" ? "high to low" : "low to high"})`}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={exportCsv} title="Export all results as CSV" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", color: C.ink2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                ⬇ Export CSV
              </button>
            </div>
          </header>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr>
                  {RS_COLUMNS.map((col) => {
                    const isSortable = !!col.sortKey;
                    const isActive = isSortable && sortBy === col.sortKey;
                    const indicator = col.sortKey
                      ? col.sortKey === "match"
                        ? sortBy === "match" ? "●" : ""
                        : isActive ? (sortDir === "desc" ? " ▼" : " ▲") : ""
                      : "";
                    return (
                      <th
                        key={col.label || "expand"}
                        onClick={isSortable ? () => (col.sortKey === "match" ? resetToMatchSort() : cycleColumnSort(col.sortKey as Exclude<SortableColumn, "match">)) : undefined}
                        style={{ padding: "11px 14px", fontSize: 11, fontWeight: 700, color: isActive ? C.accent700 : C.ink3, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${C.line}`, background: isActive ? C.accent50 : C.line2, textAlign: "left", whiteSpace: "nowrap", cursor: isSortable ? "pointer" : "default", userSelect: "none" }}
                      >
                        {col.label}{indicator}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageResults.map((row, idx) => (
                  <ResultRow
                    key={row.domain}
                    row={row}
                    isLast={idx === pageResults.length - 1}
                    expanded={expanded.has(row.domain)}
                    onToggle={() => toggleRow(row.domain)}
                    isFav={favorites.has(row.domain)}
                    onFav={() => toggleFav(row)}
                    currency="USD"
                    onAddToCart={addToCart}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 20px", borderTop: `1px solid ${C.line}` }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "6px 12px", border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", color: page <= 1 ? C.mute2 : C.ink2, fontSize: 12.5, fontWeight: 600, cursor: page <= 1 ? "not-allowed" : "pointer" }}>← Prev</button>
              <span style={{ fontSize: 12.5, color: C.ink3, fontWeight: 600 }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "6px 12px", border: `1px solid ${C.line}`, borderRadius: 7, background: "#fff", color: page >= totalPages ? C.mute2 : C.ink2, fontSize: 12.5, fontWeight: 600, cursor: page >= totalPages ? "not-allowed" : "pointer" }}>Next →</button>
            </div>
          )}
        </section>
      )}
      {cartItems.length > 0 && (
        <div style={{ position: "fixed", bottom: 24, right: 32, background: C.accent, color: "#fff", borderRadius: 99, padding: "10px 20px", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,82,204,0.3)" }}>
          🛒 {cartItems.length} in cart
        </div>
      )}
    </div>
  );
}
