"use client";

import { useState, Suspense } from "react";

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
  return Math.round(p * 1.15);
}

function countryFlag(code: string): string {
  if (code === "US") return "🇺🇸";
  if (code === "GB") return "🇬🇧";
  if (code === "DE") return "🇩🇪";
  return "🌐";
}

function gradeStyle(grade: string): { background: string; color: string } {
  if (grade === "A+" || grade === "A")
    return { background: "#e6f6ed", color: "#0a8a4a" };
  if (grade === "B+" || grade === "B")
    return { background: "#fef3c7", color: "#a35d00" };
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
  bestPrice: number;
  yourPrice: number | null;
  offers: Offer[];
};

const SAMPLE_DOMAINS: Domain[] = [
  {
    domain: "forbes.com", country: "US", lang: "EN", category: "Business / Finance",
    dr: 94, drTrend: "up", traffic: 71400000, keywords: 8420000, refDomains: 1840000,
    grade: "A+", score: 92, bestPrice: 1200, yourPrice: null,
    offers: [
      { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 1300, maxPrice: 1450, quality: 5, delivery: 7, tat: 5, link: "Dofollow", example: "https://forbes.com/sites/example/luxury-watches" },
      { name: "Getlinks", type: "API", updated: "05-05-2026 09:12", minPrice: 1395, maxPrice: 1395, quality: 4, delivery: 10, tat: 7, link: "Dofollow", example: "https://forbes.com/sites/example/fintech" },
      { name: "Vendor: John D.", type: "Vendor", updated: "04-05-2026 11:00", minPrice: 1200, maxPrice: 1200, quality: 3, delivery: 14, tat: 12, link: "Dofollow", example: null },
    ],
  },
  {
    domain: "betimate.com", country: "GB", lang: "EN", category: "Sports / Betting",
    dr: 41, drTrend: "up", traffic: 320000, keywords: 24800, refDomains: 980,
    grade: "B+", score: 58, bestPrice: 160, yourPrice: null,
    offers: [
      { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 160, maxPrice: 220, quality: 4, delivery: 5, tat: 4, link: "Dofollow", example: "https://betimate.com/predictions/example" },
      { name: "Getlinks", type: "API", updated: "05-05-2026 09:12", minPrice: 175, maxPrice: 175, quality: 4, delivery: 7, tat: 6, link: "Dofollow", example: null },
    ],
  },
  {
    domain: "oneangrygamer.net", country: "US", lang: "EN", category: "Gaming / Entertainment",
    dr: 58, drTrend: "flat", traffic: 410000, keywords: 38200, refDomains: 2140,
    grade: "A", score: 71, bestPrice: 200, yourPrice: null,
    offers: [
      { name: "Getlinks", type: "API", updated: "05-05-2026 09:12", minPrice: 200, maxPrice: 240, quality: 4, delivery: 8, tat: 7, link: "Dofollow", example: "https://oneangrygamer.net/2025/example-review" },
    ],
  },
  {
    domain: "techcrunch.com", country: "US", lang: "EN", category: "Technology",
    dr: 92, drTrend: "flat", traffic: 14000000, keywords: 1800000, refDomains: 184000,
    grade: "A+", score: 88, bestPrice: 850, yourPrice: null,
    offers: [
      { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 850, maxPrice: 1100, quality: 5, delivery: 10, tat: 8, link: "Dofollow", example: "https://techcrunch.com/example/startup" },
    ],
  },
  {
    domain: "healthline.com", country: "US", lang: "EN", category: "Health",
    dr: 91, drTrend: "up", traffic: 184000000, keywords: 4800000, refDomains: 92000,
    grade: "A+", score: 89, bestPrice: 1100, yourPrice: null,
    offers: [
      { name: "Adsy", type: "API", updated: "05-05-2026 14:30", minPrice: 1100, maxPrice: 1400, quality: 5, delivery: 7, tat: 6, link: "Dofollow", example: null },
    ],
  },
];

