"use client";

// Shared result-row / expand / marketplace-offer machinery, extracted from
// app/dashboard/search/page.tsx so Related Sites can reuse the exact same
// expand-to-compare-offers UX instead of a flat one-button-per-row table.
// (v1-interactive/related-sites.jsx explicitly reuses window.V1Shared's
// DomainRow/offer-card machinery for this reason — this file is that.)
import { useState } from "react";
import { RATES as LIVE_RATES, SYMS as LIVE_SYMS, hydrateRates } from "@/lib/design-v1/format";
import { prettyMarketplaceName } from "@/lib/marketplace-name";

export { hydrateRates };

export const C = {
  ink: "#0f1620", ink2: "#374151", ink3: "#6b7280", mute: "#9ca3af", mute2: "#d1d5db",
  line: "#e5e7eb", line2: "#f3f4f6", bg3: "#f3f4f6",
  accent: "#0052cc", accent700: "#003a99", accent50: "#e6f2ff",
  good: "#0a8a4a", bad: "#b91c1c", warn: "#a35d00",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
};

export type Currency = "USD" | "EUR" | "GBP";

export function fmtNum(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

// Rates come from LIVE_RATES (lib/design-v1/format.ts), hydrated at runtime
// from the admin-configured /api/currency-rates — see search/page.tsx's
// priceFmt for why this can't be a local hardcoded copy anymore.
export function priceFmt(usd: number | null, cur: Currency): string {
  if (usd == null) return "—";
  return LIVE_SYMS[cur] + Math.round(usd * LIVE_RATES[cur]).toLocaleString();
}

export function withFee(p: number): number {
  return Math.max(Math.round(p * 1.15), Math.floor(p) + 1);
}

export function countryFlag(code: string): string {
  if (code === "US") return "🇺🇸";
  if (code === "GB") return "🇬🇧";
  if (code === "DE") return "🇩🇪";
  return "🌐";
}

export function gradeStyle(grade: string): { background: string; color: string } {
  const g = (grade ?? "C")[0]?.toUpperCase();
  if (g === "A") return { background: "#e6f6ed", color: C.good };
  if (g === "B") return { background: "#fef3c7", color: C.warn };
  return { background: "#fee2e2", color: C.bad };
}

export function domainInitials(domain: string): string {
  return domain.slice(0, 2).toUpperCase();
}

export function Stars({ n }: { n: number }) {
  return <span style={{ color: "#f59e0b", fontSize: 13 }}>{[1, 2, 3, 4, 5].map((i) => (i <= n ? "★" : "☆")).join("")}</span>;
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "lp-spin 0.7s linear infinite", flexShrink: 0 }} />;
}

export type Offer = {
  name: string; type: "API" | "Vendor" | "DB"; updated: string;
  minPrice: number; maxPrice: number; quality: number; delivery: number; tat: number;
  link: string; example: string | null;
};

export type DomainLike = {
  domain: string; dr: number; traffic: number; yourPrice: number | null; offers: Offer[];
};

export type CartItem = {
  domain: string; dr: number; traffic: number; offerName: string; offerType: "API" | "Vendor" | "DB";
  price: number; delivery: number; link: string;
};

