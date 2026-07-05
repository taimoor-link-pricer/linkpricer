"use client";

// Homepage "Domain Analysis" live demo — pixel-identical to the in-app
// Domain Analysis screen, running on the built-in sample dataset. Ported
// from `DemoAnalyze` in v1-interactive/home-demo.jsx.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/design-v1/icons";
import { LP_DATA, NICHES } from "@/lib/design-v1/sample-data";
import { parseInput, matchedDomains, sortBy, SYMS } from "@/lib/design-v1/format";
import type { Currency, SortState } from "@/lib/design-v1/types";
import { Pill, btn, chip, lbl } from "@/components/design-v1/primitives";
import { ResultsTable } from "./ResultsTable";

const ANALYZE_CHIPS = ["techcrunch.com", "forbes.com", "healthline.com", "betimate.com", "oneangrygamer.net"];

export function DemoAnalyze({
  gate,
  requireSignup,
  searchesLeft,
}: {
  gate: () => boolean;
  requireSignup: (reason: string) => void;
  searchesLeft: number;
}) {
  const [input, setInput] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [niche, setNiche] = useState("general");
  const [loading, setLoading] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "score", dir: "desc" });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [openNiche, setOpenNiche] = useState(false);
  const nicheRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openNiche) return;
    const onDoc = (e: MouseEvent) => {
      if (!nicheRef.current?.contains(e.target as Node)) setOpenNiche(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openNiche]);

  const parsed = parseInput(input);
  const parsedCount = Math.min(parsed.length, 200);
  const rows = matchedDomains(parsed.slice(0, 200), currency, LP_DATA);
  const sorted = sortBy(rows, sort.key, sort.dir);

  const runAnalyze = (overrideInput?: string) => {
    const text = overrideInput != null ? overrideInput : input;
    if (parseInput(text).length === 0 || loading) return;
    if (!gate()) return; // 3rd search → parent opens signup
    if (overrideInput != null) setInput(text);
    setLoading(true);
    setTimeout(() => { setLoading(false); setHasResults(true); }, 650);
  };

  const addChip = (d: string) => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.includes(d)) return;
    setInput(input.trimEnd() + (input.trim() ? "\n" : "") + d);
    setHasResults(false);
  };

  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  const toggleRow = (dom: string) => setExpanded((prev) => { const n = new Set(prev); n.has(dom) ? n.delete(dom) : n.add(dom); return n; });
  const setRowShowAll = (dom: string, v: boolean) => setShowAll((prev) => { const n = new Set(prev); v ? n.add(dom) : n.delete(dom); return n; });

  return (
    <div>
      {/* search hero */}
      <section style={{ background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)", border: "1px solid var(--lp-line)", borderRadius: 16, padding: 28, marginBottom: 20 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--lp-mute)", fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
            <Icon name="bolt" size={14} /> Domain Analysis
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: "var(--lp-ink)" }}>
            Analyze guest post opportunities
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--lp-ink-3)", fontSize: 14, maxWidth: 580 }}>
            Upload up to 200 domains and compare prices &amp; conditions across every marketplace that stocks them.
          </p>
        </div>

        <div className="lp-demo-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
          {/* paste area */}
          <div style={{ position: "relative", background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--lp-line-2)", background: "#fafbfd", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>
                Paste domains — one per line. Append a price in&nbsp;
                <strong style={{ color: "var(--lp-ink-2)" }}>{currency}</strong>&nbsp;to compare:&nbsp;
                <span className="lp-mono" style={{ color: "var(--lp-ink-2)" }}>forbes.com {SYMS[currency]}200</span>
              </span>
              <span style={{ display: "inline-flex", gap: 6 }}>
                <Pill color={parsedCount > 0 ? "blue" : "ink"}>{parsedCount}/200 domains</Pill>
                {parsedCount > 0 && (
                  <button onClick={() => { setInput(""); setHasResults(false); }} style={{ ...btn("ghost", "sm"), height: 22, padding: "0 8px", fontSize: 11 }}>Clear</button>
                )}
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              placeholder={"forbes.com\nbetimate.com 200\nhealthline.com"}
              style={{ width: "100%", minHeight: 152, padding: 14, border: "none", outline: "none", resize: "vertical", fontFamily: "var(--lp-mono)", fontSize: 13.5, lineHeight: 1.7, color: "var(--lp-ink-2)", background: "transparent", boxSizing: "border-box" }}
            />
          </div>

          {/* right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div ref={nicheRef} style={{ position: "relative" }}>
              <label style={lbl}>Niche / pricing column</label>
              <button onClick={() => setOpenNiche((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid " + (openNiche ? "var(--lp-accent)" : "var(--lp-line)"), borderRadius: 10, padding: "10px 12px", fontWeight: 600, fontSize: 13.5, color: "var(--lp-ink-2)", cursor: "pointer", textAlign: "left" }}>
                <span>{NICHES.find((n) => n.id === niche)?.label || "General"}</span>
                <Icon name="chevronDown" size={14} color="var(--lp-mute)" />
              </button>
              {openNiche && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(15, 22, 32, 0.10)", padding: 4, maxHeight: 280, overflow: "auto" }}>
                  {NICHES.map((n) => (
                    <button key={n.id} onClick={() => { setNiche(n.id); setOpenNiche(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "8px 10px", borderRadius: 7, border: "none", background: niche === n.id ? "var(--lp-accent-50)" : "transparent", color: niche === n.id ? "var(--lp-accent-700)" : "var(--lp-ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                      <span>{n.label}</span>
                      {niche === n.id && <Icon name="check" size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={lbl}>Currency</label>
              <div style={{ display: "flex", gap: 6 }}>
                {([{ id: "USD", label: "USD $" }, { id: "EUR", label: "EUR €" }, { id: "GBP", label: "GBP £" }] as const).map((c) => (
                  <button key={c.id} onClick={() => setCurrency(c.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid " + (currency === c.id ? "var(--lp-accent)" : "var(--lp-line)"), background: currency === c.id ? "var(--lp-accent-50)" : "#fff", color: currency === c.id ? "var(--lp-accent-700)" : "var(--lp-ink-3)" }}>{c.label}</button>
                ))}
              </div>
            </div>

            <button onClick={() => runAnalyze()} disabled={parsedCount === 0 || loading} style={{ ...btn("primary"), justifyContent: "center", padding: "14px 16px", fontSize: 14.5, marginTop: 4, opacity: (parsedCount === 0 || loading) ? 0.6 : 1, cursor: (parsedCount === 0 || loading) ? "not-allowed" : "pointer" }}>
              {loading ? <><span className="lp-spin" /> Analyzing…</> : <><Icon name="bolt" size={16} /> Analyze domains</>}
            </button>
          </div>
        </div>

        {/* sample chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>Try with:</span>
          {ANALYZE_CHIPS.map((d) => (
            <button key={d} onClick={() => addChip(d)} style={{ ...chip, cursor: "pointer" }}>+ {d}</button>
          ))}
        </div>
      </section>

      {/* results */}
      {loading ? (
        <section style={{ background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16, padding: 28, textAlign: "center" }}>
          <span className="lp-spin" /> &nbsp;<span style={{ fontSize: 14, color: "var(--lp-mute)" }}>Streaming results from {parsedCount} marketplaces…</span>
        </section>
      ) : hasResults && rows.length > 0 ? (
        <ResultsTable
          rows={sorted} title="Domain analysis results" mode="analyze"
          sort={sort} onSort={onSort} expanded={expanded} toggleRow={toggleRow}
          currency={currency} showAll={showAll} setRowShowAll={setRowShowAll}
          requireSignup={requireSignup} searchesLeft={searchesLeft}
          onBuy={() => requireSignup("buy")}
        />
      ) : (
        <section style={{ background: "#fff", border: "1px dashed var(--lp-line)", borderRadius: 16, padding: 60, textAlign: "center", color: "var(--lp-mute)" }}>
          <Icon name="bolt" size={20} color="var(--lp-mute-2)" />
          <h3 style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 700, color: "var(--lp-ink)" }}>Your price comparison appears here</h3>
          <p style={{ margin: "8px auto 0", fontSize: 14, maxWidth: 440, lineHeight: 1.55 }}>Paste a domain above (or tap a sample), then click <strong style={{ color: "var(--lp-ink-3)" }}>Analyze domains</strong> to compare live marketplace prices side by side.</p>
        </section>
      )}
    </div>
  );
}
