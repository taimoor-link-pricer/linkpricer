"use client";

// Shared results table — identical chrome to the real /dashboard/search app,
// running against sample data. Ported from `ResultsTable` in
// v1-interactive/home-demo.jsx.

import type { BuyHandler, Currency, Domain, SortState } from "@/lib/design-v1/types";
import { Pill, Th } from "@/components/design-v1/primitives";
import { DomainRow } from "@/components/design-v1/DomainRow";

export function ResultsTable({
  rows,
  title,
  mode,
  sort,
  onSort,
  expanded,
  toggleRow,
  currency,
  showAll,
  setRowShowAll,
  requireSignup,
  searchesLeft,
  sortControl,
  onBuy,
}: {
  /** Already sorted by the caller — this component renders in the given order. */
  rows: Domain[];
  title: string;
  mode: "analyze" | "related";
  sort: SortState;
  onSort: (key: string) => void;
  expanded: Set<string>;
  toggleRow: (domain: string) => void;
  currency: Currency;
  showAll: Set<string>;
  setRowShowAll: (domain: string, v: boolean) => void;
  requireSignup: (reason: string) => void;
  searchesLeft: number;
  sortControl?: React.ReactNode;
  onBuy?: BuyHandler;
}) {
  const showMatch = mode === "related";
  const onFav = () => requireSignup("save");
  const real = rows.filter((r) => !r.notFound);

  return (
    <section style={{ background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16, boxShadow: "var(--lp-shadow-1)", overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--lp-line)", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <Pill color="blue">{real.length} {showMatch ? (real.length === 1 ? "result" : "results") : "domains"}</Pill>
          <Pill color="amber"><span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", display: "inline-block" }} /> Sample data</Pill>
          {showMatch && <span style={{ fontSize: 12, color: "var(--lp-mute)" }}>ranked by semantic match</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {sortControl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>Sort by</span>
              {sortControl}
            </div>
          )}
          <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>
            {searchesLeft > 0 ? <>{searchesLeft} free demo {searchesLeft === 1 ? "search" : "searches"} left</> : <>Log in for unlimited searches</>}
          </span>
        </div>
      </header>
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: showMatch ? 1180 : 1100 }}>
          <thead style={{ background: "#fff", borderBottom: "1px solid var(--lp-line)" }}>
            <tr>
              <Th style={{ width: 36 }} />
              <Th sortable sortKey="domain" sortState={sort} onSort={onSort}>{showMatch ? "Site" : "Domain"}</Th>
              {showMatch && <Th sortable sortKey="match" sortState={sort} onSort={onSort}>Match</Th>}
              <Th>Actions</Th>
              <Th sortable sortKey="score" sortState={sort} onSort={onSort}>Value</Th>
              <Th>Country</Th>
              <Th sortable sortKey="dr" sortState={sort} onSort={onSort}>DR</Th>
              <Th sortable sortKey="traffic" sortState={sort} onSort={onSort}>Traffic</Th>
              <Th sortable sortKey="keywords" sortState={sort} onSort={onSort}>Keywords</Th>
              <Th>Category</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <DomainRow
                key={d.domain}
                d={d}
                showMatch={showMatch}
                expanded={expanded.has(d.domain)}
                onToggle={() => toggleRow(d.domain)}
                fav={false}
                onFav={onFav}
                currency={currency}
                showAll={showAll.has(d.domain)}
                setShowAll={(v) => setRowShowAll(d.domain, v)}
                onBuy={onBuy}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
