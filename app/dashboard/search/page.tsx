"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { PurchaseModal } from "@/components/purchase/PurchaseModal";

const DEMO_ROWS = [
  { domain: "forbes.com", marketplace: "Marketplace A", price: "$1,450", dr: 83, traffic: "803.9K" },
  { domain: "techcrunch.com", marketplace: "Marketplace B", price: "$1,100", dr: 79, traffic: "521.2K" },
  { domain: "theverge.com", marketplace: "Marketplace C", price: "$920", dr: 76, traffic: "417.5K" },
  { domain: "wired.com", marketplace: "Marketplace A", price: "$1,280", dr: 80, traffic: "692.1K" },
  { domain: "mashable.com", marketplace: "Marketplace D", price: "$680", dr: 71, traffic: "310.4K" },
];

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e8eaed",
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SearchPageInner() {
  const { loading } = useAuthContext();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [btnHover, setBtnHover] = useState(false);
  const [purchaseDomain, setPurchaseDomain] = useState<{ domain: string; marketplace: string } | null>(null);

  useEffect(() => {
    if (initialQ) {
      setSearching(true);
      const t = setTimeout(() => {
        setSearching(false);
        setShowResults(true);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [initialQ]);

  if (loading) return <LoadingSpinner />;

  function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setShowResults(false);
    setTimeout(() => {
      setSearching(false);
      setShowResults(true);
    }, 1500);
  }

  function toggleFavorite(domain: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <>
    <style>{`
      .search-page { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }
      .search-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      @media (max-width: 768px) {
        .search-page { padding: 20px 16px; }
        .search-footer { flex-direction: column; align-items: flex-start; }
        .search-footer button { width: 100%; justify-content: center; }
      }
    `}</style>
    {purchaseDomain && (
      <PurchaseModal
        domain={purchaseDomain.domain}
        marketplace={purchaseDomain.marketplace}
        onClose={() => setPurchaseDomain(null)}
        onConfirm={() => setPurchaseDomain(null)}
      />
    )}
    <div className="search-page">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: "#000000",
            margin: "0 0 4px",
          }}
        >
          Domain Price Search
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Compare prices across 60+ marketplaces instantly
        </p>
      </div>

      {/* Search card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          padding: 28,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#6b7280",
            margin: "0 0 12px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Bulk Domain Search
        </p>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={"Paste domains, one per line...\n\nforbes.com\ntechcrunch.com\nwired.com"}
          rows={5}
          style={{
            width: "100%",
            padding: "12px 16px",
            border: "1px solid #e8eaed",
            borderRadius: 10,
            fontSize: 14,
            outline: "none",
            background: "#f5f6f8",
            color: "#111827",
            resize: "vertical",
            fontFamily: "monospace",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        <div className="search-footer">
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Enter one domain per line. Up to 50 domains per search.
          </p>
          <button
            onClick={handleSearch}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            disabled={searching}
            style={{
              padding: "10px 28px",
              background: searching ? "#6b9fdb" : btnHover ? "#003a99" : "#0052cc",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              cursor: searching ? "not-allowed" : "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.15s",
            }}
          >
            {searching && (
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid #ffffff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            )}
            {searching ? "Searching..." : "Compare prices"}
          </button>
        </div>
      </div>

      {/* Results */}
      {!showResults && !searching && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ fontSize: 16, color: "#6b7280", fontWeight: 500, margin: "0 0 8px" }}>
            Paste domains above to see prices across 60+ marketplaces
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
            We compare offers in real-time and surface the best deal for each domain
          </p>
        </div>
      )}

      {searching && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid #e8eaed",
              borderTopColor: "#0052cc",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0, fontWeight: 500 }}>
            Scanning 60+ marketplaces...
          </p>
        </div>
      )}

      {showResults && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e8eaed",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
              Results — {DEMO_ROWS.length} offers found
            </h2>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Demo data — live data coming soon</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Domain", "Marketplace", "Best Price", "DR", "Traffic", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        borderBottom: "1px solid #e8eaed",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_ROWS.map((row, idx) => (
                  <ResultRow
                    key={row.domain}
                    row={row}
                    isLast={idx === DEMO_ROWS.length - 1}
                    isFavorite={favorites.has(row.domain)}
                    onToggleFavorite={() => toggleFavorite(row.domain)}
                    onOrder={() => setPurchaseDomain({ domain: row.domain, marketplace: row.marketplace })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </>
  );
}

function ResultRow({
  row,
  isLast,
  isFavorite,
  onToggleFavorite,
  onOrder,
}: {
  row: { domain: string; marketplace: string; price: string; dr: number; traffic: string };
  isLast: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOrder: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [favHover, setFavHover] = useState(false);
  const [orderHover, setOrderHover] = useState(false);

  return (
    <tr
      style={{
        background: hover ? "#f9fafb" : "#ffffff",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          fontWeight: 600,
          color: "#0052cc",
          fontSize: 14,
        }}
      >
        {row.domain}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#6b7280",
          fontSize: 14,
        }}
      >
        {row.marketplace}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#006621",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {row.price}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#374151",
          fontSize: 14,
        }}
      >
        {row.dr}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#374151",
          fontSize: 14,
        }}
      >
        {row.traffic}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onToggleFavorite}
            onMouseEnter={() => setFavHover(true)}
            onMouseLeave={() => setFavHover(false)}
            title={isFavorite ? "Remove from favorites" : "Save to favorites"}
            style={{
              background: isFavorite ? "#fee2e2" : favHover ? "#f5f6f8" : "transparent",
              border: "1px solid",
              borderColor: isFavorite ? "#fca5a5" : "#e8eaed",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: 13,
              transition: "all 0.15s",
            }}
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
          <button
            onClick={onOrder}
            onMouseEnter={() => setOrderHover(true)}
            onMouseLeave={() => setOrderHover(false)}
            style={{
              padding: "6px 14px",
              background: orderHover ? "#003a99" : "#0052cc",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "background 0.15s",
            }}
          >
            Order
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading...</div>}>
      <SearchPageInner />
    </Suspense>
  );
}
