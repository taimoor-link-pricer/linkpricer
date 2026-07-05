"use client";

// Results table row + expanded marketplace panel, ported from `DomainRow` /
// `ExpandedPanelI` in v1-interactive/v1-app.jsx.

import { Icon } from "@/lib/design-v1/icons";
import { fmt, flag, priceFmt, matchPillColor } from "@/lib/design-v1/format";
import type { BuyHandler, Currency, Domain } from "@/lib/design-v1/types";
import { Pill, GradeBadge, Td, TrendArrow, btn, iconBtn, chev } from "./primitives";
import { MarketplaceCard } from "./MarketplaceCard";

function ExpandedPanel({
  d,
  currency,
  showAll,
  setShowAll,
  onBuy,
}: {
  d: Domain;
  currency: Currency;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  onBuy?: BuyHandler;
}) {
  const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
  const visible = showAll ? offers : offers.slice(0, 3);
  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--lp-ink)" }}>
            {showAll ? "All marketplaces" : "Top 3 best prices"}
          </h3>
          <span style={{ fontSize: 12, color: "var(--lp-mute)" }}>{offers.length} marketplaces stock this domain</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn("ghost", "sm"), cursor: "pointer" }} onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show top 3" : `Show all (${offers.length})`}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }} className="lp-demo-grid">
        {visible.map((o, i) => (
          <MarketplaceCard key={i} o={o} bestPrice={offers[0].minPrice} yourPrice={d.yourPrice} currency={currency} onBuy={onBuy} d={d} />
        ))}
      </div>
    </div>
  );
}

export function DomainRow({
  d,
  expanded,
  onToggle,
  fav,
  onFav,
  currency,
  showAll,
  setShowAll,
  onBuy,
  showMatch = false,
}: {
  d: Domain;
  expanded: boolean;
  onToggle: () => void;
  fav: boolean;
  onFav: () => void;
  currency: Currency;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  onBuy?: BuyHandler;
  showMatch?: boolean;
}) {
  const span = showMatch ? 10 : 9;

  if (d.notFound) {
    return (
      <tr>
        <td colSpan={span} style={{ padding: "16px 12px", borderBottom: "1px solid var(--lp-line-2)", background: "#fafbfd", fontSize: 13 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--lp-mute)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--lp-mute-2)" }} />
            <span className="lp-mono" style={{ color: "var(--lp-ink-3)", fontWeight: 600 }}>{d.domain}</span>
            <span>·</span>
            <span>Domain not found in our database</span>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr onClick={onToggle} style={{ background: expanded ? "#fafbfd" : "transparent", transition: "background .15s", cursor: "pointer" }}>
        <Td style={{ width: 36, paddingRight: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }} style={chev(expanded)} aria-label="Toggle">
            <Icon name="chevron" size={14} />
          </button>
        </Td>
        <Td style={{ minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--lp-bg-3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, color: "var(--lp-ink-3)" }}>
              {d.domain.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="lp-mono" style={{ fontWeight: 600, fontSize: 13.5, color: "var(--lp-ink)" }}>{d.domain}</div>
              <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>
                {d.lang} · {d.refDomains ? fmt.num(d.refDomains) + " ref. domains" : "—"}
              </div>
            </div>
          </div>
        </Td>
        {showMatch && (
          <Td style={{ width: 120 }}>
            <Pill color={matchPillColor(d.match)} style={{ fontSize: 12, padding: "5px 11px" }}>
              {d.match != null ? `${Math.round(d.match)}% match` : "—"}
            </Pill>
          </Td>
        )}
        <Td style={{ width: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={iconBtn(fav)} onClick={(e) => { e.stopPropagation(); onFav(); }} aria-label="Favourite">
              <Icon name={fav ? "heartFill" : "heart"} size={14} color={fav ? "#e11d48" : "currentColor"} />
            </button>
            {d.bestPrice != null ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onBuy && d.offers && d.offers.length > 0) {
                    const bestOffer = [...d.offers].sort((a, b) => a.minPrice - b.minPrice)[0];
                    onBuy(d, bestOffer);
                  }
                }}
                style={{ ...btn("primary", "sm"), cursor: "pointer" }}
              >
                Buy {priceFmt(fmt.withFee(d.bestPrice), currency)}
              </button>
            ) : d.noPrice ? (
              <button style={btn("disabled", "sm")} disabled>No pricing</button>
            ) : (
              <button style={btn("disabled", "sm")} disabled>No offers</button>
            )}
          </div>
        </Td>
        <Td><GradeBadge grade={d.grade} score={d.score} /></Td>
        <Td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>{flag(d.country)}</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{d.country || "—"}</span>
          </span>
        </Td>
        <Td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="lp-mono lp-tnum" style={{ fontWeight: 600 }}>{d.dr ?? "—"}</span>
            <TrendArrow dir={d.drTrend} />
          </span>
        </Td>
        <Td><span className="lp-mono lp-tnum" style={{ fontWeight: 600 }}>{fmt.num(d.traffic)}</span></Td>
        <Td><span className="lp-mono lp-tnum" style={{ color: "var(--lp-ink-3)" }}>{fmt.num(d.keywords)}</span></Td>
        <Td><Pill color="ink">{d.category || "—"}</Pill></Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={span} style={{ padding: 0, background: "#fafbfd", borderBottom: "1px solid var(--lp-line)" }}>
            <ExpandedPanel d={d} currency={currency} showAll={showAll} setShowAll={setShowAll} onBuy={onBuy} />
          </td>
        </tr>
      )}
    </>
  );
}
