"use client";

import React, { useState, Suspense, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { ProfileMenu } from "@/components/dashboard/profile-menu";
import { RATES as LIVE_RATES, SYMS as LIVE_SYMS, hydrateRates } from "@/lib/design-v1/format";
import { normalizeDomain } from "@/lib/normalize-domain";
import { prettyMarketplaceName } from "@/lib/marketplace-name";
import type { PriceType } from "@/lib/orders/types";
import { contentPriceCents, DEFAULT_CONTENT_WORD_COUNT, currencySymbol } from "@/lib/orders/types";
import { RatingBadge } from "@/components/dashboard/results-shared";

// ─── tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#f6f7f9",
  ink: "#0f1620",
  ink2: "#374151",
  ink3: "#6b7280",
  mute: "#9ca3af",
  mute2: "#d1d5db",
  line: "#e5e7eb",
  line2: "#f3f4f6",
  bg3: "#f3f4f6",
  accent: "#0052cc",
  accent700: "#003a99",
  accent50: "#e6f2ff",
  good: "#0a8a4a",
  bad: "#b91c1c",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtNum(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

type Currency = "USD" | "EUR" | "GBP";
// Rates come from LIVE_RATES (lib/design-v1/format.ts), hydrated at runtime
// from the admin-configured /api/currency-rates — not hardcoded here, so
// this can't drift out of sync with the backend's conversion the way it did
// before (backend used the admin rate, this used a stale fallback forever).
function priceFmt(usd: number | null, cur: Currency): string {
  if (usd == null) return "—";
  const v = Math.round(usd * LIVE_RATES[cur]);
  return LIVE_SYMS[cur] + v.toLocaleString();
}

// DR hover tooltip text — domain_rating_updated_at is only ever set by the
// live ahrefs-dr.ts job on a confirmed fetch (see lib/db/schema.ts), so a
// null here means this domain hasn't been through that job's ~30-day rolling
// cycle yet, not that the DR itself is wrong. Returns just the "last
// updated" line — the "Source: Ahrefs" attribution is rendered separately
// as a real link, not baked into this string.
function drUpdatedText(updatedAt: string | null): string {
  if (!updatedAt) return "DR freshness data not yet available for this domain";
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "DR freshness data not yet available for this domain";
  const formatted = d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  return `Last updated ${formatted}`;
}

function withFee(p: number): number {
  // Rounding to a whole currency unit can erase the 15% margin entirely on cheap
  // prices (e.g. 1.21 * 1.15 = 1.39, which rounds down to 1 — below source price).
  // Math.floor(p) + 1 guarantees at least one whole unit of real margin in that
  // case, while leaving normal-priced offers unchanged.
  return Math.max(Math.round(p * 1.15), Math.floor(p) + 1);
}

function countryFlag(code: string): string {
  if (code === "US") return "🇺🇸";
  if (code === "GB") return "🇬🇧";
  if (code === "DE") return "🇩🇪";
  return "🌐";
}

function gradeStyle(grade: string): { background: string; color: string } {
  const g = (grade ?? "C")[0].toUpperCase();
  if (g === "A") return { background: "#e6f6ed", color: "#0a8a4a" };
  if (g === "B") return { background: "#fef3c7", color: "#a35d00" };
  return { background: "#fee2e2", color: "#b91c1c" };
}

function domainInitials(domain: string): string {
  return domain.slice(0, 2).toUpperCase();
}

function Spinner({ size = 18 }: { size?: number }) {
  return (
    <>
      <span
        style={{
          display: "inline-block",
          width: size,
          height: size,
          border: `2px solid rgba(255,255,255,0.4)`,
          borderTopColor: "#fff",
          borderRadius: "50%",
          animation: "lp-spin 0.7s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

// ─── data ─────────────────────────────────────────────────────────────────────
const NICHES = [
  { id: "general", label: "General" },
  { id: "igaming", label: "iGaming / Gambling" },
  { id: "adult", label: "Adult" },
  { id: "cbd", label: "CBD" },
  { id: "loans", label: "Loans" },
  { id: "dating", label: "Dating" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Trading / Forex" },
  { id: "insertion", label: "Link Insertion" },
];

type Offer = {
  name: string;
  type: "API" | "Vendor" | "DB";
  updated: string;
  minPrice: number;
  maxPrice: number;
  quality: number;
  ratingCount: number;
  hasEnoughRatings: boolean;
  delivery: number;
  tat: number;
  link: string;
  example: string | null;
};

type Domain = {
  domain: string;
  country: string;
  lang: string;
  category: string;
  dr: number;
  drUpdatedAt: string | null;
  drTrend: "up" | "flat" | "down";
  traffic: number;
  keywords: number;
  refDomains: number;
  grade: string;
  score: number;
  bestPrice: number | null;
  yourPrice: number | null;
  noPrice?: boolean;
  offers: Offer[];
};


// ─── Recent searches (localStorage, client-only — same pattern already used
// for `lp_analyze_tour_seen`; no backend table exists for this) ───────────────
type RecentSearch = {
  id: string;
  pasteValue: string;
  currency: Currency;
  niche: string;
  domains: string[];
  timestamp: number;
};

const RECENT_SEARCHES_KEY = "lp_recent_searches";
const MAX_RECENT_SEARCHES = 8;

function loadRecentSearches(): RecentSearch[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRecentSearches(list: RecentSearch[]) {
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    /* noop — storage may be full/disabled, search still works without it */
  }
}

function formatRecentSearchTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Cart types ───────────────────────────────────────────────────────────────
type CartItem = {
  domain: string;
  dr: number;
  traffic: number;
  offerName: string;
  offerType: "API" | "Vendor" | "DB";
  price: number; // raw USD, pre-fee — already resolved for `priceType` via /api/analyze's niche param
  priceType: PriceType; // which price column this `price` came from — sent to /api/orders so the
  // server re-derives the SAME column instead of silently defaulting to "base" (see nicheToPriceType)
  delivery: number;
  link: string;
  orderType: "managed" | "direct";
};

// Mirrors computeOrderPricing's integer-cent math (lib/orders/pricing.ts) so the
// quote shown here matches what /api/orders actually charges to the cent — the
// managed fee is rounded PER ITEM server-side, not on the aggregate sum, so
// summing already-rounded per-item totals (rather than rounding the sum once)
// is required to avoid a client/server mismatch on multi-item managed carts.
function cartCentsTotals(items: { price: number; contentPrice?: number; orderType: "managed" | "direct" }[]) {
  let subtotalCents = 0;
  let feeCents = 0;
  for (const i of items) {
    const itemSubtotalCents = Math.round(i.price * 100) + Math.round((i.contentPrice ?? 0) * 100);
    subtotalCents += itemSubtotalCents;
    if (i.orderType === "managed") feeCents += Math.round(itemSubtotalCents * 0.15);
  }
  return { subtotalCents, feeCents, totalCents: subtotalCents + feeCents };
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Maps the Analyze page's pricing-niche selector (its own id space, matching
// /api/analyze's NICHE_COLUMNS) to the order backend's PriceType enum
// (lib/orders/types.ts) — these were built as two disconnected id spaces
// (igaming/loans/forex vs gambling/loan/tradingForex) with no shared mapping
// anywhere, which is how an order's actual priceType silently stayed "base"
// regardless of the niche a customer searched and was quoted under.
function nicheToPriceType(niche: string): PriceType {
  switch (niche) {
    case "igaming": return "gambling";
    case "adult": return "adult";
    case "cbd": return "cbd";
    case "loans": return "loan";
    case "dating": return "dating";
    case "crypto": return "crypto";
    case "forex": return "tradingForex";
    case "insertion": return "insertion";
    default: return "base"; // "general" has no niche-specific price column
  }
}

// ─── ExpandedPanel ────────────────────────────────────────────────────────────
function ExpandedPanel({
  domainData,
  currency,
  onAddToCart,
  maxWidth,
}: {
  domainData: Domain;
  currency: Currency;
  onAddToCart: (item: Omit<CartItem, "priceType">) => void;
  // Caps this panel to the table's visible (scrolled) width instead of its
  // full rendered width — see the tableWrapWidth comment in ResultsTable.
  // Also kept pinned to the left of whatever the table is currently scrolled
  // to, so expanding a row after scrolling right doesn't leave the panel
  // sitting off-screen to the left.
  maxWidth?: number | null;
}) {
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

  return (
    <div
      data-tour="offers"
      style={{
        background: "#f8f9fc",
        borderTop: `1px solid ${C.line}`,
        borderBottom: `1px solid ${C.line}`,
        padding: "20px 24px",
        position: "sticky",
        left: 0,
        maxWidth: maxWidth ?? undefined,
        boxSizing: "border-box",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
            {showAll ? "All marketplaces" : "Top 3 best prices"}
          </span>
          <span style={{ fontSize: 12, color: C.mute }}>{sortedOffers.length} marketplace{sortedOffers.length !== 1 ? "s" : ""} stock this domain</span>
          {avgPrice != null && (
            <span style={{ fontSize: 12, color: C.ink2, fontWeight: 700 }}>
              Avg. price <span style={{ color: C.ink }}>{priceFmt(avgPrice, currency)}</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${C.line}`, background: "rgba(15,22,32,0.04)", color: C.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {showAll ? "Show top 3" : `Show all (${sortedOffers.length})`}
          </button>
        </div>
      </div>

      {/* Top-3 view: fixed N-column grid (N = however many of the 3 slots are
      filled) so the cards always stretch to fill the row on a big screen,
      instead of auto-fit's 320px cap leaving dead whitespace to the right
      when there are only 3 (or fewer) cards to lay out. "Show all" can have
      many more cards than fit in one row, so it keeps the auto-fit/320px cap
      there — that's still what avoids over-wide cards for a long list.
      lp-offer-grid + the @media rule below collapses the fixed N-column
      layout back to a single column on mobile — a hardcoded 1fr-per-offer
      grid has no room to shrink on a narrow screen otherwise, unlike
      auto-fit which already wraps naturally. */}
      <div className={showAll ? undefined : "lp-offer-grid"} style={{ display: "grid", gridTemplateColumns: showAll ? "repeat(auto-fit, minmax(240px, 320px))" : `repeat(${offers.length}, minmax(0, 1fr))`, gap: 14 }}>
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
  offer,
  isBest,
  yourPrice,
  currency,
  domainName,
  domainDr,
  domainTraffic,
  onAddToCart,
  typeIcon,
}: {
  offer: Offer;
  isBest: boolean;
  yourPrice: number | null;
  currency: Currency;
  domainName: string;
  domainDr: number;
  domainTraffic: number;
  onAddToCart: (item: Omit<CartItem, "priceType">) => void;
  typeIcon: React.ReactNode;
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
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${isBest ? C.accent : C.line}`,
        boxShadow: isBest ? `0 0 0 3px ${C.accent50}` : "none",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
      }}
    >
      {/* Best price badge */}
      {isBest && (
        <span style={{
          position: "absolute", top: -10, left: 14,
          background: C.accent, color: "#fff",
          fontSize: 10, fontWeight: 700, padding: "3px 8px",
          borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase",
        }}>
          Best price
        </span>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: offer.type === "Vendor" ? "#fdf2dd" : offer.type === "API" ? "#e9f1fe" : "#eef0f4",
            color: offer.type === "Vendor" ? "#a35d00" : offer.type === "API" ? "#1d4ed8" : "#374151",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
          }}>
            {offer.type === "Vendor" ? "◈" : offer.type === "API" ? "⚡" : "◇"}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{offer.type === "Vendor" ? offer.name : prettyMarketplaceName(offer.name)}</div>
            <div style={{ fontSize: 11, color: C.mute }}>Updated {offer.updated}</div>
          </div>
        </div>
        <RatingBadge score={offer.quality} count={offer.ratingCount} hasEnoughData={offer.hasEnoughRatings} />
      </div>

      {/* Price grid: 2 or 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: yourPrice != null ? "repeat(3, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 1, background: C.line2, border: `1px solid ${C.line2}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "#fff", padding: "9px 10px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Marketplace price</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>
            {priceFmt(offer.minPrice, currency)}
            {offer.minPrice !== offer.maxPrice && (
              <span style={{ fontSize: 11, color: C.ink3, fontWeight: 600 }}> – {priceFmt(offer.maxPrice, currency)}</span>
            )}
          </div>
        </div>
        <div style={{ background: C.accent50, padding: "9px 10px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: C.accent700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Our price</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.accent700, letterSpacing: -0.5 }}>
            {priceFmt(ourPrice, currency)}
          </div>
        </div>
        {yourPrice != null && (
          <div style={{ background: "#fff", padding: "9px 10px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: C.mute, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 2 }}>Your price</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>{priceFmt(yourPrice, currency)}</div>
            {cmp && (
              <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, color: cmp.color, background: (cmp as { bg?: string }).bg ?? C.line2, borderRadius: 4, padding: "1px 5px" }}>
                {cmp.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Details rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {[
          // "Delivery guarantee" used to show alongside this as a separate
          // row — removed 2026-07-26: both fields always read the same
          // hardcoded 14-day fallback for every marketplace offer (confirmed
          // via DB: delivery_time_days and tat are 100% NULL across all
          // 2,038,551 marketplace_offers rows), so the two rows never once
          // showed different numbers. "Avg. TAT" is the clearer label of the
          // two (per explicit product decision); it now sources its value
          // from offer.delivery — the field with an actual live write path
          // (confirmed via supplier_offers, where vendors do enter real
          // delivery_time_days values) — rather than offer.tat, which no
          // connector or vendor flow has ever written.
          { label: "Avg. TAT", value: `${offer.delivery} days` },
        ].map(({ label, value }) => (
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
          <span style={{ display: "inline-block", background: C.line2, color: C.ink3, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>
            {offer.type === "API" ? "Live API" : offer.type === "DB" ? "Synced" : "Vendor"}
          </span>
        </div>
      </div>

      {/* Example link */}
      {offer.example ? (
        <a
          href={offer.example}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
            border: `1px dashed ${C.mute2}`, borderRadius: 8, textDecoration: "none",
            color: C.ink2, background: "#fbfcfe",
          }}
        >
          <div style={{ width: 32, height: 24, background: C.line2, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.mute, fontWeight: 600, marginBottom: 2 }}>Published example</div>
            <div style={{ fontSize: 11, color: C.ink2, fontFamily: C.mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {offer.example.replace(/^https?:\/\//, "")}
            </div>
          </div>
          <span style={{ fontSize: 12, color: C.accent, flexShrink: 0 }}>↗</span>
        </a>
      ) : (
        <div style={{ padding: "9px 10px", border: `1px dashed ${C.mute2}`, borderRadius: 8, fontSize: 11.5, color: C.mute, textAlign: "center", background: "#fbfcfe" }}>
          No published example available
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          onClick={() =>
            onAddToCart({ domain: domainName, dr: domainDr, traffic: domainTraffic, offerName: offer.name, offerType: offer.type, price: offer.minPrice, delivery: offer.delivery, link: offer.link, orderType: "managed" })
          }
          style={{
            padding: "9px 0",
            background: handleHover ? C.accent700 : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <span style={{ fontSize: 11 }}>◎</span> We&apos;ll handle it
        </button>
        <button
          onMouseEnter={() => setBuyHover(true)}
          onMouseLeave={() => setBuyHover(false)}
          onClick={() =>
            onAddToCart({ domain: domainName, dr: domainDr, traffic: domainTraffic, offerName: offer.name, offerType: offer.type, price: offer.minPrice, delivery: offer.delivery, link: offer.link, orderType: "direct" })
          }
          style={{
            padding: "9px 0",
            background: buyHover ? C.line2 : "#fff",
            color: C.ink2,
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          Buy direct <span style={{ fontSize: 11 }}>↗</span>

        </button>
      </div>
    </div>
  );
}

// ─── CartPopup ────────────────────────────────────────────────────────────────
function CartPopup({
  items,
  currency,
  onClose,
  onRemove,
  onCheckout,
}: {
  items: CartItem[];
  currency: Currency;
  onClose: () => void;
  onCheckout: () => void;
  onRemove: (idx: number) => void;
}) {
  const { subtotalCents, feeCents, totalCents } = cartCentsTotals(items);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,32,0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: 460,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,22,32,0.28)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Your cart</div>
            <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{items.length} {items.length === 1 ? "placement" : "placements"}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: `1px solid ${C.line}`, background: "#fff",
              cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: C.mute, fontSize: 16, fontWeight: 600,
            }}
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.mute, fontSize: 13 }}>Cart is empty.</div>
          ) : items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 20px",
                borderBottom: idx < items.length - 1 ? `1px solid ${C.line}` : "none",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.ink3 }}>
                {item.domain.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: C.mono }}>{item.domain}</div>
                <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>via <strong style={{ color: C.ink2 }}>{item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</strong></div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{priceFmt(item.price, currency)}</div>
                <button
                  onClick={() => onRemove(idx)}
                  style={{ marginTop: 4, fontSize: 11, color: C.mute, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Add another domain */}
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "11px 20px",
              display: "flex", alignItems: "center", gap: 8,
              background: "#fbfcfe", border: "none",
              borderTop: `1px dashed ${C.line}`,
              fontSize: 12.5, color: C.mute, fontWeight: 500,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14, color: C.mute2 }}>+</span>
            Add another domain to this order
          </button>
        </div>

        {/* Summary */}
        <div style={{ borderTop: `1px solid ${C.line}`, padding: "14px 20px", background: "#fbfcfe", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Subtotal</span>
            <span>{priceFmt(subtotalCents / 100, currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Linkpricer fee <span style={{ fontSize: 11 }}>(15%)</span></span>
            <span>{priceFmt(feeCents / 100, currency)}</span>
          </div>
          <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: C.ink }}>
            <span>Total</span>
            <span>{priceFmt(totalCents / 100, currency)}</span>
          </div>
        </div>

        {/* Pay note */}
        <div
          style={{
            margin: "0 20px",
            background: "#e8f6ee",
            border: `1px solid #c9e9d4`,
            borderRadius: 8,
            padding: "9px 12px",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}
        >
          <span style={{ color: "#0a7a3b", fontSize: 13, lineHeight: 1, marginTop: 1 }}>✓</span>
          <div style={{ fontSize: 11.5, color: "#0e5f30", lineHeight: 1.45 }}>
            <strong>Pay only after publication.</strong> No charge today — each article goes live before billing.
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onCheckout}
            style={{
              width: "100%",
              padding: "13px 0",
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 9,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue to brief ›
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────────
type SortKey = "domain" | "score" | "dr" | "traffic" | "keywords";
type SortDir = "asc" | "desc";

function SortArrow({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <span style={{ color: C.mute2, marginLeft: 3 }}>↔</span>;
  return <span style={{ color: C.accent, marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

// Either a resolved domain row, or one that came back "not found" — kept as
// a single tagged union so both can be interleaved in one ordered list
// (entry order, or sorted-with-not-found-trailing) instead of two disjoint
// arrays that always render found-then-not-found regardless of input order.
type TableRow = { kind: "found"; row: Domain } | { kind: "notfound"; domain: string };

function ResultsTable({
  results,
  notFound,
  order,
  currency,
  onAddToCart,
  forceExpandDomain,
}: {
  results: Domain[];
  notFound: string[];
  order: string[];
  currency: Currency;
  onAddToCart: (item: Omit<CartItem, "priceType">) => void;
  forceExpandDomain?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // null = neutral/no sort — the default, and also what a 3rd click on an
  // active column returns to (desc -> asc -> none -> desc -> ...).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpen, setFilterOpen] = useState(false);

  // This table's own columns (Domain/Actions/Value/Country/DR/Traffic/
  // Keywords/Category) routinely need more width than fits on screen — that's
  // fine, it's why the table sits in its own overflowX:auto wrapper below.
  // But an expanded row's price-comparison cards are a colSpan cell *inside*
  // that same table, so table-layout:auto hands them the table's full
  // (possibly much wider) rendered width, and the "3 cards in a row" grid
  // fills whatever width it's given — 3 cards always fit fine relative to
  // the table, just not relative to what's actually visible on screen. Track
  // the wrapper's true visible width so ExpandedPanel can cap itself to it
  // instead of the table's.
  // Callback ref, not useRef+useEffect(,[]) — ResultsTable happens to mount
  // atomically with this wrapper today (both appear together once `results`
  // stops being null), so a mount-only effect works, but that's incidental
  // to this component's current structure. The callback form re-fires
  // whenever the wrapper div actually mounts regardless, which is what
  // dashboard/related-sites/page.tsx needs for the identical fix there,
  // since its table mounts well after that page's own first render — keeping
  // both the same avoids two subtly different versions of the same fix.
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

  // Onboarding tour step 3 needs a row already expanded so it has something
  // to spotlight ([data-tour="offers"] only exists once a row is open).
  useEffect(() => {
    if (forceExpandDomain) {
      setExpanded((prev) => (prev.has(forceExpandDomain) ? prev : new Set(prev).add(forceExpandDomain)));
    }
  }, [forceExpandDomain]);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setFavorites(new Set((data.favorites as { domain: string }[]).map((f) => f.domain))))
      .catch(() => {});
  }, []);

  function toggleExpand(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function toggleFav(row: Domain) {
    const wasFav = favorites.has(row.domain);
    setFavorites((prev) => {
      const next = new Set(prev);
      wasFav ? next.delete(row.domain) : next.add(row.domain);
      return next;
    });
    if (wasFav) {
      fetch(`/api/favorites?domain=${encodeURIComponent(row.domain)}`, { method: "DELETE" }).catch(() => {});
    } else {
      fetch("/api/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: row.domain, dr: row.dr, traffic: row.traffic, category: row.category }),
      }).catch(() => {});
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); } // 3rd click -> back to neutral
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortFound(rows: Domain[]): Domain[] {
    return [...rows].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "domain") { av = a.domain; bv = b.domain; }
      else if (sortKey === "score") { av = a.score; bv = b.score; }
      else if (sortKey === "dr") { av = a.dr; bv = b.dr; }
      else if (sortKey === "traffic") { av = a.traffic; bv = b.traffic; }
      else if (sortKey === "keywords") { av = a.keywords; bv = b.keywords; }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }

  // Neutral state: interleave found + not-found rows in the exact sequence
  // the user entered them (via `order`), not-found domains included inline
  // rather than always trailing. With an explicit column sort active, found
  // rows are ranked by that column and not-found rows (nothing to rank)
  // trail after — but still in their original relative entry order.
  function buildRows(): TableRow[] {
    const notFoundSet = new Set(notFound);
    const byDomain = new Map(results.map((r) => [r.domain, r]));

    if (sortKey === null) {
      const seq = order.length > 0 ? order : [...results.map((r) => r.domain), ...notFound];
      const rows: TableRow[] = [];
      const seen = new Set<string>();
      for (const d of seq) {
        if (seen.has(d)) continue;
        seen.add(d);
        const found = byDomain.get(d);
        if (found) rows.push({ kind: "found", row: found });
        else if (notFoundSet.has(d)) rows.push({ kind: "notfound", domain: d });
      }
      // Safety net for any result/not-found domain that fell outside `order`
      // (e.g. stale order state) — still show it rather than drop it.
      for (const r of results) if (!seen.has(r.domain)) { rows.push({ kind: "found", row: r }); seen.add(r.domain); }
      for (const d of notFound) if (!seen.has(d)) { rows.push({ kind: "notfound", domain: d }); seen.add(d); }
      return rows;
    }

    const orderedNotFound = order.length > 0 ? order.filter((d) => notFoundSet.has(d)) : notFound;
    return [
      ...sortFound(results).map((row): TableRow => ({ kind: "found", row })),
      ...orderedNotFound.map((domain): TableRow => ({ kind: "notfound", domain })),
    ];
  }

  const rows = buildRows();

  function handleDownloadCSV() {
    // Matches the old app's export format exactly (client/src/components/DomainsTable.tsx
    // handleExportCSV) — same column set/order and filename pattern, so anyone who has
    // scripts/spreadsheets built against the old export doesn't need to change anything.
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Domain,Category,DR,Traffic,Keywords,Country,Lowest Price,Cheapest Marketplace,Marketplace Count,Value Grade,Value Score\n";
    const lines = rows
      .map((r) => {
        if (r.kind === "notfound") {
          return [r.domain, "", "", "", "", "Not Found", "", "", "0", "", ""].map(escape).join(",");
        }
        const cheapest = [...r.row.offers].sort((a, b) => a.minPrice - b.minPrice)[0];
        return [
          r.row.domain,
          r.row.category || "-",
          r.row.dr ?? "-",
          r.row.traffic ?? "-",
          r.row.keywords ?? "-",
          r.row.country || "-",
          cheapest ? cheapest.minPrice : r.row.bestPrice ?? "-",
          cheapest ? cheapest.name : "-",
          r.row.offers.length,
          r.row.grade || "-",
          r.row.score ?? "-",
        ]
          .map(escape)
          .join(",");
      })
      .join("\n");
    const blob = new Blob([header + lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domain-analysis-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const thStyle = (col?: SortKey): React.CSSProperties => ({
    padding: "11px 14px",
    fontSize: 11,
    fontWeight: 700,
    color: sortKey === col ? C.accent : C.ink3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
    borderBottom: `1px solid ${C.line}`,
    whiteSpace: "nowrap" as const,
    background: C.line2,
    cursor: col ? "pointer" : "default",
    userSelect: "none" as const,
    textAlign: "left" as const,
  });

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* Table header bar */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0, flex: 1 }}>
          Domain analysis results
        </h2>
        <span
          style={{
            background: C.accent50,
            color: C.accent,
            borderRadius: 99,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {results.length + notFound.length} domains
        </span>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          style={{
            padding: "6px 14px",
            border: `1px solid ${C.line}`,
            borderRadius: 7,
            background: "#fff",
            color: C.ink2,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ▾ Filter
        </button>
        <button
          onClick={handleDownloadCSV}
          style={{
            padding: "6px 14px",
            border: `1px solid ${C.line}`,
            borderRadius: 7,
            background: "#fff",
            color: C.ink2,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ↓ Download CSV
        </button>
      </div>

      {filterOpen && (
        <div
          style={{
            padding: "10px 20px",
            background: C.line2,
            borderBottom: `1px solid ${C.line}`,
            fontSize: 12,
            color: C.ink3,
          }}
        >
          Filter panel — coming soon
        </div>
      )}

      <div ref={setTableWrapEl} style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(), width: 36 }} />
              <th style={thStyle("domain")} onClick={() => handleSort("domain")}>
                Domain <SortArrow col="domain" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={thStyle()}>Actions</th>
              <th style={thStyle("score")} onClick={() => handleSort("score")}>
                Value <SortArrow col="score" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={thStyle()}>Country</th>
              <th style={thStyle("dr")} onClick={() => handleSort("dr")}>
                DR <SortArrow col="dr" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={thStyle("traffic")} onClick={() => handleSort("traffic")}>
                Traffic <SortArrow col="traffic" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={thStyle("keywords")} onClick={() => handleSort("keywords")}>
                Keywords <SortArrow col="keywords" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={thStyle()}>Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const isLastRow = idx === rows.length - 1;
              if (r.kind === "notfound") {
                return (
                  <tr key={r.domain}>
                    <td colSpan={9} style={{ padding: "12px 20px", borderBottom: isLastRow ? "none" : `1px solid ${C.line}`, fontSize: 13 }}>
                      <span style={{ fontFamily: C.mono, color: C.ink2 }}>{r.domain}</span>
                      <span style={{ color: C.mute, marginLeft: 10 }}>— not found in any marketplace</span>
                    </td>
                  </tr>
                );
              }
              const row = r.row;
              const isExp = expanded.has(row.domain);
              const isFav = favorites.has(row.domain);
              const gs = gradeStyle(row.grade);
              return (
                <React.Fragment key={row.domain}>
                  <DomainRow
                    key={row.domain}
                    row={row}
                    isExpanded={isExp}
                    isFavorite={isFav}
                    isLast={isLastRow}
                    currency={currency}
                    gradeStyle={gs}
                    onToggleExpand={() => toggleExpand(row.domain)}
                    onToggleFav={() => toggleFav(row)}
                    onAddToCart={onAddToCart}
                  />
                  {isExp && (
                    <tr key={row.domain + "-exp"}>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <ExpandedPanel
                          domainData={row}
                          currency={currency}
                          onAddToCart={onAddToCart}
                          maxWidth={tableWrapWidth}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DomainRow({
  row,
  isExpanded,
  isFavorite,
  isLast,
  currency,
  gradeStyle: gs,
  onToggleExpand,
  onToggleFav,
  onAddToCart,
}: {
  row: Domain;
  isExpanded: boolean;
  isFavorite: boolean;
  isLast: boolean;
  currency: Currency;
  gradeStyle: { background: string; color: string };
  onToggleExpand: () => void;
  onToggleFav: () => void;
  onAddToCart: (item: Omit<CartItem, "priceType">) => void;
}) {
  const [hover, setHover] = useState(false);
  const [buyHover, setBuyHover] = useState(false);
  const [drTipOpen, setDrTipOpen] = useState(false);
  const [drTipPlacement, setDrTipPlacement] = useState<"above" | "below">("below");
  const [drTipCoords, setDrTipCoords] = useState({ top: 0, left: 0 });
  const drRef = useRef<HTMLSpanElement>(null);
  const drCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fixed-position (not absolute) so this escapes the results table's
  // horizontally-scrolling wrapper — that wrapper's overflow-x: auto forces
  // overflow-y to clip too (per the CSS spec), which silently hid an
  // absolutely-positioned tooltip whenever it poked past the wrapper's top
  // or bottom edge (i.e. for the first or last row). Placement flips based
  // on actual remaining viewport space, same technique as design-v1's
  // InfoTip component.
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
  // (the `top`/`bottom` offset above) between the DR number and the tooltip
  // box, so the cursor briefly hovers nothing while moving from one to the
  // other. An instant close on mouseleave fires before the cursor ever
  // reaches the tooltip, making the Ahrefs link inside it unclickable.
  // showDrTip() above cancels this if the mouse re-enters either element
  // in time.
  function scheduleHideDrTip() {
    if (drCloseTimer.current) clearTimeout(drCloseTimer.current);
    drCloseTimer.current = setTimeout(() => setDrTipOpen(false), 200);
  }

  const tdBase: React.CSSProperties = {
    padding: "12px 14px",
    borderBottom: isLast && !isExpanded ? "none" : `1px solid ${C.line}`,
    fontSize: 13,
    verticalAlign: "middle",
  };

  return (
    <tr
      style={{ background: isExpanded ? C.accent50 : hover ? "#fafbff" : "#fff", transition: "background 0.1s" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Chevron */}
      <td style={{ ...tdBase, width: 36, textAlign: "center", cursor: "pointer" }} onClick={onToggleExpand}>
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.2s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            color: C.ink3,
            fontSize: 14,
          }}
        >
          ▸
        </span>
      </td>

      {/* Domain */}
      <td style={tdBase}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: C.accent50,
              color: C.accent,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {domainInitials(row.domain)}
          </div>
          <div>
            <div style={{ fontFamily: C.mono, fontWeight: 600, color: C.ink, fontSize: 13 }}>
              {row.domain}
            </div>
            <div style={{ fontSize: 11, color: C.ink3 }}>
              {row.lang} · {fmtNum(row.refDomains)} ref domains
            </div>
          </div>
        </div>
      </td>

      {/* Actions */}
      <td style={tdBase}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onToggleFav}
            style={{
              background: "transparent",
              border: `1px solid ${isFavorite ? "#fca5a5" : C.line}`,
              borderRadius: 7,
              padding: "5px 8px",
              cursor: "pointer",
              fontSize: 15,
              lineHeight: 1,
              color: isFavorite ? C.bad : C.mute,
            }}
          >
            {isFavorite ? "♥" : "♡"}
          </button>
          {row.bestPrice ? (
            <button
              onMouseEnter={() => setBuyHover(true)}
              onMouseLeave={() => setBuyHover(false)}
              onClick={() =>
                onAddToCart({ domain: row.domain, dr: row.dr, traffic: row.traffic, offerName: row.offers[0]?.name ?? "Marketplace", offerType: row.offers[0]?.type ?? "DB", price: row.bestPrice ?? 0, delivery: row.offers[0]?.delivery ?? 14, link: row.offers[0]?.link ?? "Dofollow", orderType: "managed" })
              }
              style={{
                padding: "5px 12px",
                background: buyHover ? C.accent700 : C.accent,
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              Buy {priceFmt(withFee(row.bestPrice), currency)}
            </button>
          ) : (
            <button
              disabled
              style={{
                padding: "5px 12px",
                background: C.line2,
                color: C.mute,
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                cursor: "not-allowed",
              }}
            >
              No pricing
            </button>
          )}
        </div>
      </td>

      {/* Grade / Value */}
      <td style={tdBase}>
        <span
          style={{
            background: gs.background,
            color: gs.color,
            borderRadius: 6,
            padding: "3px 9px",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {row.grade} {row.score}
        </span>
      </td>

      {/* Country */}
      <td style={tdBase}>
        <span style={{ fontSize: 16 }}>{countryFlag(row.country)}</span>
        <span style={{ marginLeft: 5, color: C.ink2, fontWeight: 600, fontSize: 12 }}>{row.country}</span>
      </td>

      {/* DR */}
      <td style={tdBase}>
        <span
          ref={drRef}
          style={{ fontWeight: 700, color: C.ink }}
          onMouseEnter={showDrTip}
          onMouseLeave={scheduleHideDrTip}
        >
          {row.dr}
        </span>
        {row.drTrend === "up" && <span style={{ color: C.good, marginLeft: 4 }}>↑</span>}
        {row.drTrend === "flat" && <span style={{ color: C.mute, marginLeft: 4 }}>—</span>}
        {row.drTrend === "down" && <span style={{ color: C.bad, marginLeft: 4 }}>↓</span>}
        {drTipOpen && (
          <div
            // Not pointer-events:none anymore, and mouse enter/leave repeated
            // here too — the link below needs to actually be clickable, which
            // means the tooltip has to stay open while the cursor travels
            // from the DR number onto the tooltip itself. showDrTip's timer
            // cancel + this component's own delayed close is what actually
            // bridges the gap between the two elements.
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

      {/* Traffic */}
      <td style={{ ...tdBase, color: C.ink2 }}>{fmtNum(row.traffic)}</td>

      {/* Keywords */}
      <td style={{ ...tdBase, color: C.ink2 }}>{fmtNum(row.keywords)}</td>

      {/* Category — full text (often several comma-joined categories) shown
      on hover via title; the visible pill is capped so one long domain's
      category list can't force this whole column (and every other row's
      cell in it) wider than it needs to be in an auto-layout table. */}
      <td style={{ ...tdBase, maxWidth: 130 }}>
        <span
          title={row.category}
          style={{
            display: "inline-block",
            maxWidth: 110,
            background: C.line2,
            color: C.ink3,
            borderRadius: 99,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            verticalAlign: "bottom",
          }}
        >
          {row.category}
        </span>
      </td>
    </tr>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
type BriefItem = CartItem & {
  title: string; targetUrl: string; anchorText: string; niche: string;
  contentMode: "linkpricer" | "upload" | "url";
  brief: string; articleUrl: string; tone: string; contentPrice: number;
  selectedFile: File | null; uploadError: string | null;
};

// Single source of truth for "is this placement ready to submit" — used by
// both the header's readyCount and each card's own status badge, so they
// can't disagree the way they used to (the badge had its own separate check
// that ignored contentMode entirely, always requiring title+brief even for
// modes that don't use them, and never checking selectedFile for "upload"
// mode — so a freshly-switched-to-upload item with no file could show a
// false "✓ Ready" while a fully-valid "url"-mode item showed "Brief needed"
// forever).
function isBriefItemReady(item: BriefItem): boolean {
  if (!item.targetUrl || !item.anchorText) return false;
  if (item.contentMode === "linkpricer") return !!item.title && !!item.brief;
  if (item.contentMode === "url") return !!item.articleUrl;
  return !!item.selectedFile;
}

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_ACCEPT_EXT = [".docx", ".md", ".pdf"];

// Same formula the server actually charges (lib/orders/pricing.ts) — was
// hardcoded to 120 here before, independent of the real $37.50 charge for
// the same 750-word default, so the checkout estimate never matched the
// eventual invoice.
const CONTENT_FEE_USD = contentPriceCents(DEFAULT_CONTENT_WORD_COUNT) / 100;

// Shape of a row returned by POST /api/orders — enough fields to build a
// real receipt client-side, no separate receipt endpoint needed.
type PlacedOrder = {
  id: string;
  snapshotDomain: string | null;
  snapshotMarketplaceName: string | null;
  articleTitle: string | null;
  totalAmount: string | null;
  snapshotCurrency: string | null;
  createdAt: string | null;
};

function CheckoutModal({ cartItems, onClose, onPlaced }: {
  cartItems: CartItem[];
  onClose: () => void; onPlaced: (orders: PlacedOrder[]) => void;
}) {
  const { profile } = useAuthContext();
  const [items, setItems] = useState<BriefItem[]>(() =>
    cartItems.map(c => ({ ...c, title: "", targetUrl: "", anchorText: "", niche: "", contentMode: "linkpricer", brief: "", articleUrl: "", tone: "Editorial", contentPrice: CONTENT_FEE_USD, selectedFile: null, uploadError: null }))
  );
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [placingStage, setPlacingStage] = useState<"uploading" | "submitting" | null>(null);
  // React state updates are async — `disabled={placing}` alone leaves a real
  // window where a fast double-click invokes handlePlace twice before the
  // re-render lands. This ref is checked synchronously at the very top of
  // handlePlace to close that race independent of the state-driven disable.
  const placingRef = useRef(false);

  const { subtotalCents, feeCents, totalCents } = cartCentsTotals(items);
  const readyCount = items.filter(isBriefItemReady).length;
  const [placeError, setPlaceError] = useState<string | null>(null);
  // Set once the user has actually tried to submit with something missing —
  // gates the not-ready cards' red-flagged styling below so a freshly opened
  // checkout (nothing filled in yet, nothing "wrong") doesn't look like it's
  // already full of errors.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  function change(idx: number, patch: Partial<BriefItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function handleFileSelect(idx: number, file: File | undefined) {
    if (!file) return;
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    if (!UPLOAD_ACCEPT_EXT.includes(ext)) {
      change(idx, { uploadError: "Only .docx, .md or .pdf files are accepted." });
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      change(idx, { uploadError: "File is over the 5 MB limit." });
      return;
    }
    // Just held locally — nothing touches Storage until "Place order" is
    // clicked and every field on every placement has actually validated.
    // That way a browsed-away tab or an abandoned checkout never leaves
    // anything in Storage to clean up.
    change(idx, { selectedFile: file, uploadError: null });
  }

  function handleRemoveUpload(idx: number) {
    change(idx, { selectedFile: null, uploadError: null });
  }

  async function handlePlace() {
    if (placingRef.current) return;
    setPlaceError(null);
    const notReadyIdx = items.map((it, i) => (isBriefItemReady(it) ? -1 : i)).filter((i) => i !== -1);
    if (notReadyIdx.length > 0) {
      setAttemptedSubmit(true);
      const first = notReadyIdx[0];
      setExpandedIdx(first);
      itemRefs.current[first]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const domain = items[first].domain;
      setPlaceError(
        notReadyIdx.length === 1
          ? `Placement ${first + 1} (${domain}) is missing a required field — see below.`
          : `${notReadyIdx.length} placements are missing required fields, starting with #${first + 1} (${domain}).`
      );
      return;
    }
    if (!profile) {
      setPlaceError("You must be signed in to place an order.");
      return;
    }
    placingRef.current = true;
    setPlacing(true);
    try {
      // Minted for every item up front (not just uploads) so a network retry or
      // double-submit of this same handlePlace call replays identical order ids —
      // the server treats a repeat id as a no-op instead of creating a duplicate
      // order (see the onConflictDoNothing handling in /api/orders POST).
      const orderIds = new Map<number, string>(items.map((_, idx) => [idx, crypto.randomUUID()]));

      // Upload phase: every selected file goes straight to its final,
      // order-scoped path (order-uploads/orders/{clientOrderId}/{uid}/...)
      // — the order row doesn't exist yet, so the client mints the id and
      // the order-creation call below re-uses it. If any upload fails, we
      // never call the order API at all: no half-placed order, and nothing
      // in Storage claims to belong to an order that doesn't exist.
      setPlacingStage("uploading");
      const uploadResults = new Map<number, { uploadedFileName: string; originalFileName: string }>();
      try {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          if (item.contentMode !== "upload" || !item.selectedFile) continue;
          const ext = item.selectedFile.name.includes(".") ? item.selectedFile.name.slice(item.selectedFile.name.lastIndexOf(".")).toLowerCase() : "";
          const clientOrderId = orderIds.get(idx)!;
          const path = `order-uploads/orders/${clientOrderId}/${profile.uid}/article${ext}`;
          await uploadBytes(storageRef(storage, path), item.selectedFile);
          uploadResults.set(idx, { uploadedFileName: path, originalFileName: item.selectedFile.name });
        }
      } catch (err) {
        console.error("[handlePlace] upload failed", err);
        throw new Error("Couldn't upload your article file. Check your connection and try again.");
      }

      setPlacingStage("submitting");
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i, idx) => ({
            id: orderIds.get(idx),
            domain: i.domain,
            offerName: i.offerName,
            offerType: i.offerType,
            orderType: i.orderType,
            priceType: i.priceType,
            articleTitle: i.title || undefined,
            targetUrl: i.targetUrl,
            anchorText: i.anchorText,
            contentNiche: i.niche || undefined,
            contentTone: i.tone || undefined,
            contentOption: i.contentMode === "linkpricer" ? "provided" : i.contentMode === "upload" ? "uploaded" : "url",
            wordCount: i.contentMode === "linkpricer" ? DEFAULT_CONTENT_WORD_COUNT : undefined,
            requirements: i.contentMode === "linkpricer" ? i.brief : undefined,
            articleUrl: i.contentMode === "url" ? i.articleUrl : undefined,
            uploadedFileName: uploadResults.get(idx)?.uploadedFileName,
            originalFileName: uploadResults.get(idx)?.originalFileName,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to place order");
      }
      onPlaced(data.orders as PlacedOrder[]);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      placingRef.current = false;
      setPlacing(false);
      setPlacingStage(null);
    }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,22,32,0.55)", backdropFilter: "blur(4px)", overflowY: "auto" }}>
      <style>{`
        @media (max-width: 768px) {
          .checkout-root { padding: 14px 12px 40px !important; }
          .checkout-root, .checkout-root * { min-width: 0 !important; max-width: 100%; }
          .checkout-2col { grid-template-columns: 1fr !important; }
          .checkout-2col > * { width: 100% !important; position: static !important; }
          .checkout-brief-grid { grid-template-columns: 1fr !important; }
          .checkout-trust-badge { display: none; }
        }
      `}</style>
      <div className="checkout-root" style={{ minHeight: "100vh", background: C.bg, padding: "20px 32px 60px" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span style={{ marginLeft: 14, fontSize: 12, color: C.mute }}>
              <button onClick={onClose} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12, padding: 0 }}>Cart</button>
              <span style={{ margin: "0 8px" }}>›</span>
              <span style={{ color: C.ink2 }}>Checkout</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="checkout-trust-badge" style={{ fontSize: 12, color: C.mute, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.good }}>✓</span> Secure checkout · escrow protected
            </span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 18, color: C.mute, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </header>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 24, flexWrap: "wrap" }}>
          {["Cart", "Article briefs", "Confirm order"].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: i === 1 ? C.accent : i < 1 ? "#fff" : C.bg3, color: i === 1 ? "#fff" : i < 1 ? C.ink2 : C.mute, border: i < 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, fontSize: 10, fontWeight: 800, background: i === 1 ? "#fff" : i < 1 ? C.good : C.line, color: i === 1 ? C.accent : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i < 1 ? "✓" : i + 1}</span>
                {s}
              </div>
              {i < 2 && <div style={{ width: 24, height: 1, background: C.line }} />}
            </React.Fragment>
          ))}
        </div>

        <div className="checkout-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 400px", gap: 18, alignItems: "flex-start" }}>
          {/* LEFT — briefs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Article briefs</h2>
                <span style={{ fontSize: 11.5, color: C.mute }}>{readyCount} of {items.length} ready · briefs auto-saved</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.mute }}>Tell us what to write. We assign editors fluent in your niche.</p>
            </div>

            {items.map((item, i) => {
              const ready = isBriefItemReady(item);
              const flagged = attemptedSubmit && !ready;
              return (
              <div
                key={item.domain + i}
                ref={(el) => { itemRefs.current[i] = el; }}
                style={{
                  background: "#fff",
                  border: `1px solid ${expandedIdx === i ? C.accent : flagged ? "#f3a5a5" : C.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: expandedIdx === i ? `0 0 0 3px ${C.accent50}` : flagged ? "0 0 0 3px #fee2e2" : "none",
                }}
              >
                {/* Card header row */}
                <div onClick={() => setExpandedIdx(prev => prev === i ? -1 : i)} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderBottom: expandedIdx === i ? `1px solid ${C.line2}` : "none", background: expandedIdx === i ? C.accent50 : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: ready ? "#e8f6ee" : "#fdf2dd", color: ready ? C.good : "#a35d00", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, border: `1px solid ${ready ? "#bbf0c8" : "#f3d99c"}` }}>
                    {ready ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{item.domain}</span>
                      <span style={{ fontSize: 11, color: C.mute }}>via {item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: item.title ? C.ink2 : C.mute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "No title yet"}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: ready ? "#e8f6ee" : "#fdf2dd", color: ready ? C.good : "#a35d00", flexShrink: 0 }}>
                    {ready ? "Ready" : "Brief needed"}
                  </span>
                  <span style={{ color: C.mute }}>{expandedIdx === i ? "▲" : "▼"}</span>
                </div>

                {/* Expanded form */}
                {expandedIdx === i && (
                  <div className="checkout-brief-grid" style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {/* Left column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {[
                        { label: "Article title", key: "title", type: "text", ph: "e.g. Why fintech founders should rethink onboarding in 2026" },
                        { label: "Target URL (where the link points)", key: "targetUrl", type: "url", ph: "https://yourbrand.com/blog/article-slug" },
                        { label: "Anchor text", key: "anchorText", type: "text", ph: "e.g. fintech onboarding flow" },
                      ].map(({ label, key, type, ph }) => (
                        <div key={key}>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>{label}</label>
                          <input type={type} value={(item as unknown as Record<string, string>)[key]} onChange={e => change(i, { [key]: e.target.value } as Partial<BriefItem>)} style={key === "targetUrl" || key === "anchorText" ? { ...inp, fontFamily: C.mono } : inp} placeholder={ph} />
                        </div>
                      ))}
                      {/* Niche / Category */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Niche / Category</label>
                        <select value={item.niche} onChange={e => change(i, { niche: e.target.value })} style={{ ...inp, appearance: "none" as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 30 }}>
                          <option value="">Select niche…</option>
                          {["Fintech", "SaaS", "E-commerce", "Health & Wellness", "Travel", "Real Estate", "Education", "Marketing", "Legal", "Crypto / Web3", "Other"].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Right column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Who writes the article?</label>
                        <div className="checkout-brief-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          {[{ mode: "linkpricer", title: "Linkpricer writes it", sub: `+$${CONTENT_FEE_USD.toFixed(2)} · ${DEFAULT_CONTENT_WORD_COUNT} words`, cp: CONTENT_FEE_USD }, { mode: "upload", title: "I'll upload content", sub: "Free · .docx, .md, .pdf", cp: 0 }].map(opt => (
                            <button key={opt.mode} onClick={() => change(i, { contentMode: opt.mode as BriefItem["contentMode"], contentPrice: opt.cp })} style={{ padding: "10px", borderRadius: 10, textAlign: "left" as const, cursor: "pointer", background: item.contentMode === opt.mode ? C.accent50 : "#fff", border: `1px solid ${item.contentMode === opt.mode ? C.accent : C.line}` }}>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: item.contentMode === opt.mode ? C.accent : C.ink2 }}>{opt.title}</div>
                              <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => change(i, { contentMode: "url", contentPrice: 0 })} style={{ width: "100%", padding: "10px", borderRadius: 10, textAlign: "left" as const, cursor: "pointer", background: item.contentMode === "url" ? C.accent50 : "#fff", border: `1px solid ${item.contentMode === "url" ? C.accent : C.line}` }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: item.contentMode === "url" ? C.accent : C.ink2 }}>Article already published</div>
                          <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Free · provide URL to existing article</div>
                        </button>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>
                          {item.contentMode === "linkpricer" ? "Brief for the editor" : item.contentMode === "upload" ? "Upload article" : "Article URL"}
                        </label>
                        {item.contentMode === "linkpricer" ? (
                          <textarea value={item.brief} onChange={e => change(i, { brief: e.target.value })} style={{ ...inp, minHeight: 100, resize: "vertical" as const, lineHeight: 1.5 }} placeholder="Editorial piece — lead with industry insight…" />
                        ) : item.contentMode === "upload" ? (
                          <div>
                            {item.selectedFile ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px", background: "#fff" }}>
                                <span style={{ fontSize: 16 }}>📄</span>
                                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.selectedFile.name}</span>
                                <button onClick={() => handleRemoveUpload(i)} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 13, padding: 0 }}>Remove</button>
                              </div>
                            ) : (
                              <label
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleFileSelect(i, e.dataTransfer.files[0]); }}
                                style={{ display: "block", border: `1.5px dashed ${C.line}`, borderRadius: 9, padding: 22, textAlign: "center" as const, background: C.bg3, cursor: "pointer" }}
                              >
                                <input
                                  type="file"
                                  accept=".docx,.md,.pdf"
                                  onChange={(e) => { handleFileSelect(i, e.target.files?.[0]); e.target.value = ""; }}
                                  style={{ display: "none" }}
                                />
                                <div style={{ fontSize: 20, color: C.mute }}>↑</div>
                                <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>Drop .docx, .md or .pdf</div>
                                <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>or click to choose · max 5 MB</div>
                              </label>
                            )}
                            {item.uploadError && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>{item.uploadError}</div>}
                          </div>
                        ) : (
                          <input type="url" value={item.articleUrl} onChange={e => change(i, { articleUrl: e.target.value })} style={{ ...inp, fontFamily: C.mono }} placeholder="https://yourbrand.com/blog/article-title" />
                        )}
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Tone</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          {["Editorial", "Authoritative", "Friendly", "Technical"].map(t => (
                            <button key={t} onClick={() => change(i, { tone: t })} style={{ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: item.tone === t ? C.ink : "#fff", color: item.tone === t ? "#fff" : C.ink2, border: `1px solid ${item.tone === t ? C.ink : C.line}` }}>{t}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          {/* RIGHT — summary */}
          <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Estimated cost</h3>
              {items.map(item => (
                <div key={item.domain} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.line2}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.bg3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontWeight: 800, fontSize: 13, color: C.ink2, marginTop: 1 }}>{item.domain[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                      <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 12.5 }}>{item.domain}</span>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: C.bg3, fontWeight: 700, color: C.ink2 }}>DR {item.dr}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#e8f6ee", fontWeight: 700, color: C.good }}>✓ {item.link}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.mute, marginTop: 2 }}>
                      via <strong style={{ color: C.ink2 }}>{item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</strong> · delivery {item.delivery} days{item.traffic > 0 ? ` · ${item.traffic >= 1000000 ? `${(item.traffic / 1000000).toFixed(0)}M` : item.traffic >= 1000 ? `${(item.traffic / 1000).toFixed(0)}K` : item.traffic} traffic` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 13, flexShrink: 0, paddingTop: 2 }}>${fmtCents(Math.round(item.price * 100) + Math.round(item.contentPrice * 100))}</div>
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 13 }}>
                {[{ l: `${items.length} placements subtotal`, v: `$${fmtCents(subtotalCents)}` }, { l: "Linkpricer fee (15%)", v: `$${fmtCents(feeCents)}` }, { l: "VAT (added per invoice)", v: "—", m: true }].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: r.m ? C.mute : C.ink2 }}>
                    <span>{r.l}</span><span style={{ fontFamily: C.mono, fontWeight: 700 }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 6px", marginTop: 6, borderTop: `1px solid ${C.line2}` }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>Estimated total</span>
                  <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 24, color: C.ink, letterSpacing: -0.6 }}>${fmtCents(totalCents)}</span>
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#e8f6ee", border: "1px solid #bbf0c8", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: C.good }}>✓</span>
                  <div style={{ fontSize: 11.5, color: "#0d5e2e", lineHeight: 1.4 }}><strong>$0 charged today.</strong> Each placement is invoiced after the publication URL is delivered and verified live.</div>
                </div>
              </div>
            </div>
            {placeError && (
              <div style={{ padding: "10px 12px", borderRadius: 9, background: "#fee2e2", border: "1px solid #fca5a5", color: C.bad, fontSize: 12.5, fontWeight: 600 }}>
                {placeError}
              </div>
            )}
            <button onClick={handlePlace} disabled={placing} style={{ padding: 16, background: placing ? C.ink2 : C.ink, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: placing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {placingStage === "uploading" ? "Uploading article…" : placingStage === "submitting" ? "Placing order…" : "✓ Place order"}
            </button>
            <div style={{ fontSize: 11.5, color: C.mute, textAlign: "center" as const, lineHeight: 1.5 }}>
              By placing this order you agree to the <span style={{ color: C.accent, cursor: "pointer" }}>marketplace terms</span>. We&apos;ll send an invoice for each placement once the publication URL is delivered.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order Placed Modal ────────────────────────────────────────────────────────
function buildReceiptText(orders: PlacedOrder[]): string {
  const lines: string[] = [];
  lines.push("LINKPRICER — ORDER RECEIPT");
  lines.push(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);
  lines.push("");
  let total = 0;
  for (const o of orders) {
    const amount = o.totalAmount ? parseFloat(o.totalAmount) : 0;
    total += amount;
    const sym = currencySymbol(o.snapshotCurrency);
    lines.push(`Order #${o.id.slice(0, 8)}`);
    lines.push(`  Domain:       ${o.snapshotDomain ?? "—"}`);
    lines.push(`  Marketplace:  ${o.snapshotMarketplaceName ?? "—"}`);
    lines.push(`  Article:      ${o.articleTitle ?? "—"}`);
    lines.push(`  Placed:       ${o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}`);
    lines.push(`  Amount:       ${sym}${amount.toLocaleString()}`);
    lines.push("");
  }
  lines.push(`Total: ${orders.length} placement${orders.length === 1 ? "" : "s"}, ${currencySymbol(orders[0]?.snapshotCurrency)}${total.toLocaleString()}`);
  lines.push("");
  lines.push("$0 charged today. Each placement is invoiced individually once its publication URL is delivered and verified live.");
  return lines.join("\n");
}

function OrderPlacedModal({ orders, onClose }: { orders: PlacedOrder[]; onClose: () => void }) {
  const router = useRouter();
  const orderId = orders[0]?.id?.slice(0, 8) ?? "—";

  function handleDownloadReceipt() {
    const blob = new Blob([buildReceiptText(orders)], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkpricer-receipt-${orders[0]?.id?.slice(0, 8) ?? "order"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,22,32,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: "44px 48px", maxWidth: 700, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "#e8f6ee", color: C.good, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "3px solid #bbf0c8", marginBottom: 14, fontSize: 28 }}>✓</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: C.ink }}>Order confirmed.</h1>
          <p style={{ margin: "6px 0 0", color: C.mute, fontSize: 14 }}>
            <strong style={{ color: C.good }}>$0 charged today.</strong>{" "}Order ID <strong style={{ color: C.ink, fontFamily: C.mono }}>#{orderId}</strong>
          </p>
        </div>
        <div style={{ background: C.bg3, borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: C.mute, textTransform: "uppercase" as const, marginBottom: 14 }}>What happens next</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[{ icon: "✏️", t: "Editors assigned", d: "Within 24 hours, a specialist in your niche will be assigned to each article." }, { icon: "👁️", t: "Drafts ready to review", d: "2–3 days. Review drafts in your dashboard, request edits, or approve for publication." }, { icon: "🔗", t: "Published & invoiced", d: "Once live, we verify the URL and invoice that placement individually." }].map(s => (
              <div key={s.t} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fff", border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>{s.t}</div>
                <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => router.push("/dashboard/orders")} style={{ padding: "12px 22px", background: C.ink, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↗ View your orders</button>
          <button onClick={handleDownloadReceipt} style={{ padding: "12px 22px", background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↓ Download receipt</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Menu ─────────────────────────────────────────────────────────────
// ─── Onboarding tour (pinned tooltip + spotlight) ──────────────────────────────
// Ported from v1-interactive/v1-app.jsx's `Tour` component — a spotlight
// overlay that highlights the real UI element for each step (via a
// `data-tour="..."` selector), auto-scrolls it into view, and drives a
// 3-step walkthrough with canned illustrative data so step 3 always has
// something to show even if the user hasn't run a real search yet.
type TourStep = {
  selector: string;
  title: string;
  body: string;
  onEnter?: () => void;
};

function Tour({
  steps,
  stepIndex,
  setStepIndex,
  onClose,
  onFinish,
}: {
  steps: TourStep[];
  stepIndex: number;
  setStepIndex: (i: number) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => { step?.onEnter?.(); }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf: number;
    const measure = () => {
      const el = step && document.querySelector(step.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      const el = step && document.querySelector(step.selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const y = window.scrollY + r.top - 240;
        window.scrollTo(0, Math.max(0, y));
      }
    }, 130);
    return () => clearTimeout(t);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = stepIndex === steps.length - 1;
  const pad = 8;
  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  const btnPrimary: React.CSSProperties = { padding: "7px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 };
  const btnGhost: React.CSSProperties = { padding: "7px 14px", background: "transparent", color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000 }}>
      <div style={{ position: "absolute", inset: 0 }} onClick={(e) => e.stopPropagation()} />
      {hole && (
        <div
          style={{
            position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            borderRadius: 12, boxShadow: "0 0 0 9999px rgba(15,22,32,0.60)", border: `2px solid ${C.accent}`,
            pointerEvents: "none", transition: "top 0.15s, left 0.15s, width 0.15s, height 0.15s",
          }}
        />
      )}
      {rect && (
        <div style={{ position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)", zIndex: 3002, background: "#fff", borderRadius: 14, boxShadow: "0 12px 32px rgba(15,22,32,0.22)", border: `1px solid ${C.line}`, padding: "16px 18px", width: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.accent, whiteSpace: "nowrap" }}>
              Step {stepIndex + 1} of {steps.length}
            </div>
            <button onClick={onClose} aria-label="Close tour" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.mute, padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{step.title}</div>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {steps.map((_, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i === stepIndex ? C.accent : C.mute2 }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {stepIndex > 0 && <button onClick={() => setStepIndex(stepIndex - 1)} style={btnGhost}>Back</button>}
              {!last
                ? <button onClick={() => setStepIndex(stepIndex + 1)} style={btnPrimary}>Next</button>
                : <button onClick={onFinish} style={btnPrimary}>✓ Got it</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Canned illustrative row so step 3 ("Compare & order") always has something
// to spotlight, even if the user hasn't run a real search yet.
const TOUR_DEMO_ROW: Domain = {
  domain: "forbes.com",
  country: "US",
  lang: "EN",
  category: "Business / Finance",
  dr: 94,
  drUpdatedAt: null,
  drTrend: "up",
  traffic: 71_000_000,
  keywords: 8_400_000,
  refDomains: 1_800_000,
  grade: "A+",
  score: 92,
  bestPrice: 1200,
  yourPrice: null,
  offers: [
    { name: "Vendor: John D.", type: "Vendor", updated: "04-05-2026 11:00", minPrice: 1200, maxPrice: 1200, quality: 3, ratingCount: 0, hasEnoughRatings: false, delivery: 14, tat: 7, link: "Dofollow", example: null },
    { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 1300, maxPrice: 1450, quality: 5, ratingCount: 0, hasEnoughRatings: false, delivery: 10, tat: 5, link: "Dofollow", example: null },
    { name: "Getlinks", type: "DB", updated: "05-05-2026 09:12", minPrice: 1395, maxPrice: 1395, quality: 4, ratingCount: 0, hasEnoughRatings: false, delivery: 7, tat: 4, link: "Dofollow", example: null },
  ],
};

// ─── Main page ────────────────────────────────────────────────────────────────
function SearchPageInner() {
  // Populated when arriving from the homepage AI chat's "Buy now"/"See all
  // suppliers" -> signup/login -> redirect flow (see signup-modal.tsx and
  // login-form.tsx/signup-form.tsx's `redirect` param handling) — lets that
  // flow land the user directly on this domain's real compare-offers view
  // instead of an empty search page.
  const searchParams = useSearchParams();
  const domainParam = (() => {
    const raw = searchParams.get("domain");
    return raw ? normalizeDomain(raw) || null : null;
  })();

  const [pasteValue, setPasteValue] = useState("");
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [niche, setNiche] = useState("general");
  const [nicheOpen, setNicheOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Domain[] | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  // The exact sequence the user entered domains in — kept separate from
  // `results`/`notFound` (which the API splits into found/missing) so the
  // table can display everything back in that original order, not-found
  // domains included in their original position rather than shoved to the
  // bottom.
  const [order, setOrder] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [analyzeHover, setAnalyzeHover] = useState(false);

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => loadRecentSearches());
  const [recentOpen, setRecentOpen] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourInjectedResults, setTourInjectedResults] = useState(false);
  const [tourSeen, setTourSeen] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem("lp_analyze_tour_seen") === "1"; }
    catch { return false; }
  });

  // Force a re-render once hydrateRates() resolves — mutating LIVE_RATES in
  // place doesn't itself trigger React to re-render already-mounted rows.
  const [, forceRatesRerender] = useState(0);
  useEffect(() => {
    hydrateRates().then(() => forceRatesRerender((n) => n + 1));
  }, []);

  // Parse "domain.com 200" or "domain.com $200" lines
  const parsedLines = pasteValue
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [domain, ...rest] = l.split(/\s+/);
      const priceTok = rest.find((t) => /^\$?€?£?\d+(\.\d+)?$/.test(t));
      const rawPrice = priceTok ? parseFloat(priceTok.replace(/[$€£]/, "")) : null;
      // Convert user-entered price from active currency to USD for comparison
      const yourPriceUsd = rawPrice != null ? Math.round(rawPrice / LIVE_RATES[currency]) : null;
      // normalizeDomain (not just .toLowerCase()) so this matches exactly
      // what /api/analyze returns as d.domain (it strips http(s)://, www.,
      // and trailing path/query server-side) — otherwise typing a domain as
      // a URL breaks both the results row order (order/byDomain lookup) and
      // the yourPrice merge below (priceByDomain lookup), since neither
      // would ever match the server's normalized key.
      return { domain: normalizeDomain(domain), yourPriceUsd };
    });

  const parsedDomains = parsedLines.map((l) => l.domain);
  const domainCount = parsedDomains.length;
  const MAX_DOMAINS = 200;

  function handleClear() {
    setPasteValue("");
    setResults(null);
    setNotFound([]);
    setOrder([]);
  }

  // Splits one CSV line into cells, honoring double-quoted fields (so a
  // quoted price like "1,200" or a quoted domain containing a comma isn't
  // split apart).
  function splitCsvLine(line: string, delimiter: string = ","): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  }

  // Excel's default CSV export is semicolon-delimited in most non-US
  // locales (comma is reserved there as the decimal separator), and
  // copy-pasted spreadsheet data is sometimes tab-delimited. A comma-only
  // parser silently mangles both into one unmatched blob per row ("accepts
  // the file, 0 results"), so sniff the real delimiter from the header line.
  function detectCsvDelimiter(sampleLine: string): string {
    const candidates = [",", ";", "\t"];
    let best = ",";
    let bestCount = 0;
    for (const d of candidates) {
      const count = sampleLine.split(d).length - 1;
      if (count > bestCount) { bestCount = count; best = d; }
    }
    return best;
  }

  async function handleCsvFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires this handler.
    e.target.value = "";
    if (!file) return;

    setCsvImportError(null);
    try {
      const text = await file.text();
      const rawLines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);
      if (rawLines.length === 0) {
        setCsvImportError("That file is empty.");
        return;
      }

      const delimiter = detectCsvDelimiter(rawLines[0]);
      const headerFirstCell = splitCsvLine(rawLines[0], delimiter)[0]?.toLowerCase().replace(/^"|"$/g, "");
      const looksLikeHeader = ["domain", "domains", "url", "website", "site"].includes(headerFirstCell ?? "");
      const dataLines = looksLikeHeader ? rawLines.slice(1) : rawLines;

      const symbol = LIVE_SYMS[currency] ?? "$";
      const importedLines: string[] = [];
      for (const line of dataLines) {
        const cells = splitCsvLine(line, delimiter);
        const domain = cells[0]?.trim();
        if (!domain) continue;
        let priceCell = cells[1]?.replace(/[$€£]/g, "").trim();
        // Semicolon-delimited files conventionally use a comma as the
        // decimal separator and a dot for thousands (e.g. "1.200,50").
        if (priceCell && delimiter === ";") {
          priceCell = priceCell.replace(/\./g, "").replace(",", ".");
        } else if (priceCell) {
          priceCell = priceCell.replace(/,/g, "");
        }
        const price = priceCell && /^\d+(\.\d+)?$/.test(priceCell) ? parseFloat(priceCell) : null;
        importedLines.push(price != null ? `${domain} ${symbol}${price}` : domain);
      }

      if (importedLines.length === 0) {
        setCsvImportError("No valid domains found in that file.");
        return;
      }

      setPasteValue((prev) => (prev.trim() ? `${prev.trim()}\n${importedLines.join("\n")}` : importedLines.join("\n")));
    } catch (err) {
      console.error("[handleCsvFileSelected]", err);
      setCsvImportError("Couldn't read that file. Make sure it's a plain CSV.");
    }
  }

  // Records a completed search so it can be re-run from the "Recent
  // searches" dropdown. Dedupes on the exact paste-box text (re-running the
  // same search just bumps it to the top) and caps the list so it can't
  // grow unbounded in localStorage.
  function saveRecentSearch(entry: Omit<RecentSearch, "id" | "timestamp">) {
    setRecentSearches((prev) => {
      const withoutDup = prev.filter((s) => s.pasteValue !== entry.pasteValue);
      const next: RecentSearch[] = [
        { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() },
        ...withoutDup,
      ].slice(0, MAX_RECENT_SEARCHES);
      persistRecentSearches(next);
      return next;
    });
  }

  // `domainsOverride` lets callers (the ?domain= auto-run effect below)
  // trigger analysis directly without round-tripping through `pasteValue`
  // state first — setPasteValue + an immediate handleAnalyze() call in the
  // same tick would still see the *old* parsedDomains/parsedLines from this
  // render's closure, not the just-set value.
  async function handleAnalyze(domainsOverride?: string[]) {
    const domains = domainsOverride ?? parsedDomains;
    if (domains.length === 0) return;
    setAnalyzing(true);
    setResults(null);
    setOrder(domains);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: domains.slice(0, MAX_DOMAINS), niche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      // Merge user-entered yourPrice back in — only meaningful for the
      // paste-box flow; a domain arriving via ?domain= has no user-entered
      // price to merge.
      const priceByDomain = domainsOverride
        ? new Map<string, number | null>()
        : new Map(parsedLines.map((l) => [l.domain, l.yourPriceUsd]));
      const found: Domain[] = (data.found as Domain[]).map((d) => ({
        ...d,
        yourPrice: priceByDomain.get(d.domain) ?? null,
      }));
      setResults(found);
      setNotFound(data.notFound ?? []);

      // Only save real paste-box searches — a ?domain= auto-run arriving
      // from the homepage isn't something the user typed/pasted themselves.
      if (!domainsOverride && pasteValue.trim()) {
        saveRecentSearch({ pasteValue: pasteValue.trim(), currency, niche, domains });
      }
    } catch (err) {
      console.error("[handleAnalyze]", err);
    } finally {
      setAnalyzing(false);
    }
  }

  // Auto-run analysis for a domain arriving via ?domain= (homepage chat ->
  // signup/login redirect). Runs once per distinct domainParam.
  useEffect(() => {
    if (!domainParam) return;
    setPasteValue(domainParam);
    handleAnalyze([domainParam]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainParam]);

  function handleSampleChip(domain: string) {
    setPasteValue((v) => {
      const existing = v
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (existing.includes(domain)) return v;
      return [...existing, domain].join("\n");
    });
  }

  function handleAddToCart(item: Omit<CartItem, "priceType">) {
    // priceType is derived here, once, from whatever niche is currently
    // selected — not passed up from the button click — so every add-to-cart
    // call site (OfferCard's two buttons) can't independently forget it.
    setCartItems((prev) => [...prev, { ...item, priceType: nicheToPriceType(niche) }]);
    setCartOpen(true);
  }

  function handleRemoveFromCart(idx: number) {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const nicheLabel = NICHES.find((n) => n.id === niche)?.label ?? "General";

  function startTour() {
    setTourStep(0);
    setTourActive(true);
  }
  function endTour() {
    setTourActive(false);
    try { window.localStorage.setItem("lp_analyze_tour_seen", "1"); } catch { /* noop */ }
    setTourSeen(true);
    if (tourInjectedResults) {
      setResults(null);
      setNotFound([]);
      setTourInjectedResults(false);
    }
  }
  const finishTour = endTour;

  const tourSteps: TourStep[] = [
    {
      selector: '[data-tour="paste"]',
      title: "1. Add your domains",
      body: 'Add the domains you want to research — up to 200, one per line. For example, forbes.com. Paste a whole list, or use the quick-add chips below the box.',
      onEnter: () => {
        setPasteValue("forbes.com\ntechcrunch.com\nhealthline.com");
        if (tourInjectedResults) { setResults(null); setNotFound([]); setTourInjectedResults(false); }
      },
    },
    {
      selector: '[data-tour="analyze"]',
      title: "2. Click Analyze",
      body: "Hit Analyze and we'll pull live prices and conditions from every marketplace that stocks your domains.",
    },
    {
      selector: '[data-tour="offers"]',
      title: "3. Compare & order in one place",
      body: "Expand any domain to compare every marketplace side by side — price, delivery and link type. Found the best deal? Place the order right here in Linkpricer and we handle the direct connection with every supplier for you. No chasing, no back-and-forth — just the best price.",
      onEnter: () => {
        if (results === null) {
          setResults([TOUR_DEMO_ROW]);
          setNotFound([]);
          setTourInjectedResults(true);
        }
      },
    },
  ];

  return (
    <>
      <style>{`
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .search-root { padding: 12px 12px 32px !important; }
          .search-root, .search-root * { min-width: 0 !important; }
          .search-header { flex-wrap: wrap; gap: 10px; }
          .search-header-brand { order: 1; }
          .search-nav { order: 2; flex-wrap: wrap; width: 100%; gap: 2px !important; }
          .search-nav a, .search-nav span:not(.search-breadcrumb) { padding: 6px 8px !important; font-size: 12.5px !important; }
          .search-breadcrumb { display: none; }
          .search-2col { grid-template-columns: 1fr !important; }
          .search-hero-actions { flex-shrink: 1 !important; width: 100%; }
          .lp-offer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {tourActive && (
        <Tour steps={tourSteps} stepIndex={tourStep} setStepIndex={setTourStep} onClose={endTour} onFinish={finishTour} />
      )}

      {cartOpen && cartItems.length > 0 && (
        <CartPopup
          items={cartItems}
          currency={currency}
          onClose={() => setCartOpen(false)}
          onRemove={handleRemoveFromCart}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal
          cartItems={cartItems}
          onClose={() => setCheckoutOpen(false)}
          onPlaced={(orders) => {
            setCheckoutOpen(false);
            setOrderPlaced(true);
            setCartItems([]);
            setPlacedOrders(orders);
          }}
        />
      )}

      {orderPlaced && (
        <OrderPlacedModal orders={placedOrders} onClose={() => setOrderPlaced(false)} />
      )}

      <div className="search-root" style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto", position: "relative" }}>

        {/* ── TopBar ── */}
        <header className="search-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
          <div className="search-header-brand" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span className="search-breadcrumb" style={{ marginLeft: 4, color: C.mute, fontSize: 12 }}>/ app / analyze</span>
          </div>
          <nav className="search-nav" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {([
              { label: "Analyze", href: null },
              { label: "Related Sites", href: "/dashboard/related-sites" },
              { label: "Favorites", href: "/dashboard/favorites" },
              { label: "Orders", href: "/dashboard/orders" },
            ] as { label: string; href: string | null }[]).map(({ label, href }) =>
              href ? (
                <Link key={label} href={href} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: C.mute, background: "transparent", textDecoration: "none" }}>
                  {label}
                </Link>
              ) : (
                <span key={label} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "default", color: C.ink }}>
                  {label}
                </span>
              )
            )}
            <ProfileMenu />
          </nav>
        </header>

        {/* Floating cart button */}
        {cartItems.length > 0 && (
          <button
            onClick={() => setCartOpen(true)}
            style={{
              position: "absolute",
              top: 32,
              right: 36,
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 99,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 10px rgba(0,82,204,0.3)",
            }}
          >
            🛒 Cart
            <span
              style={{
                background: "#fff",
                color: C.accent,
                borderRadius: 99,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {cartItems.length}
            </span>
          </button>
        )}

        {/* Hero card */}
        <div
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)",
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: 28,
            marginBottom: 20,
          }}
        >
          {/* Hero header row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 20,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.mute, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
                ⚡ Domain Analysis
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>
                Analyze guest post opportunities
              </h1>
              <p style={{ fontSize: 14, color: C.ink3, margin: 0 }}>
                Upload up to 200 domains and compare prices &amp; conditions across every marketplace that stocks them.
              </p>
            </div>
            <div className="search-hero-actions" style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button
                onClick={startTour}
                style={{
                  padding: "7px 14px",
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  background: "#fff",
                  color: C.ink2,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + How to use
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileSelected}
                style={{ display: "none" }}
              />
              <button
                onClick={() => csvInputRef.current?.click()}
                title="Import a CSV with one domain per row (optionally followed by a price column)"
                style={{
                  padding: "7px 14px",
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  background: "#fff",
                  color: C.ink2,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ↑ Import CSV
              </button>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setRecentOpen((v) => !v)}
                  style={{
                    padding: "7px 14px",
                    border: `1px solid ${C.line}`,
                    borderRadius: 8,
                    background: "#fff",
                    color: C.ink2,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ⏱ Recent searches
                </button>
                {recentOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      width: 280,
                      background: "#fff",
                      border: `1px solid ${C.line}`,
                      borderRadius: 9,
                      zIndex: 50,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                      overflow: "hidden",
                    }}
                  >
                    {recentSearches.length === 0 ? (
                      <div style={{ padding: "14px", fontSize: 12.5, color: C.mute }}>
                        No searches yet — run an analysis and it'll show up here.
                      </div>
                    ) : (
                      recentSearches.map((s) => {
                        const label = s.domains.length > 1
                          ? `${s.domains[0]} +${s.domains.length - 1} more`
                          : s.domains[0];
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setPasteValue(s.pasteValue);
                              setCurrency(s.currency);
                              setNiche(s.niche);
                              setRecentOpen(false);
                            }}
                            title="Load this search back into the paste box"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 2,
                              width: "100%",
                              padding: "9px 14px",
                              textAlign: "left",
                              background: "transparent",
                              border: "none",
                              borderBottom: `1px solid ${C.line}`,
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>{label}</span>
                            <span style={{ fontSize: 11, color: C.mute }}>
                              {s.domains.length} domain{s.domains.length === 1 ? "" : "s"} · {s.currency} · {formatRecentSearchTime(s.timestamp)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2-col grid */}
          <div
            className="search-2col"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 320px",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Paste area */}
            <div
              data-tour="paste"
              style={{
                background: "#fff",
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {csvImportError && (
                <div
                  style={{
                    padding: "8px 14px",
                    background: "#fee2e2",
                    borderBottom: "1px solid #fca5a5",
                    color: C.bad,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {csvImportError}
                </div>
              )}
              {/* Top bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderBottom: `1px solid ${C.line}`,
                  background: "#fafbfd",
                }}
              >
                <span style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>
                  Paste domains — one per line. Append a price in{" "}
                  <strong style={{ color: C.ink2 }}>{currency}</strong> to compare:{" "}
                  <span style={{ fontFamily: C.mono, color: C.ink2 }}>
                    forbes.com {currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}200
                  </span>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      background: domainCount > 0 ? C.accent50 : C.line2,
                      color: domainCount > 0 ? C.accent : C.mute,
                      borderRadius: 99,
                      padding: "2px 9px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {domainCount} /{MAX_DOMAINS} domains
                  </span>
                  {domainCount > MAX_DOMAINS && (
                    <span style={{ background: "#fee2e2", color: C.bad, borderRadius: 99, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
                      Truncated!
                    </span>
                  )}
                </div>
                {domainCount > 0 && (
                  <button
                    onClick={handleClear}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.ink3,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "2px 6px",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder={"forbes.com\ntechcrunch.com\nhealthline.com"}
                style={{
                  width: "100%",
                  minHeight: 152,
                  padding: 14,
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: C.mono,
                  fontSize: 13,
                  color: C.ink,
                  background: "transparent",
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Right sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Niche */}
              <div>
                <label
                  style={{ fontSize: 10.5, fontWeight: 800, color: C.mute, display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Niche / Pricing column
                </label>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setNicheOpen((v) => !v)}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      border: `1px solid ${C.line}`,
                      borderRadius: 9,
                      background: "#fff",
                      color: C.ink2,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    {nicheLabel}
                    <span style={{ color: C.mute }}>▾</span>
                  </button>
                  {nicheOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        background: "#fff",
                        border: `1px solid ${C.line}`,
                        borderRadius: 9,
                        zIndex: 50,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                        overflow: "hidden",
                      }}
                    >
                      {NICHES.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => { setNiche(n.id); setNicheOpen(false); }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "9px 14px",
                            textAlign: "left",
                            background: niche === n.id ? C.accent50 : "transparent",
                            color: niche === n.id ? C.accent : C.ink2,
                            border: "none",
                            fontSize: 13,
                            fontWeight: niche === n.id ? 700 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Currency */}
              <div>
                <label
                  style={{ fontSize: 10.5, fontWeight: 800, color: C.mute, display: "block", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Currency
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["USD", "EUR", "GBP"] as Currency[]).map((cur, idx) => {
                    const sym = ["$", "€", "£"][idx];
                    const active = currency === cur;
                    return (
                      <button
                        key={cur}
                        onClick={() => setCurrency(cur)}
                        style={{
                          flex: 1,
                          padding: "8px 0",
                          border: `1px solid ${active ? C.accent : C.line}`,
                          borderRadius: 8,
                          background: active ? C.accent50 : "#fff",
                          color: active ? C.accent : C.ink3,
                          fontSize: 13,
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {cur} {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Analyze button */}
              <button
                data-tour="analyze"
                disabled={domainCount === 0 || analyzing}
                onMouseEnter={() => setAnalyzeHover(true)}
                onMouseLeave={() => setAnalyzeHover(false)}
                onClick={() => handleAnalyze()}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background:
                    domainCount === 0 || analyzing
                      ? C.mute2
                      : analyzeHover
                      ? C.accent700
                      : C.accent,
                  color: domainCount === 0 ? C.mute : "#fff",
                  border: "none",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: domainCount === 0 || analyzing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.15s",
                  marginTop: 4,
                }}
              >
                {analyzing ? (
                  <>
                    <Spinner size={16} />
                    Analyzing…
                  </>
                ) : (
                  "⚡ Analyze domains"
                )}
              </button>
            </div>
          </div>

          {/* Sample chips */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: C.mute, fontWeight: 600 }}>Try with:</span>
            {["forbes.com", "betimate.com", "oneangrygamer.net", "techcrunch.com", "healthline.com", "pitchfork.com"].map((d) => (
              <button
                key={d}
                onClick={() => handleSampleChip(d)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px",
                  background: C.line2,
                  border: `1.5px solid ${C.line}`,
                  borderRadius: 10,
                  color: C.ink2,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + {d}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {results !== null && (
          <ResultsTable
            results={results}
            notFound={notFound}
            order={order}
            currency={currency}
            onAddToCart={handleAddToCart}
            forceExpandDomain={tourActive && tourStep === 2 ? TOUR_DEMO_ROW.domain : (domainParam ?? undefined)}
          />
        )}

        {results === null && !analyzing && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 20px",
              background: "#fff",
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              color: C.ink3,
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.ink2, margin: "0 0 8px" }}>
              Paste domains above and click Analyze
            </p>
            <p style={{ fontSize: 13, color: C.mute, margin: 0 }}>
              We&apos;ll compare prices across 60+ marketplaces and surface the best deal per domain
            </p>
          </div>
        )}

        {analyzing && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 20px",
              background: "#fff",
              border: `1px solid ${C.line}`,
              borderRadius: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                border: `3px solid ${C.line}`,
                borderTopColor: C.accent,
                borderRadius: "50%",
                animation: "lp-spin 0.7s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontSize: 15, fontWeight: 600, color: C.ink2, margin: 0 }}>
              Scanning marketplaces…
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#6b7280" }}>Loading…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}
