"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

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
          borderTopColor: "#dc2626",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type OverviewStats = { totalUsers: number; totalOrders: number; revenue: number };

function fmtUsd(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

const QUICK_ACTIONS = [
  {
    label: "View all users",
    href: ROUTES.adminUsers,
    icon: "👥",
    description: "Manage user accounts and roles",
  },
  {
    label: "View all orders",
    href: ROUTES.adminOrders,
    icon: "📋",
    description: "Review and manage all platform orders",
  },
];

export default function AdminPage() {
  const { profile, loading } = useAuthContext();
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStats(data))
      .catch(() => {});
  }, []);

  if (loading) return <LoadingSpinner />;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const STAT_CARDS = [
    { label: "Total Users", icon: "👥", value: stats ? stats.totalUsers.toLocaleString("en-US") : "—", color: "#0052cc" },
    { label: "Total Orders", icon: "📋", value: stats ? stats.totalOrders.toLocaleString("en-US") : "—", color: "#0052cc" },
    { label: "Active Marketplaces", icon: "🏪", value: "60+", color: "#006621" },
    { label: "Revenue", icon: "💰", value: stats ? fmtUsd(stats.revenue) : "—", color: "#0052cc" },
  ];

  return (
    <><style>{`.rp{padding:32px 40px;max-width:1200px;margin:0 auto}.stats-g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.qa-g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}@media(max-width:1024px){.stats-g{grid-template-columns:repeat(2,1fr)}}@media(max-width:768px){.rp{padding:20px 16px}.stats-g{grid-template-columns:repeat(2,1fr);gap:12px}.qa-g{grid-template-columns:1fr}}`}</style><div className="rp">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#000000",
            margin: "0 0 4px",
          }}
        >
          Admin Overview
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          {today} — Signed in as {profile?.email}
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {STAT_CARDS.map((card) => (
          <div
            key={card.label}
            style={{
              background: "#ffffff",
              border: "1px solid #e8eaed",
              borderRadius: 12,
              padding: 24,
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: card.color,
                marginBottom: 4,
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <QuickActionCard key={action.href} {...action} />
        ))}
      </div>

      {/* Recent activity */}
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
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>
            Recent Activity
          </h2>
        </div>
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0, fontWeight: 500 }}>
            No recent activity
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "8px 0 0" }}>
            Activity logs will appear here as users interact with the platform
          </p>
        </div>
      </div>
    </div>
    </>
  );
}

function QuickActionCard({
  label,
  href,
  icon,
  description,
}: {
  label: string;
  href: string;
  icon: string;
  description: string;
}) {
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={href}
      style={{
        display: "block",
        background: "#ffffff",
        border: hover ? "1px solid #dc2626" : "1px solid #e8eaed",
        borderRadius: 12,
        padding: 24,
        textDecoration: "none",
        boxShadow: hover
          ? "0 4px 16px rgba(220,38,38,0.10)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        transition: "border 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#111827",
          margin: "0 0 6px",
        }}
      >
        {label}
      </h3>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </Link>
  );
}
