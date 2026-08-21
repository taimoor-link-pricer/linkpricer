"use client";

import React, { useState, Suspense, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { RATES as LIVE_RATES, SYMS as LIVE_SYMS, hydrateRates } from "@/lib/design-v1/format";
import { normalizeDomain } from "@/lib/normalize-domain";
import { prettyMarketplaceName } from "@/lib/marketplace-name";
import type { PriceType } from "@/lib/orders/types";
import { RatingBadge, type CartItem } from "@/components/dashboard/results-shared";
import { CartPopup } from "@/components/dashboard/checkout-flow";
import { loadCart, persistCart } from "@/lib/cart-storage";

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
      when there are only 3 (or fewer) cards to lay out. "Show all" is capped
      at a fixed 3-column grid too — auto-fit used to let a wide screen pack
      5+ cards onto one line, which read as a broken layout once the list
      grew past 3. Extra offers just wrap onto additional rows of 3.
      lp-offer-grid + the @media rule below collapses either fixed-column
      layout back to a single column on mobile — a hardcoded 1fr-per-offer
      grid has no room to shrink on a narrow screen otherwise, unlike
      auto-fit which already wraps naturally. */}
      <div className="lp-offer-grid" style={{ display: "grid", gridTemplateColumns: showAll ? "repeat(3, minmax(240px, 1fr))" : `repeat(${offers.length}, minmax(0, 1fr))`, gap: 14 }}>
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
  registryMarketplaces,
  selectedMarketplaces,
  setSelectedMarketplaces,
}: {
  results: Domain[];
  notFound: string[];
  order: string[];
  currency: Currency;
  onAddToCart: (item: Omit<CartItem, "priceType">) => void;
  forceExpandDomain?: string;
  // Full marketplace registry + the user's filter selection, owned by the
  // parent page (not this component) precisely because this component gets
  // unmounted and remounted on every search — see the comment by these
  // useState calls in SearchPage for why that matters. Passed down rather
  // than re-derived here so the selection is a genuine persistent search
  // filter, not one scoped to whatever result set happens to be mounted.
  registryMarketplaces: string[] | null;
  selectedMarketplaces: Set<string> | null;
  setSelectedMarketplaces: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // null = neutral/no sort — the default, and also what a 3rd click on an
  // active column returns to (desc -> asc -> none -> desc -> ...).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");

  // "Vendor: X" offers are ad hoc (created per order, not a registered
  // marketplace) so they can't come from the registry fetch — fold in
  // whichever ones actually show up in the current results so they're still
  // filterable, without that being the *only* source of truth for the list.
  const vendorNamesInResults = Array.from(
    new Set(results.flatMap((r) => r.offers.map((o) => o.name)).filter((n) => n.startsWith("Vendor: ")))
  );
  const allMarketplaceNames = Array.from(new Set([...(registryMarketplaces ?? []), ...vendorNamesInResults])).sort(
    (a, b) => a.localeCompare(b)
  );

  const allSelected = selectedMarketplaces != null && allMarketplaceNames.every((m) => selectedMarketplaces.has(m));
  function toggleSelectAll() {
    setSelectedMarketplaces(allSelected ? new Set() : new Set(allMarketplaceNames));
  }
  function toggleMarketplace(name: string) {
    setSelectedMarketplaces((prev) => {
      const next = new Set(prev ?? allMarketplaceNames);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  // The actual displayed/exported result set — each domain's offers trimmed
  // to only the selected marketplaces, with bestPrice/noPrice recomputed
  // from that trimmed set so the collapsed row's price and the expanded
  // panel's "Best price" card never disagree with each other or with what's
  // actually shown. A domain is never dropped outright just because every
  // one of its offers got filtered out — it still shows as a row, with
  // noPrice: true, same as a domain that genuinely has zero live offers.
  const filteredResults: Domain[] =
    selectedMarketplaces == null
      ? results
      : results.map((r) => {
          const offers = r.offers.filter((o) => selectedMarketplaces.has(o.name));
          return {
            ...r,
            offers,
            bestPrice: offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null,
            noPrice: offers.length === 0,
          };
        });

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
    const byDomain = new Map(filteredResults.map((r) => [r.domain, r]));

    if (sortKey === null) {
      const seq = order.length > 0 ? order : [...filteredResults.map((r) => r.domain), ...notFound];
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
      for (const r of filteredResults) if (!seen.has(r.domain)) { rows.push({ kind: "found", row: r }); seen.add(r.domain); }
      for (const d of notFound) if (!seen.has(d)) { rows.push({ kind: "notfound", domain: d }); seen.add(d); }
      return rows;
    }

    const orderedNotFound = order.length > 0 ? order.filter((d) => notFoundSet.has(d)) : notFound;
    return [
      ...sortFound(filteredResults).map((row): TableRow => ({ kind: "found", row })),
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
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 14px",
            border: `1px solid ${filterOpen || !allSelected ? C.accent : C.line}`,
            borderRadius: 7,
            background: filterOpen || !allSelected ? C.accent50 : "#fff",
            color: filterOpen || !allSelected ? C.accent700 : C.ink2,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {filterOpen ? "▴" : "▾"} Marketplaces
          {selectedMarketplaces != null && !allSelected && (
            <span style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: C.accent, color: "#fff", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {selectedMarketplaces.size}/{allMarketplaceNames.length}
            </span>
          )}
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
        <div style={{ padding: "14px 20px", background: C.line2, borderBottom: `1px solid ${C.line}` }}>
          {registryMarketplaces == null ? (
            <div style={{ fontSize: 12, color: C.mute }}>Loading marketplaces…</div>
          ) : allMarketplaceNames.length === 0 ? (
            <div style={{ fontSize: 12, color: C.mute }}>No marketplaces to filter by.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>Marketplaces</span>
                  <span style={{ fontSize: 11.5, color: C.ink3 }}>
                    {selectedMarketplaces?.size ?? allMarketplaceNames.length} of {allMarketplaceNames.length} shown
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    value={marketplaceSearch}
                    onChange={(e) => setMarketplaceSearch(e.target.value)}
                    placeholder="Search marketplaces…"
                    style={{ padding: "6px 10px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink, outline: "none", minWidth: 180 }}
                  />
                  <button
                    onClick={toggleSelectAll}
                    style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${C.line}`, background: "#fff", color: C.accent700, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: "4px 10px",
                  maxHeight: 220,
                  overflowY: "auto",
                  padding: 2,
                }}
              >
                {allMarketplaceNames
                  .filter((name) => !marketplaceSearch.trim() || name.toLowerCase().includes(marketplaceSearch.trim().toLowerCase()) || prettyMarketplaceName(name).toLowerCase().includes(marketplaceSearch.trim().toLowerCase()))
                  .map((name) => {
                    const checked = selectedMarketplaces?.has(name) ?? true;
                    const isVendor = name.startsWith("Vendor: ");
                    const label = isVendor ? name : prettyMarketplaceName(name);
                    return (
                      <label key={name} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", borderRadius: 6, cursor: "pointer", fontSize: 12.5, color: checked ? C.ink2 : C.mute }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleMarketplace(name)} style={{ accentColor: C.accent, width: 14, height: 14, flexShrink: 0, cursor: "pointer" }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={label}>{label}</span>
                      </label>
                    );
                  })}
              </div>
            </>
          )}
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
  const router = useRouter();
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

  // Marketplace filter state, lifted up from ResultsTable: handleAnalyze
  // (below) does setResults(null) while a search is in flight and only
  // setResults(found) once data lands, which unmounts and remounts
  // <ResultsTable> on every single search. Local state there — which is
  // where this used to live — gets wiped on every remount, so a "persistent
  // search filter" ends up behaving like a per-result table filter that
  // silently resets. Living here instead means it survives that cycle.
  const [registryMarketplaces, setRegistryMarketplaces] = useState<string[] | null>(null);
  useEffect(() => {
    fetch("/api/marketplaces")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setRegistryMarketplaces(data.marketplaces as string[]))
      .catch(() => {});
  }, []);

  // null = "no explicit selection yet," rendered as "everything shown" —
  // see ResultsTable's use of this for how that default plays out. Only
  // auto-admit newly-seen "Vendor: X" names (ad hoc, per-order offers that
  // can't come from the /api/marketplaces registry) into an *already
  // explicit* selection, so a fresh vendor offer isn't silently hidden just
  // because the user had deselected some real marketplaces earlier.
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<Set<string> | null>(null);
  useEffect(() => {
    const vendorNames = (results ?? []).flatMap((r) => r.offers.map((o) => o.name)).filter((n) => n.startsWith("Vendor: "));
    if (vendorNames.length === 0) return;
    setSelectedMarketplaces((prev) => {
      if (prev == null) return prev;
      const missing = vendorNames.filter((n) => !prev.has(n));
      if (missing.length === 0) return prev;
      const next = new Set(prev);
      missing.forEach((n) => next.add(n));
      return next;
    });
  }, [results]);

  // Hydrated from localStorage (lib/cart-storage) rather than starting empty
  // — checkout now lives at its own route (/checkout), so a customer who
  // adds items, navigates there, then comes back here (browser back, or the
  // checkout page's own "back" close button) needs this page to pick the
  // cart back up instead of finding it reset to empty.
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCart().items);
  const [cartOpen, setCartOpen] = useState(false);
  const [analyzeHover, setAnalyzeHover] = useState(false);

  // Write-through on every change instead of wrapping each setCartItems call
  // site — cheaper to keep correct as more "add to cart" entry points get
  // added later, and currency (picked independently, above) needs to travel
  // with the cart too so /checkout prices in whatever the customer was
  // actually comparing in.
  useEffect(() => {
    persistCart({ items: cartItems, currency });
  }, [cartItems, currency]);

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
            // Cart's already persisted (the write-through effect above ran
            // on the last add/remove), so /checkout picks it straight up —
            // no state to hand off through the navigation itself.
            setCartOpen(false);
            router.push("/checkout");
          }}
        />
      )}

      <div className="search-root" style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto", position: "relative" }}>

        <DashboardNav active="analyze" />

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
            registryMarketplaces={registryMarketplaces}
            selectedMarketplaces={selectedMarketplaces}
            setSelectedMarketplaces={setSelectedMarketplaces}
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
