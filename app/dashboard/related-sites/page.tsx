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
import { useEffect, useRef, useState } from "react";
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

// ── dual-thumb range slider ───────────────────────────────────────────────────
// Two overlapping native <input type="range"> elements sharing one track — the
// standard CSS-only technique for a min/max range slider (real drag physics,
// keyboard/accessibility support, no custom hit-testing). The shared
// `lp-range-thumb` class (styled once, globally, in the page's <style> tag)
// makes each input's own track transparent/click-through so only its thumb is
// interactive; the visible track + filled segment are drawn separately below.
function DualRangeSlider({
  label, bounds, valueMin, valueMax, onChange, formatValue, title,
}: {
  label: string;
  // `bounds` only sizes the drag range of the slider thumbs — it's a fixed,
  // generous default (see RS_TRAFFIC_BOUNDS etc. below), not something
  // derived from search results. The number inputs beside the slider accept
  // any value, including ones outside `bounds`, so the slider never caps
  // what the user can actually search for.
  bounds: { min: number; max: number };
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  formatValue: (v: number) => string;
  title: string;
}) {
  const span = Math.max(1, bounds.max - bounds.min);
  const clampPct = (v: number) => Math.min(100, Math.max(0, ((v - bounds.min) / span) * 100));
  const minPct = clampPct(valueMin);
  const maxPct = clampPct(valueMax);
  return (
    <div style={{ flex: "1 1 220px", minWidth: 220 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.mute, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ position: "relative", height: 20, marginBottom: 8 }} title={title}>
        <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4, borderRadius: 2, background: C.line }} />
        <div style={{ position: "absolute", top: 8, height: 4, borderRadius: 2, background: C.accent, left: `${minPct}%`, right: `${100 - maxPct}%` }} />
        <input
          type="range"
          className="lp-range-thumb"
          min={bounds.min}
          max={bounds.max}
          value={Math.min(Math.max(valueMin, bounds.min), bounds.max)}
          onChange={(e) => onChange(Math.min(Number(e.target.value), valueMax), valueMax)}
          style={{ position: "absolute", width: "100%", height: 20, top: 0, margin: 0, cursor: "pointer" }}
        />
        <input
          type="range"
          className="lp-range-thumb"
          min={bounds.min}
          max={bounds.max}
          value={Math.min(Math.max(valueMax, bounds.min), bounds.max)}
          onChange={(e) => onChange(valueMin, Math.max(Number(e.target.value), valueMin))}
          style={{ position: "absolute", width: "100%", height: 20, top: 0, margin: 0, cursor: "pointer" }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={valueMin}
          onChange={(e) => onChange(Number(e.target.value), valueMax)}
          style={{ width: 0, flex: 1, minWidth: 0, padding: "5px 7px", borderRadius: 6, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink2 }}
        />
        <span style={{ color: C.mute2, fontSize: 12 }}>–</span>
        <input
          type="number"
          value={valueMax}
          onChange={(e) => onChange(valueMin, Number(e.target.value))}
          style={{ width: 0, flex: 1, minWidth: 0, padding: "5px 7px", borderRadius: 6, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink2 }}
        />
      </div>
      <div style={{ marginTop: 3, color: C.ink3, fontSize: 11, fontWeight: 600 }}>{formatValue(valueMin)} – {formatValue(valueMax)}</div>
    </div>
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
  niche: [
    { id: "any", label: "Any niche" }, { id: "general", label: "General" }, { id: "gambling", label: "Gambling / iGaming" }, { id: "crypto", label: "Crypto" }, { id: "cbd", label: "CBD" },
  ],
  grade: [
    { id: "any", label: "Any grade" }, { id: "A+", label: "A+ only" }, { id: "A", label: "A & above" }, { id: "B+", label: "B+ & above" }, { id: "B", label: "B & above" },
  ],
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

const RS_DEFAULT_FILTERS = { country: "any", language: "any", niche: "any", grade: "any" };

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
  dr: number; drUpdatedAt: string | null; drTrend: "up" | "flat" | "down"; traffic: number; keywords: number; refDomains: number;
  grade: string; score: number; bestPrice: number | null; yourPrice: number | null; offers: Offer[];
}
interface Quota { used: number; remaining: number; limit: number; resetsAt: string }

