"use client";

import { useState } from "react";
import { useAuthContext } from "@/lib/contexts/auth-context";

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

type OrderStatus = "Writing" | "Submitted" | "Live" | "Rejected";

const STATUS_STYLES: Record<OrderStatus, { background: string; color: string }> = {
  Writing: { background: "#fef3c7", color: "#92400e" },
  Submitted: { background: "#dbeafe", color: "#1e40af" },
  Live: { background: "#dcfce7", color: "#166534" },
  Rejected: { background: "#fee2e2", color: "#991b1b" },
};

type StatusFilter = "All" | OrderStatus;
const STATUS_FILTERS: StatusFilter[] = ["All", "Writing", "Submitted", "Live", "Rejected"];

interface AdminOrder {
  id: string;
  domain: string;
  userEmail: string;
  status: OrderStatus;
  amount: string;
  date: string;
}

export default function AdminOrdersPage() {
  const { loading } = useAuthContext();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");

  if (loading) return <LoadingSpinner />;

  // No orders yet
  const orders: AdminOrder[] = [];

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q || o.domain.toLowerCase().includes(q) || o.userEmail.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <>
    <style>{`.admin-orders-page{padding:32px 40px;max-width:1300px;margin:0 auto}@media(max-width:768px){.admin-orders-page{padding:20px 16px}}`}</style>
    <div className="admin-orders-page">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#000000",
            margin: "0 0 4px",
          }}
        >
          All Orders
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          View and manage orders across all platform users
        </p>
      </div>

      {/* Search + filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by domain or email..."
          style={{
            padding: "9px 14px",
            border: "1px solid #e8eaed",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            background: "#ffffff",
            color: "#111827",
            width: 280,
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 10,
            padding: 4,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {STATUS_FILTERS.map((tab) => (
            <TabButton
              key={tab}
              label={tab}
              active={statusFilter === tab}
              onClick={() => setStatusFilter(tab)}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#374151",
                margin: "0 0 8px",
              }}
            >
              No orders found
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              {searchQuery
                ? "No orders match your search"
                : "Orders will appear here as users place them"}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Order ID", "Domain", "User", "Status", "Amount", "Date", ""].map(
                    (h) => (
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
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, idx) => {
                  const isLast = idx === filtered.length - 1;
                  const statusStyle = STATUS_STYLES[order.status];
                  return (
                    <AdminOrderRow
                      key={order.id}
                      order={order}
                      isLast={isLast}
                      statusStyle={statusStyle}
                    />
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

function AdminOrderRow({
  order,
  isLast,
  statusStyle,
}: {
  order: AdminOrder;
  isLast: boolean;
  statusStyle: { background: string; color: string };
}) {
  const [hover, setHover] = useState(false);

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
          fontFamily: "monospace",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        #{order.id.slice(0, 8)}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          fontWeight: 600,
          color: "#111827",
          fontSize: 14,
        }}
      >
        {order.domain}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          fontSize: 13,
          color: "#6b7280",
        }}
      >
        {order.userEmail}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 99,
            ...statusStyle,
          }}
        >
          {order.status}
        </span>
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#006621",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {order.amount}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        {order.date}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <button
          style={{
            padding: "5px 12px",
            background: "transparent",
            border: "1px solid #e8eaed",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            color: "#0052cc",
            fontWeight: 500,
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 14px",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        background: active ? "#dc2626" : hover ? "#f5f6f8" : "transparent",
        color: active ? "#ffffff" : hover ? "#374151" : "#6b7280",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
