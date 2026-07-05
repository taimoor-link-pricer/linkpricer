"use client";

// Homepage "Related Sites" live demo, ported from `DemoRelated` in
// v1-interactive/home-demo.jsx.

import { useEffect, useState } from "react";
import { Icon } from "@/lib/design-v1/icons";
import { sortBy } from "@/lib/design-v1/format";
import { searchRelatedSites, type RelatedSearchFilters } from "@/lib/design-v1/related-data";
import type { RelatedSite, SortState } from "@/lib/design-v1/types";
import { btn, chip } from "@/components/design-v1/primitives";
import { ResultsTable } from "./ResultsTable";
import { RSDropdown, RSToggle } from "./RSDropdown";
import { RS_FILTERS, RS_PRICE_MAP, RS_SORTS, RS_DEFAULTS, type RSFilterValues } from "./related-filters";

const RELATED_CHIPS = ["football news", "technology", "health", "gaming"];

export function DemoRelated({
  gate,
  requireSignup,
  searchesLeft,
}: {
  gate: () => boolean;
  requireSignup: (reason: string) => void;
  searchesLeft: number;
}) {
  const [query, setQuery] = useState("");
  const [ownSite, setOwnSite] = useState("");
  const [hideLinked, setHideLinked] = useState(true);
  const [filters, setFilters] = useState<RSFilterValues>(RS_DEFAULTS);
  const [sortId, setSortId] = useState("match");
  const [sort, setSort] = useState<SortState>({ key: "match", dir: "desc" });
  const [results, setResults] = useState<RelatedSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lowRelevance, setLowRelevance] = useState(false);
  const [token, setToken] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const currency = "USD" as const;
  const hasSite = !!ownSite.trim();

  const apiFilters = (): RelatedSearchFilters => ({
    country: filters.country,
    language: filters.language,
    traffic: filters.traffic === "any" ? "any" : Number(filters.traffic),
    dr: filters.dr === "any" ? "any" : Number(filters.dr),
    grade: filters.grade,
    ...RS_PRICE_MAP[filters.price],
  });

  // refetch on token change — never on mount (token starts at 0)
  useEffect(() => {
    if (token === 0) return;
    let cancelled = false;
    setLoading(true);
    searchRelatedSites({ query, ownSite, hideLinked, filters: apiFilters() }).then((res) => {
      if (cancelled) return;
      setResults(res.results);
      setLowRelevance(res.lowRelevance);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const refetch = () => setToken((t) => t + 1);
  const userSearch = (overrideQuery?: string) => {
    const q = overrideQuery != null ? overrideQuery : query;
    if (!q.trim() || loading) return;
    if (searched && !gate()) return; // first search free, then gate
    if (overrideQuery != null) setQuery(overrideQuery);
    setSearched(true);
    refetch();
  };
  const setFilter = (k: keyof RSFilterValues, v: string) => { setFilters((f) => ({ ...f, [k]: v })); if (searched) refetch(); };
  const clearFilters = () => { setFilters(RS_DEFAULTS); if (searched) refetch(); };
  const activeFilterCount = Object.values(filters).filter((v) => v !== "any").length;

  const pickSort = (id: string) => { const o = RS_SORTS.find((s) => s.id === id); if (o) { setSort(o.sort); setSortId(id); } };
  const onSort = (key: string) => { setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" })); setSortId(""); };
  const toggleRow = (dom: string) => setExpanded((prev) => { const n = new Set(prev); n.has(dom) ? n.delete(dom) : n.add(dom); return n; });
  const setRowShowAll = (dom: string, v: boolean) => setShowAll((prev) => { const n = new Set(prev); v ? n.add(dom) : n.delete(dom); return n; });

  const displayed = sortBy(results, sort.key, sort.dir);
  const inputBase: React.CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: "inherit", border: "1px solid var(--lp-line)", borderRadius: 10, outline: "none", color: "var(--lp-ink)", background: "#fff" };

  return (
    <div>
      {/* search hero */}
      <section style={{ background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)", border: "1px solid var(--lp-line)", borderRadius: 16, padding: 28, marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--lp-mute)", fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
            <Icon name="search" size={14} /> Related Sites
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: "var(--lp-ink)" }}>
            Find sites by topic, not domain
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--lp-ink-3)", fontSize: 14, maxWidth: 560 }}>
            Describe what you want in plain language. We rank every site in the marketplace by how well it matches — same prices, conditions and one-click ordering as Domain Analysis.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 16, display: "inline-flex", pointerEvents: "none" }}><Icon name="search" size={18} color="var(--lp-mute)" /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") userSearch(); }} placeholder="Describe the sites you want, e.g. football news" style={{ ...inputBase, height: 52, padding: "0 16px 0 46px", fontSize: 16, fontWeight: 500 }} />
          </div>
          <button onClick={() => userSearch()} disabled={loading} style={{ ...btn("primary"), height: 52, padding: "0 26px", fontSize: 15.5, justifyContent: "center", opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer", whiteSpace: "nowrap" }}>
            {loading ? <><span className="lp-spin" /> Searching…</> : <><Icon name="search" size={17} /> Search</>}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", minWidth: 240, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 14, display: "inline-flex", pointerEvents: "none" }}><Icon name="external" size={15} color="var(--lp-mute-2)" /></span>
            <input value={ownSite} onChange={(e) => setOwnSite(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") userSearch(); }} placeholder="Your website (optional), e.g. mysite.com" className="lp-mono" style={{ ...inputBase, height: 42, padding: "0 14px 0 40px", fontSize: 13 }} />
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: hasSite ? "pointer" : "default", fontSize: 13.5, fontWeight: 600, color: hasSite ? "var(--lp-ink-2)" : "var(--lp-mute)" }}>
            <RSToggle checked={hideLinked && hasSite} disabled={!hasSite} onChange={(v) => { setHideLinked(v); if (searched) refetch(); }} />
            Hide sites that already link to me
            {!hasSite && <span style={{ fontWeight: 500, color: "var(--lp-mute-2)", fontSize: 12.5 }}>— add your site to enable</span>}
          </label>
        </div>

        {/* sample chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>Try a topic:</span>
          {RELATED_CHIPS.map((p) => (
            <button key={p} onClick={() => setQuery(p)} style={{ ...chip, cursor: "pointer" }}>{p}</button>
          ))}
        </div>
      </section>

      {/* pre-search prompt / filters + results */}
      {!searched ? (
        <section style={{ background: "#fff", border: "1px dashed var(--lp-line)", borderRadius: 16, padding: "56px 32px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: "var(--lp-bg-3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon name="search" size={22} color="var(--lp-mute-2)" />
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--lp-ink)" }}>Describe a topic to find related sites</h3>
          <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--lp-mute)", maxWidth: 450, lineHeight: 1.55 }}>
            Type a phrase like <strong style={{ color: "var(--lp-ink-3)" }}>&ldquo;football news&rdquo;</strong> above and hit <strong style={{ color: "var(--lp-ink-3)" }}>Search</strong> — we&rsquo;ll rank every site in the marketplace by how well it matches.
          </p>
        </section>
      ) : (
        <>
          {/* filter bar */}
          <section style={{ background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "var(--lp-shadow-1)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <RSDropdown label="Country" value={filters.country} options={RS_FILTERS.country} onChange={(v) => setFilter("country", v)} searchable />
              <RSDropdown label="Language" value={filters.language} options={RS_FILTERS.language} onChange={(v) => setFilter("language", v)} searchable />
              <RSDropdown label="Traffic" value={filters.traffic} options={RS_FILTERS.traffic} onChange={(v) => setFilter("traffic", v)} />
              <RSDropdown label="DR range" value={filters.dr} options={RS_FILTERS.dr} onChange={(v) => setFilter("dr", v)} />
              <RSDropdown label="Price range" value={filters.price} options={RS_FILTERS.price} onChange={(v) => setFilter("price", v)} />
              <RSDropdown label="Value grade" value={filters.grade} options={RS_FILTERS.grade} onChange={(v) => setFilter("grade", v)} />
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{ ...btn("ghost", "sm"), height: 38, cursor: "pointer" }}><Icon name="x" size={12} /> Clear ({activeFilterCount})</button>
              )}
            </div>
          </section>

          {/* results */}
          {loading ? (
            <section style={{ background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16, padding: 28, textAlign: "center" }}>
              <span className="lp-spin" /> &nbsp;<span style={{ fontSize: 14, color: "var(--lp-mute)" }}>Scoring the marketplace against your search…</span>
            </section>
          ) : results.length === 0 || lowRelevance ? (
            <section style={{ background: "#fff", border: "1px dashed var(--lp-line)", borderRadius: 16, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: "var(--lp-bg-3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="search" size={22} color="var(--lp-mute-2)" />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--lp-ink)" }}>No strong matches{query.trim() ? <> for &ldquo;{query.trim()}&rdquo;</> : null}</h3>
              <p style={{ margin: "8px auto 0", fontSize: 14, color: "var(--lp-mute)", maxWidth: 460, lineHeight: 1.55 }}>
                Try a broader topic — e.g. <strong style={{ color: "var(--lp-ink-3)" }}>&ldquo;football news&rdquo;</strong>, <strong style={{ color: "var(--lp-ink-3)" }}>&ldquo;technology&rdquo;</strong> or <strong style={{ color: "var(--lp-ink-3)" }}>&ldquo;health&rdquo;</strong>{activeFilterCount > 0 ? <> — or relax your filters.</> : <>.</>}
              </p>
              {activeFilterCount > 0 && (
                <div style={{ marginTop: 20 }}><button onClick={clearFilters} style={{ ...btn("ghost"), cursor: "pointer" }}><Icon name="x" size={13} /> Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</button></div>
              )}
            </section>
          ) : (
            <ResultsTable
              rows={displayed} title="Related sites" mode="related"
              sort={sort} onSort={onSort} expanded={expanded} toggleRow={toggleRow}
              currency={currency} showAll={showAll} setRowShowAll={setRowShowAll}
              requireSignup={requireSignup} searchesLeft={searchesLeft}
              sortControl={<RSDropdown value={sortId} options={RS_SORTS} onChange={pickSort} minWidth={150} align="right" />}
              onBuy={() => requireSignup("buy")}
            />
          )}
        </>
      )}
    </div>
  );
}
