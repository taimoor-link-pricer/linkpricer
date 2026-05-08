"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

const RESPONSIVE = `
  .orders-page { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }
  .orders-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .filter-tabs { display: flex; gap: 4px; background: #ffffff; border: 1px solid #e8eaed; border-radius: 10px; padding: 4px; width: fit-content; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow-x: auto; max-width: 100%; }
  @media (max-width: 768px) {
    .orders-page { padding: 20px 16px; }
    .filter-tabs { width: 100%; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

type OrderStatus = "Writing" | "Submitted" | "Live" | "Rejected";
const STATUS_STYLES: Record<OrderStatus, { background: string; color: string }> = {
  Writing: { background: "#fef3c7", color: "#92400e" },
  Submitted: { background: "#dbeafe", color: "#1e40af" },
  Live: { background: "#dcfce7", color: "#166534" },
  Rejected: { background: "#fee2e2", color: "#991b1b" },
};
type FilterTab = "All" | OrderStatus;
const FILTER_TABS: FilterTab[] = ["All", "Writing", "Submitted", "Live", "Rejected"];

export default function OrdersPage() {
  const { loading } = useAuthContext();
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const orders: { id: string; domain: string; status: OrderStatus; amount: string; date: string }[] = [];
  const filtered = activeTab === "All" ? orders : orders.filter((o) => o.status === activeTab);

  return (
    <>
      <style>{RESPONSIVE}</style>
      <div className="orders-page">

        <div className="orders-header">
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#000000", margin: "0 0 4px" }}>My Orders</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Track the status of your link building orders</p>
          </div>
          <Link href={ROUTES.search} style={{ padding: "10px 20px", background: "#0052cc", color: "#ffffff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            + New order
          </Link>
        </div>

        {/* Filter tabs */}
        <div style={{ marginBottom: 20 }}>
          <div className="filter-tabs">
            {FILTER_TABS.map((tab) => (
              <TabBtn key={tab} label={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🛒</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>No orders yet</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px" }}>
                Start by searching for domains to compare prices across 60+ marketplaces
              </p>
              <Link href={ROUTES.search} style={{ padding: "10px 24px", background: "#0052cc", color: "#ffffff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", display: "inline-block" }}>
                Compare prices
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Order ID", "Domain", "Status", "Amount", "Date", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e8eaed", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, idx) => {
                    const ss = STATUS_STYLES[order.status];
                    const isLast = idx === filtered.length - 1;
                    const border = isLast ? "none" : "1px solid #f0f2f5";
                    return (
                      <tr key={order.id}>
                        <td style={{ padding: "14px 20px", borderBottom: border, fontFamily: "monospace", fontSize: 12, color: "#6b7280" }}>#{order.id.slice(0, 8)}</td>
                        <td style={{ padding: "14px 20px", borderBottom: border, fontWeight: 600, color: "#111827", fontSize: 14 }}>{order.domain}</td>
                        <td style={{ padding: "14px 20px", borderBottom: border }}>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, ...ss }}>{order.status}</span>
                        </td>
                        <td style={{ padding: "14px 20px", borderBottom: border, color: "#006621", fontWeight: 600, fontSize: 14 }}>{order.amount}</td>
                        <td style={{ padding: "14px 20px", borderBottom: border, color: "#6b7280", fontSize: 13 }}>{order.date}</td>
                        <td style={{ padding: "14px 20px", borderBottom: border }}>
                          <Link href={`${ROUTES.orders}/${order.id}`} style={{ fontSize: 13, color: "#0052cc", textDecoration: "none", fontWeight: 500 }}>View →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 500, background: active ? "#0052cc" : "transparent", color: active ? "#ffffff" : "#6b7280", transition: "all 0.15s", whiteSpace: "nowrap" }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f5f6f8"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}
