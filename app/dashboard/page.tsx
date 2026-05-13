"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

const RESPONSIVE = `
  .dash-page { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }
  .dash-search-row { display: flex; gap: 10px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @media (max-width: 1024px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .quick-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .dash-page { padding: 20px 16px; }
    .dash-search-row { flex-direction: column; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .quick-grid { grid-template-columns: 1fr; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const STAT_CARDS = [
  { label: "Total Orders", icon: "📋", value: "—" },
  { label: "Favorites", icon: "❤️", value: "—" },
  { label: "Live Links", icon: "📡", value: "—" },
  { label: "Savings", icon: "💰", value: "—" },
];

const QUICK_LINKS = [
  { title: "Compare Prices", description: "Search 60+ marketplaces to find the best domain prices", icon: "🔍", href: ROUTES.search, cta: "Start searching" },
  { title: "My Orders", description: "Track the status of your link building orders", icon: "🛒", href: ROUTES.orders, cta: "View orders" },
  { title: "Saved Domains", description: "Review domains you've bookmarked for later", icon: "❤️", href: ROUTES.favorites, cta: "View favorites" },
];

export default function DashboardPage() {
  const { profile, loading } = useAuthContext();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const firstName = profile?.displayName?.split(" ")[0] ?? profile?.email?.split("@")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isAdmin = profile?.role === "vendor";

  function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`${ROUTES.search}?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <style>{RESPONSIVE}</style>
      <div className="dash-page">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#000000", margin: "0 0 4px" }}>
              Good morning, {firstName} 👋
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{today}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isAdmin && (
              <Link href={ROUTES.admin} style={{ padding: "8px 16px", background: "#fee2e2", color: "#dc2626", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Admin Panel →
              </Link>
            )}
          </div>
        </div>

        {/* Quick search */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Search domains to compare prices
          </p>
          <div className="dash-search-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="E.g., forbes.com, techcrunch.com..."
              style={{ flex: 1, padding: "11px 16px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", background: "#f5f6f8", color: "#111827" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.background = "#fff"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e8eaed"; e.currentTarget.style.background = "#f5f6f8"; }}
            />
            <button
              onClick={handleSearch}
              style={{ padding: "11px 24px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#003a99"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0052cc"; }}
            >
              Compare prices
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {STAT_CARDS.map((card) => (
            <div key={card.label} style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#0052cc", marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{card.label}</div>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Recent Orders</h2>
            <Link href={ROUTES.orders} style={{ fontSize: 13, color: "#0052cc", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
          </div>
          <div style={{ textAlign: "center", padding: "32px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🛒</div>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 6px", fontWeight: 500 }}>No orders yet</p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px" }}>
              Start by searching for domains to compare prices across 60+ marketplaces
            </p>
            <Link href={ROUTES.search} style={{ padding: "9px 22px", background: "#0052cc", color: "#ffffff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
              Compare prices
            </Link>
          </div>
        </div>

        {/* Quick links */}
        <div className="quick-grid">
          {QUICK_LINKS.map((link) => (
            <QuickCard key={link.href} {...link} />
          ))}
        </div>

      </div>
    </>
  );
}

function QuickCard({ title, description, icon, href, cta }: { title: string; description: string; icon: string; href: string; cta: string }) {
  return (
    <div
      style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 12, padding: 22, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "border 0.15s, box-shadow 0.15s" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#0052cc"; el.style.boxShadow = "0 4px 16px rgba(0,82,204,0.1)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#e8eaed"; el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; }}
    >
      <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{title}</h3>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 14px", lineHeight: 1.5 }}>{description}</p>
      <Link href={href} style={{ fontSize: 13, color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>{cta} →</Link>
    </div>
  );
}
