"use client";

import React, { useState, Suspense, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";

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
function priceFmt(usd: number | null, cur: Currency): string {
  if (usd == null) return "—";
  const rates: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };
  const syms: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£" };
  const v = Math.round(usd * rates[cur]);
  return syms[cur] + v.toLocaleString();
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

function Stars({ n }: { n: number }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: 13 }}>
      {[1, 2, 3, 4, 5].map((i) => (i <= n ? "★" : "☆")).join("")}
    </span>
  );
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


// ─── Cart types ───────────────────────────────────────────────────────────────
type CartItem = {
  domain: string;
  dr: number;
  traffic: number;
  offerName: string;
  offerType: "API" | "Vendor" | "DB";
  price: number; // raw USD, pre-fee
  delivery: number;
  link: string;
  orderType: "managed" | "direct";
};

// ─── ExpandedPanel ────────────────────────────────────────────────────────────
function ExpandedPanel({
  domainData,
  currency,
  onAddToCart,
}: {
  domainData: Domain;
  currency: Currency;
  onAddToCart: (item: CartItem) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const sortedOffers = [...domainData.offers].sort((a, b) => a.minPrice - b.minPrice);
  const offers = showAll ? sortedOffers : sortedOffers.slice(0, 3);
  const bestPrice = sortedOffers[0]?.minPrice ?? null;

  function typeIcon(type: string) {
    if (type === "API") return <span style={{ color: C.accent, fontWeight: 700, fontSize: 11 }}>⚡ API</span>;
    if (type === "Vendor") return <span style={{ color: "#a35d00", fontWeight: 700, fontSize: 11 }}>◈ Vendor</span>;
    return <span style={{ color: C.ink3, fontWeight: 700, fontSize: 11 }}>◇ DB</span>;
  }

  return (
    <div data-tour="offers" style={{ background: "#f8f9fc", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "20px 24px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
            {showAll ? "All marketplaces" : "Top 3 best prices"}
          </span>
          <span style={{ fontSize: 12, color: C.mute }}>{sortedOffers.length} marketplace{sortedOffers.length !== 1 ? "s" : ""} stock this domain</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${C.line}`, background: "rgba(15,22,32,0.04)", color: C.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {showAll ? "Show top 3" : `Show all (${sortedOffers.length})`}
          </button>
          <button
            style={{ padding: "5px 12px", borderRadius: 7, border: `1.5px solid ${C.line}`, background: "rgba(15,22,32,0.04)", color: C.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            ▾ Filter
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
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
  onAddToCart: (item: CartItem) => void;
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
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{offer.name}</div>
            <div style={{ fontSize: 11, color: C.mute }}>Updated {offer.updated}</div>
          </div>
        </div>
        <Stars n={offer.quality} />
      </div>

      {/* Price grid: 2 or 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: yourPrice != null ? "1fr 1fr 1fr" : "1fr 1fr", gap: 1, background: C.line2, border: `1px solid ${C.line2}`, borderRadius: 10, overflow: "hidden" }}>
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
          { label: "Delivery guarantee", value: `${offer.delivery} days` },
          { label: "Avg. TAT", value: `${offer.tat} days` },
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
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const fee = Math.round(items.filter(i => i.orderType === "managed").reduce((s, i) => s + i.price, 0) * 0.15);
  const total = subtotal + fee;

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
                <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>via <strong style={{ color: C.ink2 }}>{item.offerName}</strong></div>
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
            <span>{priceFmt(subtotal, currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Linkpricer fee <span style={{ fontSize: 11 }}>(15%)</span></span>
            <span>{priceFmt(fee, currency)}</span>
          </div>
          <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: C.ink }}>
            <span>Total</span>
            <span>{priceFmt(total, currency)}</span>
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
          <button style={{ background: "none", border: "none", fontSize: 12.5, color: C.mute, cursor: "pointer", padding: 4, textDecoration: "underline" }}>
            Save as list &amp; buy later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────────
type SortKey = "domain" | "score" | "dr" | "traffic" | "keywords";
type SortDir = "asc" | "desc";

function SortArrow({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <span style={{ color: C.mute2, marginLeft: 3 }}>↔</span>;
  return <span style={{ color: C.accent, marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function ResultsTable({
  results,
  notFound,
  currency,
  onAddToCart,
  forceExpandDomain,
}: {
  results: Domain[];
  notFound: string[];
  currency: Currency;
  onAddToCart: (item: CartItem) => void;
  forceExpandDomain?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpen, setFilterOpen] = useState(false);

  // Onboarding tour step 3 needs a row already expanded so it has something
  // to spotlight ([data-tour="offers"] only exists once a row is open).
  useEffect(() => {
    if (forceExpandDomain) {
      setExpanded((prev) => (prev.has(forceExpandDomain) ? prev : new Set(prev).add(forceExpandDomain)));
    }
  }, [forceExpandDomain]);

  function toggleExpand(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function toggleFav(domain: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...results].sort((a, b) => {
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

  function handleDownloadCSV() {
    const header = "Domain,Country,Category,DR,Traffic,Keywords,Grade,Score,Best Price\n";
    const rows = results
      .map(
        (d) =>
          `${d.domain},${d.country},${d.category},${d.dr},${d.traffic},${d.keywords},${d.grade},${d.score},${d.bestPrice}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkpricer-results.csv";
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

      <div style={{ overflowX: "auto" }}>
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
            {sorted.map((row, idx) => {
              const isExp = expanded.has(row.domain);
              const isFav = favorites.has(row.domain);
              const gs = gradeStyle(row.grade);
              const isLast = idx === sorted.length - 1 && notFound.length === 0;
              return (
                <React.Fragment key={row.domain}>
                  <DomainRow
                    key={row.domain}
                    row={row}
                    isExpanded={isExp}
                    isFavorite={isFav}
                    isLast={isLast}
                    currency={currency}
                    gradeStyle={gs}
                    onToggleExpand={() => toggleExpand(row.domain)}
                    onToggleFav={() => toggleFav(row.domain)}
                    onAddToCart={onAddToCart}
                  />
                  {isExp && (
                    <tr key={row.domain + "-exp"}>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <ExpandedPanel
                          domainData={row}
                          currency={currency}
                          onAddToCart={onAddToCart}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {notFound.map((d, idx) => (
              <tr key={d}>
                <td colSpan={9} style={{ padding: "12px 20px", borderBottom: idx === notFound.length - 1 ? "none" : `1px solid ${C.line}`, fontSize: 13 }}>
                  <span style={{ fontFamily: C.mono, color: C.ink2 }}>{d}</span>
                  <span style={{ color: C.mute, marginLeft: 10 }}>— not found in any marketplace</span>
                </td>
              </tr>
            ))}
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
  onAddToCart: (item: CartItem) => void;
}) {
  const [hover, setHover] = useState(false);
  const [buyHover, setBuyHover] = useState(false);

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
        <span style={{ fontWeight: 700, color: C.ink }}>{row.dr}</span>
        {row.drTrend === "up" && <span style={{ color: C.good, marginLeft: 4 }}>↑</span>}
        {row.drTrend === "flat" && <span style={{ color: C.mute, marginLeft: 4 }}>—</span>}
        {row.drTrend === "down" && <span style={{ color: C.bad, marginLeft: 4 }}>↓</span>}
      </td>

      {/* Traffic */}
      <td style={{ ...tdBase, color: C.ink2 }}>{fmtNum(row.traffic)}</td>

      {/* Keywords */}
      <td style={{ ...tdBase, color: C.ink2 }}>{fmtNum(row.keywords)}</td>

      {/* Category */}
      <td style={tdBase}>
        <span
          style={{
            background: C.line2,
            color: C.ink3,
            borderRadius: 99,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
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
};

function CheckoutModal({ cartItems, onClose, onPlaced }: {
  cartItems: CartItem[];
  onClose: () => void; onPlaced: (orders: { id: string }[]) => void;
}) {
  const [items, setItems] = useState<BriefItem[]>(() =>
    cartItems.map(c => ({ ...c, title: "", targetUrl: "", anchorText: "", niche: "", contentMode: "linkpricer", brief: "", articleUrl: "", tone: "Editorial", contentPrice: 120 }))
  );
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [placing, setPlacing] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price + i.contentPrice, 0);
  const fee = Math.round(items.filter(i => i.orderType === "managed").reduce((s, i) => s + i.price + i.contentPrice, 0) * 0.15);
  const total = subtotal + fee;
  const readyCount = items.filter(i => i.contentMode === "linkpricer" ? (!!i.title && !!i.targetUrl && !!i.anchorText && !!i.brief) : i.contentMode === "url" ? (!!i.targetUrl && !!i.anchorText && !!i.articleUrl) : (!!i.targetUrl && !!i.anchorText)).length;
  const [placeError, setPlaceError] = useState<string | null>(null);

  function change(idx: number, patch: Partial<BriefItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function handlePlace() {
    setPlaceError(null);
    if (readyCount < items.length) {
      setPlaceError("Please fill in the required fields for every placement before confirming.");
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({
            domain: i.domain,
            offerName: i.offerName,
            offerType: i.offerType,
            orderType: i.orderType,
            articleTitle: i.title || undefined,
            targetUrl: i.targetUrl,
            anchorText: i.anchorText,
            contentNiche: i.niche || undefined,
            contentTone: i.tone || undefined,
            contentOption: i.contentMode === "linkpricer" ? "provided" : i.contentMode === "upload" ? "uploaded" : "url",
            wordCount: i.contentMode === "linkpricer" ? 750 : undefined,
            requirements: i.contentMode === "linkpricer" ? i.brief : undefined,
            articleUrl: i.contentMode === "url" ? i.articleUrl : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to place order");
      }
      onPlaced(data.orders as { id: string }[]);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,22,32,0.55)", backdropFilter: "blur(4px)", overflowY: "auto" }}>
      <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 32px 60px" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span style={{ marginLeft: 14, fontSize: 12, color: C.mute }}>
              <button onClick={onClose} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12, padding: 0 }}>Cart</button>
              <span style={{ margin: "0 8px" }}>›</span>
              <span style={{ color: C.ink2 }}>Checkout</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, color: C.mute, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.good }}>✓</span> Secure checkout · escrow protected
            </span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 18, color: C.mute, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </header>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 24 }}>
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

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 400px", gap: 18, alignItems: "flex-start" }}>
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
              const ready = !!(item.title && item.targetUrl && item.anchorText && item.brief);
              return (
              <div key={item.domain + i} style={{ background: "#fff", border: `1px solid ${expandedIdx === i ? C.accent : C.line}`, borderRadius: 14, overflow: "hidden", boxShadow: expandedIdx === i ? `0 0 0 3px ${C.accent50}` : "none" }}>
                {/* Card header row */}
                <div onClick={() => setExpandedIdx(prev => prev === i ? -1 : i)} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderBottom: expandedIdx === i ? `1px solid ${C.line2}` : "none", background: expandedIdx === i ? C.accent50 : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: ready ? "#e8f6ee" : "#fdf2dd", color: ready ? C.good : "#a35d00", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, border: `1px solid ${ready ? "#bbf0c8" : "#f3d99c"}` }}>
                    {ready ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{item.domain}</span>
                      <span style={{ fontSize: 11, color: C.mute }}>via {item.offerName}</span>
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
                  <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          {[{ mode: "linkpricer", title: "Linkpricer writes it", sub: "+$120 · 750 words", cp: 120 }, { mode: "upload", title: "I'll upload content", sub: "Free · .docx, .md, .pdf", cp: 0 }].map(opt => (
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
                          <div style={{ border: `1.5px dashed ${C.line}`, borderRadius: 9, padding: 22, textAlign: "center" as const, background: C.bg3, cursor: "pointer" }}>
                            <div style={{ fontSize: 20, color: C.mute }}>↑</div>
                            <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>Drop .docx, .md or .pdf</div>
                            <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>or click to choose · max 5 MB</div>
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
                      via <strong style={{ color: C.ink2 }}>{item.offerName}</strong> · delivery {item.delivery} days{item.traffic > 0 ? ` · ${item.traffic >= 1000000 ? `${(item.traffic / 1000000).toFixed(0)}M` : item.traffic >= 1000 ? `${(item.traffic / 1000).toFixed(0)}K` : item.traffic} traffic` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 13, flexShrink: 0, paddingTop: 2 }}>${(item.price + item.contentPrice).toLocaleString()}</div>
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 13 }}>
                {[{ l: `${items.length} placements subtotal`, v: `$${subtotal.toLocaleString()}` }, { l: "Linkpricer fee (15%)", v: `$${fee.toLocaleString()}` }, { l: "VAT (added per invoice)", v: "—", m: true }].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: r.m ? C.mute : C.ink2 }}>
                    <span>{r.l}</span><span style={{ fontFamily: C.mono, fontWeight: 700 }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 6px", marginTop: 6, borderTop: `1px solid ${C.line2}` }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>Estimated total</span>
                  <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 24, color: C.ink, letterSpacing: -0.6 }}>${total.toLocaleString()}</span>
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
              {placing ? "Placing order…" : "✓ Place order"}
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
function OrderPlacedModal({ orderIds, onClose }: { orderIds: string[]; onClose: () => void }) {
  const orderId = orderIds[0]?.slice(0, 8) ?? "—";
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
          <button onClick={onClose} style={{ padding: "12px 22px", background: C.ink, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↗ View your orders</button>
          <button onClick={onClose} style={{ padding: "12px 22px", background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↓ Download receipt</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Menu ─────────────────────────────────────────────────────────────
function ProfileMenu() {
  const { profile, loading, handleSignOut } = useAuthContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = profile?.displayName
    ? profile.displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : profile?.email?.[0].toUpperCase() ?? "";

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: 8 }}>
      <button
        onClick={() => !loading && setOpen(v => !v)}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: loading ? C.line : "linear-gradient(135deg, #2c64f0, #7c3aed)",
          border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          cursor: loading ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 0.5,
          transition: "background 0.3s ease",
        }}
      >
        {!loading && initials}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 44, width: 220, background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, boxShadow: "0 8px 32px rgba(15,22,32,0.14)", zIndex: 999, overflow: "hidden" }}>
          {/* User info */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #2c64f0, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.displayName ?? "User"}</div>
                <div style={{ fontSize: 11.5, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.email}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: "6px 0" }}>
            {[
              { label: "My profile", icon: "👤", href: "/dashboard/profile" },
              { label: "Settings", icon: "⚙️", href: "/dashboard/settings" },
              { label: "My orders", icon: "📦", href: "/dashboard/orders" },
            ].map(item => (
              <a key={item.label} href={item.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13, color: C.ink2, textDecoration: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
            <div style={{ height: 1, background: C.line2, margin: "4px 0" }} />
            <button
              onClick={handleSignOut}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", width: "100%", fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 15 }}>🚪</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  drTrend: "up",
  traffic: 71_000_000,
  keywords: 8_400_000,
  refDomains: 1_800_000,
  grade: "A+",
  score: 92,
  bestPrice: 1200,
  yourPrice: null,
  offers: [
    { name: "Vendor: John D.", type: "Vendor", updated: "04-05-2026 11:00", minPrice: 1200, maxPrice: 1200, quality: 3, delivery: 14, tat: 7, link: "Dofollow", example: null },
    { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 1300, maxPrice: 1450, quality: 5, delivery: 10, tat: 5, link: "Dofollow", example: null },
    { name: "Getlinks", type: "DB", updated: "05-05-2026 09:12", minPrice: 1395, maxPrice: 1395, quality: 4, delivery: 7, tat: 4, link: "Dofollow", example: null },
  ],
};

// ─── Main page ────────────────────────────────────────────────────────────────
function SearchPageInner() {
  const [pasteValue, setPasteValue] = useState("");
  const [niche, setNiche] = useState("general");
  const [nicheOpen, setNicheOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<Domain[] | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderIds, setPlacedOrderIds] = useState<string[]>([]);
  const [analyzeHover, setAnalyzeHover] = useState(false);

  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourInjectedResults, setTourInjectedResults] = useState(false);
  const [tourSeen, setTourSeen] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem("lp_analyze_tour_seen") === "1"; }
    catch { return false; }
  });

  const RATES: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };

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
      const yourPriceUsd = rawPrice != null ? Math.round(rawPrice / RATES[currency]) : null;
      return { domain: domain.toLowerCase(), yourPriceUsd };
    });

  const parsedDomains = parsedLines.map((l) => l.domain);
  const domainCount = parsedDomains.length;
  const MAX_DOMAINS = 200;

  function handleClear() {
    setPasteValue("");
    setResults(null);
    setNotFound([]);
  }

  async function handleAnalyze() {
    if (domainCount === 0) return;
    setAnalyzing(true);
    setResults(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: parsedDomains.slice(0, MAX_DOMAINS) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      // Merge user-entered yourPrice back in
      const priceByDomain = new Map(parsedLines.map((l) => [l.domain, l.yourPriceUsd]));
      const found: Domain[] = (data.found as Domain[]).map((d) => ({
        ...d,
        yourPrice: priceByDomain.get(d.domain) ?? null,
      }));
      setResults(found);
      setNotFound(data.notFound ?? []);
    } catch (err) {
      console.error("[handleAnalyze]", err);
    } finally {
      setAnalyzing(false);
    }
  }

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

  function handleAddToCart(item: CartItem) {
    setCartItems((prev) => [...prev, item]);
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
            setPlacedOrderIds(orders.map(o => o.id));
          }}
        />
      )}

      {orderPlaced && (
        <OrderPlacedModal orderIds={placedOrderIds} onClose={() => setOrderPlaced(false)} />
      )}

      <div style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto", position: "relative" }}>

        {/* ── TopBar ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span style={{ marginLeft: 4, color: C.mute, fontSize: 12 }}>/ app / analyze</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
            }}
          >
            <div>
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
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
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
              <button
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
              <button
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
            </div>
          </div>

          {/* 2-col grid */}
          <div
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
                onClick={handleAnalyze}
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
            currency={currency}
            onAddToCart={handleAddToCart}
            forceExpandDomain={tourActive && tourStep === 2 ? TOUR_DEMO_ROW.domain : undefined}
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