// DR hover tooltip text — domain_rating_updated_at is only ever set by the
// live ahrefs-dr.ts job on a confirmed fetch (see lib/db/schema.ts), so a
// null here means this domain hasn't been through that job's ~30-day rolling
// cycle yet, not that the DR itself is wrong.
function drUpdatedText(updatedAt: string | null): string {
  if (!updatedAt) return "DR freshness data not yet available for this domain";
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "DR freshness data not yet available for this domain";
  const formatted = d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  return `Last updated ${formatted}`;
}

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f6f7f9" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}

// ── row (mirrors DomainRow, but with the extra Match column) ─────────────────
function ResultRow({ row, isLast, expanded, onToggle, isFav, onFav, currency, onAddToCart, tableWrapWidth }: {
  row: RelatedSite; isLast: boolean; expanded: boolean; onToggle: () => void; isFav: boolean; onFav: () => void; currency: Currency; onAddToCart: (item: CartItem) => void;
  tableWrapWidth?: number | null;
}) {
  const gs = gradeStyle(row.grade);
  const matchStyle = row.matchPct >= 60 ? { background: "#e6f6ed", color: C.good } : { background: "#fce8c6", color: C.warn };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: isLast && !expanded ? "none" : `1px solid ${C.line}`, fontSize: 13, verticalAlign: "middle" };

  const [drTipOpen, setDrTipOpen] = useState(false);
  const [drTipPlacement, setDrTipPlacement] = useState<"above" | "below">("below");
  const [drTipCoords, setDrTipCoords] = useState({ top: 0, left: 0 });
  const drRef = useRef<HTMLSpanElement>(null);
  const drCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fixed-position (not absolute) so this escapes the results table's
  // horizontally-scrolling wrapper — that wrapper's overflow-x: auto forces
  // overflow-y to clip too (per the CSS spec), which would silently hide an
  // absolutely-positioned tooltip whenever it poked past the wrapper's top
  // or bottom edge (i.e. for the first or last row).
  function showDrTip() {
    if (drCloseTimer.current) { clearTimeout(drCloseTimer.current); drCloseTimer.current = null; }
    const el = drRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const placement = window.innerHeight - r.bottom < 70 ? "above" : "below";
      setDrTipPlacement(placement);
      setDrTipCoords({
        top: placement === "below" ? r.bottom + 6 : r.top - 6,
        left: Math.min(r.left, window.innerWidth - 220),
      });
    }
    setDrTipOpen(true);
  }

  // Closes on a short delay instead of immediately — there's a real gap
  // between the DR number and the tooltip box, so the cursor briefly hovers
  // nothing while moving from one to the other. showDrTip() cancels this if
  // the mouse re-enters either element in time.
  function scheduleHideDrTip() {
    if (drCloseTimer.current) clearTimeout(drCloseTimer.current);
    drCloseTimer.current = setTimeout(() => setDrTipOpen(false), 200);
  }

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
        <td style={td}>
          <span
            ref={drRef}
            style={{ fontWeight: 700, color: C.ink }}
            onMouseEnter={showDrTip}
            onMouseLeave={scheduleHideDrTip}
          >
            {row.dr}
          </span>
          {drTipOpen && (
            <div
              onMouseEnter={showDrTip}
              onMouseLeave={scheduleHideDrTip}
              style={{
                position: "fixed",
                top: drTipCoords.top,
                left: drTipCoords.left,
                transform: drTipPlacement === "above" ? "translateY(-100%)" : undefined,
                zIndex: 9999,
                width: 210,
                background: C.ink,
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 600,
                padding: "8px 10px",
                borderRadius: 8,
                boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                lineHeight: 1.4,
              }}
            >
              <div>{drUpdatedText(row.drUpdatedAt)}</div>
              <div style={{ marginTop: 2 }}>
                Source:{" "}
                <a
                  href="https://ahrefs.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "#8ab4ff", textDecoration: "underline", fontWeight: 700 }}
                >
                  Ahrefs
                </a>
              </div>
            </div>
          )}
        </td>
        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.traffic)}</td>
        <td style={{ ...td, color: C.ink2 }}>{fmtNum(row.keywords)}</td>
        <td style={{ ...td, maxWidth: 130 }}><span title={row.category} style={{ display: "inline-block", maxWidth: 110, background: C.line2, color: C.ink3, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{row.category}</span></td>
      </tr>
      {expanded && (
        <tr><td colSpan={10} style={{ padding: 0 }}><ExpandedPanel domainData={row} currency={currency} onAddToCart={onAddToCart} maxWidth={tableWrapWidth} /></td></tr>
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
  // Traffic/DR/price used to be fixed-bucket dropdowns (10K+/100K+/...,
  // DR 30+/50+/70+/90+, $300-$700) applied as SQL pre-filters, so any query
  // whose matches didn't clear that bucket silently returned nothing.
  // They're real min-max ranges now — search options the customer sets
  // however they like (drag the slider or just type a number), not
  // something clamped to whatever a prior search happened to return. The
  // slider's drag range (RS_*_BOUNDS below) is just a sane default width;
  // the number inputs beside it accept any value, including ones outside
  // that range.
  const RS_TRAFFIC_BOUNDS = { min: 0, max: 5_000_000 };
  const RS_DR_BOUNDS = { min: 0, max: 100 };
  const RS_PRICE_BOUNDS = { min: 0, max: 10_000 };
  const [trafficMin, setTrafficMin] = useState(RS_TRAFFIC_BOUNDS.min);
  const [trafficMax, setTrafficMax] = useState(RS_TRAFFIC_BOUNDS.max);
  const trafficBounds = RS_TRAFFIC_BOUNDS;
  const [drMin, setDrMin] = useState(RS_DR_BOUNDS.min);
  const [drMax, setDrMax] = useState(RS_DR_BOUNDS.max);
  const drBounds = RS_DR_BOUNDS;
  // NOTE for whoever picks up ticket #5 (splitting guest-post vs.
  // link-insertion pricing): this filters on `bestPrice` — currently the
  // single, undifferentiated marketplace/supplier price (see
  // catalog-search.ts's `best_price` subquery, which only reads the base
  // min_price columns, not link_insertion_min_price) — once that split
  // lands, this will need a second range or an explicit toggle for which
  // price type it targets.
  const [priceMin, setPriceMin] = useState(RS_PRICE_BOUNDS.min);
  const [priceMax, setPriceMax] = useState(RS_PRICE_BOUNDS.max);
  const priceBounds = RS_PRICE_BOUNDS;
  // Whether the user has actually dragged a slider — deliberately NOT
  // derived from comparing e.g. drMin > drBounds.min: once a filter is
  // applied server-side, `results` (and therefore drBounds, which is a
  // useMemo off `results`) already sits inside that filter, so the values
  // trivially equal their own bounds again on the very next render and a
  // bounds-comparison "is this active" check would silently go blind after
  // one search. These flags are the actual source of truth for what to send
  // as search options on the next request; they're cleared only by Clear.
  const [trafficFilterActive, setTrafficFilterActive] = useState(false);
  const [drFilterActive, setDrFilterActive] = useState(false);
  const [priceFilterActive, setPriceFilterActive] = useState(false);
  // Traffic/DR/price are now sent to the server as real SQL filters (see
  // runSearch) instead of trimmed client-side after the fact, so `results`
  // already reflects them by the time it lands here.
  const filteredResults = results;
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

  // This table has an explicit minWidth:1180 for its extra Match column, so
  // its horizontally-scrolling wrapper is *routinely* narrower than the
  // table itself — an expanded row's price-comparison cards are a colSpan
  // cell inside that same table, so they'd otherwise inherit the full
  // 1180px+ width instead of what's actually visible. See the matching
  // tableWrapWidth comment in dashboard/search/page.tsx (same bug, same fix).
  //
  // A callback ref, not useRef+useEffect(,[]) — the table (and this wrapper)
  // only exists once a search has actually returned results, well after this
  // component's own first mount, so a mount-only effect would forever see
  // tableWrapRef.current as null from that first (table-less) render and
  // never re-check it. The callback form re-fires the moment the wrapper div
  // actually mounts, whenever that happens to be.
  const [tableWrapEl, setTableWrapEl] = useState<HTMLDivElement | null>(null);
  const [tableWrapWidth, setTableWrapWidth] = useState<number | null>(null);
  useEffect(() => {
    if (!tableWrapEl) return;
    const update = () => setTableWrapWidth(tableWrapEl.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(tableWrapEl);
    return () => ro.disconnect();
  }, [tableWrapEl]);

  const hasSite = !!ownSite.trim();
  const activeFilterCount =
    Object.entries(filters).filter(([, v]) => v !== "any").length +
    (trafficFilterActive ? 1 : 0) +
    (drFilterActive ? 1 : 0) +
    (priceFilterActive ? 1 : 0);

  useEffect(() => {
    hydrateRates();
    fetch("/api/related-sites").then((r) => (r.ok ? r.json() : null)).then((q) => q && setQuota(q)).catch(() => {});
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setFavorites(new Set((data.favorites as { domain: string }[]).map((f) => f.domain))))
      .catch(() => {});
  }, []);

  async function runSearch(overrides?: {
    sortBy?: SortableColumn; sortDir?: SortDir; countAsSearch?: boolean;
    trafficMin?: number; trafficMax?: number; drMin?: number; drMax?: number; priceMin?: number; priceMax?: number;
    filters?: typeof RS_DEFAULT_FILTERS;
    trafficFilterActive?: boolean; drFilterActive?: boolean; priceFilterActive?: boolean;
  }) {
    if (!query.trim() || searching) return;
    const useSortBy = overrides?.sortBy ?? sortBy;
    const useSortDir = overrides?.sortDir ?? sortDir;
    const countAsSearch = overrides?.countAsSearch ?? true;
    // Overrides let callers (e.g. clearFilters) pass the post-clear values
    // explicitly rather than reading state that a just-fired setState hasn't
    // committed yet.
    const useFilters = overrides?.filters ?? filters;
    const useTrafficMin = overrides?.trafficMin ?? trafficMin;
    const useTrafficMax = overrides?.trafficMax ?? trafficMax;
    const useDrMin = overrides?.drMin ?? drMin;
    const useDrMax = overrides?.drMax ?? drMax;
    const usePriceMin = overrides?.priceMin ?? priceMin;
    const usePriceMax = overrides?.priceMax ?? priceMax;
    const useTrafficFilterActive = overrides?.trafficFilterActive ?? trafficFilterActive;
    const useDrFilterActive = overrides?.drFilterActive ?? drFilterActive;
    const usePriceFilterActive = overrides?.priceFilterActive ?? priceFilterActive;
    setSearching(true);
    setError(null);
    try {
      // These become real SQL WHERE-clause filters in catalog-search.ts, not
      // a post-fetch trim — so the result set (and quota-limited page size)
      // actually reflects them, instead of the top-N match results getting
      // filtered down further client-side. Gated on the explicit *FilterActive
      // flags (not a bounds comparison — see their declaration) so a filter
      // keeps being sent on every subsequent search/sort/re-search until the
      // user hits Clear, and a fresh, never-touched slider never sends a
      // spurious constraint that could zero out a differently-scoped query.
      const parsedFilters: Record<string, string | number> = {};
      if (useFilters.country !== "any") parsedFilters.country = useFilters.country;
      if (useFilters.language !== "any") parsedFilters.language = useFilters.language;
      if (useFilters.niche !== "any") parsedFilters.category = useFilters.niche;
      if (useFilters.grade !== "any") parsedFilters.grade = useFilters.grade;
      if (useTrafficFilterActive) { parsedFilters.minTraffic = useTrafficMin; parsedFilters.maxTraffic = useTrafficMax; }
      if (useDrFilterActive) { parsedFilters.minDr = useDrMin; parsedFilters.maxDr = useDrMax; }
      if (usePriceFilterActive) { parsedFilters.minPrice = usePriceMin; parsedFilters.maxPrice = usePriceMax; }

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
      // Traffic/DR/price are search options the customer sets directly (drag
      // or type), not something the app should silently readjust based on
      // what a search happened to return — so, unlike the old behavior, they
      // are NOT reset here. They only change via user input or Clear.
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
    // Matches the old app's export format exactly (client/src/components/
    // RelatedWebsites.tsx handleExportCSV) — same column set/order and
    // filename pattern.
    const headers = ["Domain", "Category", "Match %", "DR", "Traffic", "Keywords", "Country", "Lowest Price", "Cheapest Marketplace", "Marketplace Count"];
    const escape = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredResults.map((r) => {
      const cheapest = [...r.offers].sort((a, b) => a.minPrice - b.minPrice)[0];
      return [
        r.domain,
        r.category || "",
        `${r.matchPct}%`,
        r.dr,
        r.traffic,
        r.keywords,
        r.country || "",
        cheapest ? cheapest.minPrice : r.bestPrice,
        cheapest ? cheapest.name : "",
        r.offers.length,
      ].map(escape).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `related-websites-${query.trim().replace(/[^a-z0-9]/gi, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setFilters(RS_DEFAULT_FILTERS);
    setTrafficMin(trafficBounds.min);
    setTrafficMax(trafficBounds.max);
    setDrMin(drBounds.min);
    setDrMax(drBounds.max);
    setPriceMin(priceBounds.min);
    setPriceMax(priceBounds.max);
    setTrafficFilterActive(false);
    setDrFilterActive(false);
    setPriceFilterActive(false);
    // Filters are now applied server-side (see runSearch), so clearing them
    // has to re-run the search to actually get the unfiltered set back —
    // explicit overrides sidestep the stale-closure trap of reading state
    // set moments ago in this same handler.
    if (hasSearched && query.trim()) {
      runSearch({
        filters: RS_DEFAULT_FILTERS,
        trafficFilterActive: false, drFilterActive: false, priceFilterActive: false,
      });
    }
  }
  function handleTrafficChange(min: number, max: number) { setTrafficMin(min); setTrafficMax(max); setTrafficFilterActive(true); setPage(1); }
  function handleDrChange(min: number, max: number) { setDrMin(min); setDrMax(max); setDrFilterActive(true); setPage(1); }
  function handlePriceChange(min: number, max: number) { setPriceMin(min); setPriceMax(max); setPriceFilterActive(true); setPage(1); }
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
      <style>{`
        * { box-sizing: border-box; }
        input.lp-range-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          pointer-events: none;
        }
        input.lp-range-thumb::-webkit-slider-runnable-track { background: transparent; height: 20px; }
        input.lp-range-thumb::-moz-range-track { background: transparent; border: none; height: 20px; }
        input.lp-range-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${C.accent};
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
          /* Centers the 16px thumb on the visible track div (top:8, height:4 —
          center at y=10 within this 20px-tall input): WebKit doesn't
          auto-center a custom slider-thumb, it positions it margin-top px
          below the input's own top edge, so this needs (input height 20 -
          thumb height 16) / 2 = 2, not an eyeballed value that assumed a
          different reference height than what actually renders here. */
          margin-top: 2px;
        }
        input.lp-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid ${C.accent};
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
        }
        input.lp-range-thumb:disabled::-webkit-slider-thumb { border-color: ${C.line}; cursor: not-allowed; }
        input.lp-range-thumb:disabled::-moz-range-thumb { border-color: ${C.line}; cursor: not-allowed; }
      `}</style>

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
          <DualRangeSlider
            label="Traffic"
            bounds={trafficBounds}
            valueMin={trafficMin}
            valueMax={trafficMax}
            onChange={handleTrafficChange}
            formatValue={fmtNum}
            title="Minimum monthly organic traffic — drag or type an exact value"
          />
          <DualRangeSlider
            label="DR range"
            bounds={drBounds}
            valueMin={drMin}
            valueMax={drMax}
            onChange={handleDrChange}
            formatValue={(v) => String(v)}
            title="Domain Rating range — drag or type an exact value"
          />
          <DualRangeSlider
            label="Price range"
            bounds={priceBounds}
            valueMin={priceMin}
            valueMax={priceMax}
            onChange={handlePriceChange}
            // Raw marketplace/supplier price (USD), same number the old
            // fixed buckets filtered on — not the fee-inclusive "Buy $"
            // price shown in the Actions column.
            formatValue={(v) => `$${Math.round(v).toLocaleString()}`}
            title="Marketplace price range (before fee) — drag or type an exact value"
          />
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
          <div ref={setTableWrapEl} style={{ overflowX: "auto" }}>
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
                    tableWrapWidth={tableWrapWidth}
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