// ─── Cart types ───────────────────────────────────────────────────────────────
type CartItem = {
  domain: string;
  offerName: string;
  price: number; // raw USD, pre-fee
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
    <div style={{ background: "#f8f9fc", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, padding: "20px 24px" }}>
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
  onAddToCart,
  typeIcon,
}: {
  offer: Offer;
  isBest: boolean;
  yourPrice: number | null;
  currency: Currency;
  domainName: string;
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ marginBottom: 4 }}>{typeIcon}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{offer.name}</div>
          <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Updated {offer.updated}</div>
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

      {/* Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: C.ink3 }}>Delivery guarantee</span>
          <span style={{ fontWeight: 600, color: C.ink2 }}>{offer.delivery} days</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: C.ink3 }}>Avg. TAT</span>
          <span style={{ fontWeight: 600, color: C.ink2 }}>{offer.tat} days</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center" }}>
          <span style={{ color: C.ink3 }}>Link type</span>
          <span
            style={{
              background: "#e6f6ed",
              color: C.good,
              borderRadius: 4,
              padding: "1px 7px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {offer.link}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center" }}>
          <span style={{ color: C.ink3 }}>Source</span>
          <span
            style={{
              background: C.line2,
              color: C.ink3,
              borderRadius: 4,
              padding: "1px 7px",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {offer.type}
          </span>
        </div>
      </div>

      {/* Example link */}
      {offer.example ? (
        <div
          style={{
            border: `1px dashed ${C.mute2}`,
            borderRadius: 7,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: C.ink3, marginBottom: 3, textTransform: "uppercase" }}>
            Example placement
          </div>
          <a
            href={offer.example}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 11,
              color: C.accent,
              fontFamily: C.mono,
              wordBreak: "break-all",
              textDecoration: "none",
            }}
          >
            {offer.example}
          </a>
        </div>
      ) : (
        <div
          style={{
            border: `1px dashed ${C.mute2}`,
            borderRadius: 7,
            padding: "7px 10px",
          }}
        >
          <div style={{ fontSize: 11, color: C.mute, fontStyle: "italic" }}>No example available</div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          onClick={() =>
            onAddToCart({ domain: domainName, offerName: offer.name, price: ourPrice })
          }
          style={{
            flex: 1,
            padding: "8px 0",
            background: handleHover ? C.accent700 : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          We&apos;ll handle it
        </button>
        <button
          onMouseEnter={() => setBuyHover(true)}
          onMouseLeave={() => setBuyHover(false)}
          onClick={() =>
            onAddToCart({ domain: domainName, offerName: offer.name, price: offer.minPrice })
          }
          style={{
            flex: 1,
            padding: "8px 0",
            background: buyHover ? C.line2 : "#fff",
            color: C.accent,
            border: `1px solid ${C.accent}`,
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Buy direct
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
}: {
  items: CartItem[];
  currency: Currency;
  onClose: () => void;
  onRemove: (idx: number) => void;
}) {
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const fee = Math.round(subtotal * 0.15);
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
          padding: 28,
          width: 440,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: 0 }}>Your cart</h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: C.ink3,
              lineHeight: 1,
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: C.line2,
                borderRadius: 9,
                padding: "10px 14px",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontFamily: C.mono }}>
                  {item.domain}
                </div>
                <div style={{ fontSize: 12, color: C.ink3 }}>{item.offerName}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, color: C.ink }}>{priceFmt(item.price, currency)}</span>
                <button
                  onClick={() => onRemove(idx)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: C.mute,
                    fontSize: 16,
                    lineHeight: 1,
                    padding: "2px 4px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Subtotal</span>
            <span>{priceFmt(subtotal, currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Linkpricer fee (15%)</span>
            <span>{priceFmt(fee, currency)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 700,
              color: C.ink,
              marginTop: 4,
            }}
          >
            <span>Total</span>
            <span>{priceFmt(total, currency)}</span>
          </div>
        </div>

        {/* Pay note */}
        <div
          style={{
            background: "#e6f6ed",
            border: `1px solid #b3e6cd`,
            borderRadius: 8,
            padding: "9px 13px",
            fontSize: 12,
            color: C.good,
            fontWeight: 600,
          }}
        >
          ✓ Pay only after publication
        </div>

        {/* CTA */}
        <button
          style={{
            width: "100%",
            padding: "12px 0",
            background: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 9,
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Continue to brief ›
        </button>
      </div>
    </div>
  );
}

// ─── ResultsTable ─────────────────────────────────────────────────────────────
type SortKey = "domain" | "score" | "dr" | "traffic" | "keywords";
type SortDir = "asc" | "desc";

function ResultsTable({
  results,
  notFound,
  currency,
  onAddToCart,
}: {
  results: Domain[];
  notFound: string[];
  currency: Currency;
  onAddToCart: (item: CartItem) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpen, setFilterOpen] = useState(false);

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

  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: C.mute2, marginLeft: 3 }}>↔</span>;
    return (
      <span style={{ color: C.accent, marginLeft: 3 }}>
        {sortDir === "asc" ? "↑" : "↓"}
      </span>
    );
  }

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
                Domain <SortArrow col="domain" />
              </th>
              <th style={thStyle()}>Actions</th>
              <th style={thStyle("score")} onClick={() => handleSort("score")}>
                Value <SortArrow col="score" />
              </th>
              <th style={thStyle()}>Country</th>
              <th style={thStyle("dr")} onClick={() => handleSort("dr")}>
                DR <SortArrow col="dr" />
              </th>
              <th style={thStyle("traffic")} onClick={() => handleSort("traffic")}>
                Traffic <SortArrow col="traffic" />
              </th>
              <th style={thStyle("keywords")} onClick={() => handleSort("keywords")}>
                Keywords <SortArrow col="keywords" />
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
                <>
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
                </>
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
                onAddToCart({ domain: row.domain, offerName: row.offers[0].name, price: row.bestPrice })
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
              Buy {priceFmt(row.bestPrice, currency)}
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
  const [analyzeHover, setAnalyzeHover] = useState(false);

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

  function handleAnalyze() {
    if (domainCount === 0) return;
    setAnalyzing(true);
    setResults(null);

    setTimeout(() => {
      const found: Domain[] = [];
      const missing: string[] = [];
      for (const line of parsedLines.slice(0, MAX_DOMAINS)) {
        const match = SAMPLE_DOMAINS.find((s) => s.domain === line.domain);
        if (match) found.push({ ...match, yourPrice: line.yourPriceUsd });
        else missing.push(line.domain);
      }
      setResults(found);
      setNotFound(missing);
      setAnalyzing(false);
    }, 950);
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

  return (
    <>
      <style>{`
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {cartOpen && cartItems.length > 0 && (
        <CartPopup
          items={cartItems}
          currency={currency}
          onClose={() => setCartOpen(false)}
          onRemove={handleRemoveFromCart}
        />
      )}

      <div style={{ padding: "20px 32px 40px", maxWidth: 1440, margin: "0 auto", position: "relative" }}>

        {/* ── TopBar ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span style={{ marginLeft: 4, color: C.mute, fontSize: 12 }}>/ app / analyze</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {["Analyze", "Lists", "Orders", "Vendors", "Reports"].map((tab) => (
              <span key={tab} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: tab === "Analyze" ? C.ink : C.mute, background: tab === "Analyze" ? "#eef0f4" : "transparent" }}>
                {tab}
              </span>
            ))}
            <span style={{ width: 1, height: 20, background: C.line, margin: "0 10px" }} />
            <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", border: `1.5px solid ${C.line}`, borderRadius: 8, background: "rgba(15,22,32,0.04)", fontSize: 12.5, fontWeight: 700, color: C.ink2, cursor: "pointer" }}>
              🔍 Search
            </button>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #2c64f0, #7c3aed)", marginLeft: 8 }} />
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
                    {domainCount}/{MAX_DOMAINS} domains
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
            {SAMPLE_DOMAINS.map((d) => (
              <button
                key={d.domain}
                onClick={() => handleSampleChip(d.domain)}
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
                + {d.domain}
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