export function ExpandedPanel<T extends DomainLike>({ domainData, currency, onAddToCart }: { domainData: T; currency: Currency; onAddToCart: (item: CartItem) => void }) {
  const [showAll, setShowAll] = useState(false);
  const sortedOffers = [...domainData.offers].sort((a, b) => a.minPrice - b.minPrice);
  const offers = showAll ? sortedOffers : sortedOffers.slice(0, 3);
  const bestPrice = sortedOffers[0]?.minPrice ?? null;
  const avgPrice = sortedOffers.length ? sortedOffers.reduce((sum, o) => sum + withFee(o.minPrice), 0) / sortedOffers.length : null;

  function typeIcon(type: string) {
    if (type === "API") return <span style={{ color: C.accent, fontWeight: 700, fontSize: 11 }}>⚡ API</span>;
    if (type === "Vendor") return <span style={{ color: "#a35d00", fontWeight: 700, fontSize: 11 }}>◈ Vendor</span>;
    return <span style={{ color: C.ink3, fontWeight: 700, fontSize: 11 }}>◇ DB</span>;
  }

  if (sortedOffers.length === 0) {
    return (
      <div style={{ background: "#f8f9fc", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "20px 24px", fontSize: 13, color: C.mute }}>
        No marketplace offers found for this domain yet.
      </div>
    );
  }

  return (
    <div style={{ background: "#f8f9fc", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{showAll ? "All marketplaces" : "Top 3 best prices"}</span>
          <span style={{ fontSize: 12, color: C.mute }}>{sortedOffers.length} marketplace{sortedOffers.length !== 1 ? "s" : ""} stock this domain</span>
          {avgPrice != null && (
            <span style={{ fontSize: 12, color: C.ink2, fontWeight: 700 }}>
              Avg. price <span style={{ color: C.ink }}>{priceFmt(avgPrice, currency)}</span>
            </span>
          )}
        </div>
        <button onClick={() => setShowAll((v) => !v)} style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${C.line}`, background: "rgba(15,22,32,0.04)", color: C.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {showAll ? "Show top 3" : `Show all (${sortedOffers.length})`}
        </button>
      </div>
      {/* max 320px per card — plain 1fr stretches to fill the row when there are
      only 3 cards in a wide container (e.g. related-sites' table, which sets
      minWidth:1180 for its extra Match column), making each card much wider
      than intended even though the same grid looks fine on narrower tables. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 320px))", gap: 14 }}>
        {offers.map((offer) => (
          <OfferCard
            key={offer.name}
            offer={offer}
            isBest={offer.minPrice === bestPrice}
            yourPrice={domainData.yourPrice}
            currency={currency}
            domainName={domainData.domain}
            domainDr={domainData.dr}
            domainTraffic={domainData.traffic}
            onAddToCart={onAddToCart}
            typeIcon={typeIcon(offer.type)}
          />
        ))}
      </div>
    </div>
  );
}

function OfferCard({
  offer, isBest, yourPrice, currency, domainName, domainDr, domainTraffic, onAddToCart,
}: {
  offer: Offer; isBest: boolean; yourPrice: number | null; currency: Currency;
  domainName: string; domainDr: number; domainTraffic: number; onAddToCart: (item: CartItem) => void; typeIcon: React.ReactNode;
}) {
  const [buyHover, setBuyHover] = useState(false);
  const [handleHover, setHandleHover] = useState(false);
  const ourPrice = withFee(offer.minPrice);

  const cmp = (() => {
    if (yourPrice == null) return null;
    const diff = ((ourPrice - yourPrice) / yourPrice) * 100;
    const d = Math.round(Math.abs(diff));
    if (d < 1) return { color: C.ink3, label: "Same price" };
    if (diff < 0) return { bg: "#e6f6ed", color: C.good, label: `${d}% cheaper` };
    return { bg: "#fee2e2", color: C.bad, label: `${d}% more expensive` };
  })();

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${isBest ? C.accent : C.line}`, boxShadow: isBest ? `0 0 0 3px ${C.accent50}` : "none", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
      {isBest && <span style={{ position: "absolute", top: -10, left: 14, background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase" }}>Best price</span>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: offer.type === "Vendor" ? "#fdf2dd" : offer.type === "API" ? "#e9f1fe" : "#eef0f4", color: offer.type === "Vendor" ? "#a35d00" : offer.type === "API" ? "#1d4ed8" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            {offer.type === "Vendor" ? "◈" : offer.type === "API" ? "⚡" : "◇"}
          </div>
          <div><div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{offer.type === "Vendor" ? offer.name : prettyMarketplaceName(offer.name)}</div><div style={{ fontSize: 11, color: C.mute }}>Updated {offer.updated}</div></div>
        </div>
        <Stars n={offer.quality} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: yourPrice != null ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 1, background: C.line2, border: `1px solid ${C.line2}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "#fff", padding: "9px 10px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Marketplace price</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>
            {priceFmt(offer.minPrice, currency)}
            {offer.minPrice !== offer.maxPrice && <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}> – {priceFmt(offer.maxPrice, currency)}</span>}
          </div>
        </div>
        <div style={{ background: C.accent50, padding: "9px 10px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.accent700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Our price</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.accent700, letterSpacing: -0.5 }}>{priceFmt(ourPrice, currency)}</div>
        </div>
        {yourPrice != null && (
          <div style={{ background: "#fff", padding: "9px 10px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Your price</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>{priceFmt(yourPrice, currency)}</div>
            {cmp && <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, color: cmp.color, background: (cmp as { bg?: string }).bg ?? C.line2, borderRadius: 4, padding: "1px 5px" }}>{cmp.label}</span>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* "Delivery guarantee" removed 2026-07-26 — same fix as
            app/dashboard/search/page.tsx's OfferCard, see that comment. */}
        {[{ label: "Avg. TAT", value: `${offer.delivery} days` }].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dashed ${C.line2}` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.mute }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.ink2 }}>{value}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dashed ${C.line2}` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.mute }}>Link type</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: offer.link === "Dofollow" ? "#e6f6ed" : "#fef3c7", color: offer.link === "Dofollow" ? C.good : "#a35d00", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
            {offer.link === "Dofollow" ? "✓" : "✗"} {offer.link}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dashed ${C.line2}` }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.mute }}>Source</span>
          <span style={{ display: "inline-block", background: C.line2, color: C.ink3, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>{offer.type === "API" ? "Live API" : offer.type === "DB" ? "Synced" : "Vendor"}</span>
        </div>
      </div>
      {offer.example ? (
        <a href={offer.example} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: `1px dashed ${C.mute2}`, borderRadius: 8, textDecoration: "none", color: C.ink2, background: "#fbfcfe" }}>
          <div style={{ width: 32, height: 24, background: C.line2, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.mute, fontWeight: 600, marginBottom: 2 }}>Published example</div>
            <div style={{ fontSize: 11, color: C.ink2, fontFamily: C.mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{offer.example.replace(/^https?:\/\//, "")}</div>
          </div>
          <span style={{ fontSize: 12, color: C.accent, flexShrink: 0 }}>↗</span>
        </a>
      ) : (
        <div style={{ padding: "9px 10px", border: `1px dashed ${C.mute2}`, borderRadius: 8, fontSize: 11.5, color: C.mute, textAlign: "center", background: "#fbfcfe" }}>No published example available</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onMouseEnter={() => setHandleHover(true)} onMouseLeave={() => setHandleHover(false)}
          onClick={() => onAddToCart({ domain: domainName, dr: domainDr, traffic: domainTraffic, offerName: offer.name, offerType: offer.type, price: ourPrice, delivery: offer.delivery, link: offer.link })}
          style={{ padding: "9px 0", background: handleHover ? C.accent700 : C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
        >
          <span style={{ fontSize: 11 }}>◎</span> We&apos;ll handle it
        </button>
        <button
          onMouseEnter={() => setBuyHover(true)} onMouseLeave={() => setBuyHover(false)}
          onClick={() => onAddToCart({ domain: domainName, dr: domainDr, traffic: domainTraffic, offerName: offer.name, offerType: offer.type, price: offer.minPrice, delivery: offer.delivery, link: offer.link })}
          style={{ padding: "9px 0", background: buyHover ? C.line2 : "#fff", color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
        >
          Buy direct <span style={{ fontSize: 11 }}>↗</span>
        </button>
      </div>
    </div>
  );
}
