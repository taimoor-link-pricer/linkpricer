"use client";

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
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  Writing: { background: "#fef3c7", color: "#92400e" },
  Submitted: { background: "#dbeafe", color: "#1e40af" },
  Live: { background: "#dcfce7", color: "#166534" },
  Rejected: { background: "#fee2e2", color: "#991b1b" },
};

type OrderStatus = "Writing" | "Submitted" | "Live" | "Rejected";

// Placeholder order for display
const PLACEHOLDER_ORDER: {
  id: string;
  domain: string;
  status: OrderStatus;
  marketplace: string;
  price: string;
  contentOption: string;
  targetUrl: string;
  anchorText: string;
  createdAt: string;
} = {
  id: "ORD-00000001",
  domain: "example.com",
  status: "Submitted",
  marketplace: "Marketplace A",
  price: "$0.00",
  contentOption: "Standard (500 words)",
  targetUrl: "https://yoursite.com/blog/post",
  anchorText: "best backlink tool",
  createdAt: new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "14px 0",
        borderBottom: "1px solid #f0f2f5",
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "#6b7280",
          fontWeight: 500,
          minWidth: 140,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: 500,
          textAlign: "right",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { loading } = useAuthContext();

  if (loading) return <LoadingSpinner />;

  const order = PLACEHOLDER_ORDER;
  const statusStyle = STATUS_STYLES[order.status] ?? STATUS_STYLES.Submitted;

  return (
    <>
    <style>{`.order-detail{padding:32px 40px;max-width:800px;margin:0 auto}@media(max-width:768px){.order-detail{padding:20px 16px}}`}</style>
    <div className="order-detail">
      {/* Back link */}
      <Link
        href={ROUTES.orders}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "#6b7280",
          textDecoration: "none",
          marginBottom: 24,
          fontWeight: 500,
        }}
      >
        ← Back to orders
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: "#000000",
              margin: "0 0 4px",
            }}
          >
            Order Details
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#9ca3af",
              margin: 0,
              fontFamily: "monospace",
            }}
          >
            {order.id}
          </p>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: "6px 16px",
            borderRadius: 99,
            ...statusStyle,
          }}
        >
          {order.status}
        </span>
      </div>

      {/* Order card */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e8eaed",
          }}
        >
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              margin: 0,
            }}
          >
            Order Summary
          </h2>
        </div>
        <div style={{ padding: "0 24px" }}>
          <DetailRow label="Domain" value={order.domain} />
          <DetailRow label="Marketplace" value={order.marketplace} />
          <DetailRow label="Price" value={order.price} />
          <DetailRow label="Content Option" value={order.contentOption} />
          <DetailRow label="Target URL" value={order.targetUrl} />
          <DetailRow label="Anchor Text" value={order.anchorText} />
          <div style={{ padding: "14px 0" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  fontWeight: 500,
                  minWidth: 140,
                }}
              >
                Created
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#111827",
                  fontWeight: 500,
                }}
              >
                {order.createdAt}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status timeline placeholder */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 16px",
          }}
        >
          Order Timeline
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { label: "Order Placed", done: true },
            { label: "Content Writing", done: order.status !== "Writing" },
            { label: "Submitted to Publisher", done: order.status === "Live" || order.status === "Rejected" },
            { label: "Published Live", done: order.status === "Live" },
          ].map((step, idx) => (
            <div
              key={step.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                paddingBottom: idx < 3 ? 16 : 0,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: step.done ? "#0052cc" : "#e8eaed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.done && (
                  <span style={{ color: "#ffffff", fontSize: 11, fontWeight: 700 }}>✓</span>
                )}
              </div>
              <span
                style={{
                  fontSize: 14,
                  color: step.done ? "#111827" : "#9ca3af",
                  fontWeight: step.done ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
