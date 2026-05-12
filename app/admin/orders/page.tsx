"use client";

import { useState } from "react";
import { useAuthContext } from "@/lib/contexts/auth-context";

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f6f8" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type OrderStatus = "pending" | "writing" | "approved" | "waiting" | "published" | "cancelled";
type MonitorStatus = "pending" | "active" | "missing" | "modified" | "error";

const STATUS: Record<OrderStatus, { label: string; bg: string; fg: string; dot: string }> = {
  pending:   { label: "Pending",                 bg: "#fdf2dd", fg: "#a35d00", dot: "#d97706" },
  writing:   { label: "Writing",                 bg: "#dbeafe", fg: "#1e40af", dot: "#2563eb" },
  approved:  { label: "Approved",                bg: "#dcfce7", fg: "#166534", dot: "#16a34a" },
  waiting:   { label: "Waiting for publication", bg: "#ede9fe", fg: "#5b21b6", dot: "#7c3aed" },
  published: { label: "Published",               bg: "#d1fae5", fg: "#065f46", dot: "#059669" },
  cancelled: { label: "Cancelled",               bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626" },
};

const MONITOR: Record<MonitorStatus, { label: string; bg: string; fg: string }> = {
  pending:  { label: "Pending",  bg: "#f1f5f9", fg: "#475569" },
  active:   { label: "Active",   bg: "#d1fae5", fg: "#065f46" },
  missing:  { label: "Missing",  bg: "#fee2e2", fg: "#991b1b" },
  modified: { label: "Modified", bg: "#fef3c7", fg: "#92400e" },
  error:    { label: "Error",    bg: "#fee2e2", fg: "#991b1b" },
};

type StatusFilterKey = "All" | OrderStatus;
const STATUS_FILTER_KEYS: StatusFilterKey[] = ["All", "pending", "writing", "approved", "waiting", "published", "cancelled"];
const STATUS_FILTER_LABELS: Record<StatusFilterKey, string> = {
  All: "All", pending: "Pending", writing: "Writing", approved: "Approved", waiting: "Waiting", published: "Published", cancelled: "Cancelled",
};

interface AdminOrder {
  id: string;
  clientName: string;
  clientEmail: string;
  createdAt: string;
  domain: string;
  dr: number;
  marketplace: string;
  articleTitle: string;
  contentOption: string;
  wordCount?: number;
  niche: string;
  total: number;
  currency: "EUR" | "USD";
  status: OrderStatus;
  monitor: MonitorStatus | null;
  lastCheck?: string;
  nextCheck?: string;
  indexed?: boolean | null;
  publishedUrl?: string;
}

const SAMPLE_ORDERS: AdminOrder[] = [
  {
    id: "ord_2k4f1",
    clientName: "James Carter",
    clientEmail: "james@acmeinc.com",
    createdAt: "2 May 2025",
    domain: "techcrunch.com",
    dr: 92,
    marketplace: "Editorial",
    articleTitle: "The Future of AI in Enterprise Software",
    contentOption: "We Write",
    wordCount: 1000,
    niche: "Technology",
    total: 850,
    currency: "USD",
    status: "writing",
    monitor: null,
  },
  {
    id: "ord_9m2x8",
    clientName: "Sofia Reyes",
    clientEmail: "sofia@growthlab.io",
    createdAt: "1 May 2025",
    domain: "entrepreneur.com",
    dr: 88,
    marketplace: "Editorial",
    articleTitle: "10 Growth Hacks for SaaS Startups",
    contentOption: "Client Upload",
    wordCount: 1200,
    niche: "Business",
    total: 620,
    currency: "EUR",
    status: "approved",
    monitor: "active",
    lastCheck: "2h ago",
    nextCheck: "22h",
    indexed: true,
    publishedUrl: "https://entrepreneur.com/growth/10-hacks-saas-startups",
  },
  {
    id: "ord_7t3p9",
    clientName: "Liam Novak",
    clientEmail: "liam@novakdigital.com",
    createdAt: "30 Apr 2025",
    domain: "healthline.com",
    dr: 91,
    marketplace: "Direct",
    articleTitle: "Gut Health Supplements: What Works",
    contentOption: "We Write",
    wordCount: 800,
    niche: "Health",
    total: 490,
    currency: "USD",
    status: "waiting",
    monitor: null,
  },
  {
    id: "ord_5b8q2",
    clientName: "Mia Chen",
    clientEmail: "mia@pixelco.com",
    createdAt: "28 Apr 2025",
    domain: "forbes.com",
    dr: 94,
    marketplace: "Editorial",
    articleTitle: "Why Remote Work is Here to Stay",
    contentOption: "Client Upload",
    niche: "Business",
    total: 1200,
    currency: "USD",
    status: "published",
    monitor: "active",
    lastCheck: "6h ago",
    nextCheck: "18h",
    indexed: true,
    publishedUrl: "https://forbes.com/sites/contributors/remote-work-future",
  },
  {
    id: "ord_3r6l4",
    clientName: "Ethan Brooks",
    clientEmail: "ethan@finvault.co",
    createdAt: "26 Apr 2025",
    domain: "investopedia.com",
    dr: 86,
    marketplace: "Direct",
    articleTitle: "Crypto Portfolio Risk Management 101",
    contentOption: "We Write",
    wordCount: 900,
    niche: "Finance",
    total: 720,
    currency: "EUR",
    status: "pending",
    monitor: null,
  },
  {
    id: "ord_1w9k7",
    clientName: "Aisha Patel",
    clientEmail: "aisha@greentechltd.com",
    createdAt: "24 Apr 2025",
    domain: "wired.com",
    dr: 90,
    marketplace: "Editorial",
    articleTitle: "Solar Panel Efficiency Breakthroughs in 2025",
    contentOption: "We Write",
    wordCount: 1100,
    niche: "Environment",
    total: 940,
    currency: "USD",
    status: "published",
    monitor: "missing",
    lastCheck: "1d ago",
    nextCheck: "—",
    indexed: false,
    publishedUrl: "https://wired.com/story/solar-panel-efficiency-2025",
  },
];

function StatusBadge({ status, editing }: { status: OrderStatus; editing?: boolean }) {
  const s = STATUS[status];
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
      background: s.bg, color: s.fg,
      border: `1px solid ${editing ? s.fg : "transparent"}`,
      cursor: "pointer", letterSpacing: 0.1,
      boxShadow: editing ? "0 0 0 3px rgba(15,22,32,0.06)" : "none",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
      <span>{s.label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={s.fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function StatusDropdown({ current, onSelect, onClose }: { current: OrderStatus; onSelect: (s: OrderStatus) => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
      <div style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
        background: "#fff", borderRadius: 10, minWidth: 220,
        border: "1px solid #e8eaed",
        boxShadow: "0 12px 28px rgba(15,22,32,0.14)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "8px 12px", borderBottom: "1px solid #f0f2f5",
          fontSize: 10.5, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.4, textTransform: "uppercase",
        }}>Change status</div>
        {(Object.entries(STATUS) as [OrderStatus, typeof STATUS[OrderStatus]][]).map(([k, s]) => (
          <button key={k} onClick={() => onSelect(k)} style={{
            width: "100%", padding: "9px 12px", textAlign: "left", border: "none",
            background: k === current ? "#f9fafb" : "#fff",
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontSize: 12.5, color: "#374151",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{s.label}</span>
            {k === current && <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 10.5 }}>current</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function MonitorBadge({ status, lastCheck, nextCheck }: { status: MonitorStatus | null; lastCheck?: string; nextCheck?: string }) {
  if (!status) return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      color: "#9ca3af", background: "transparent",
      border: "1px dashed #e8eaed", cursor: "pointer",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      Start monitoring
    </button>
  );
  const m = MONITOR[status];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
        background: m.bg, color: m.fg, alignSelf: "flex-start",
      }}>
        {m.label}
      </span>
      {(lastCheck || nextCheck) && (
        <span style={{ fontSize: 10.5, color: "#9ca3af" }}>
          chk {lastCheck} · next {nextCheck}
        </span>
      )}
    </div>
  );
}

function IndexedBadge({ indexed }: { indexed?: boolean | null }) {
  if (indexed === null || indexed === undefined) return <span style={{ fontSize: 10.5, color: "#9ca3af" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 700,
      background: indexed ? "#dcfce7" : "#fef3c7",
      color: indexed ? "#166534" : "#92400e",
    }}>
      {indexed ? "✓ Indexed" : "⏳ Not indexed"}
    </span>
  );
}

function OrderRow({ order, onStatusChange }: { order: AdminOrder; onStatusChange: (id: string, s: OrderStatus) => void }) {
  const [hover, setHover] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  return (
    <tr
      style={{ background: hover ? "#fafafa" : "#fff", transition: "background 0.1s", verticalAlign: "top" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Client */}
      <td style={tdStyle()}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{order.clientName}</div>
        <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "monospace", marginTop: 1 }}>{order.clientEmail}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 2 }}>#{order.id.slice(4)} · {order.createdAt}</div>
      </td>

      {/* Domain */}
      <td style={tdStyle()}>
        <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{order.domain}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span style={{
            padding: "1px 6px", background: "#f3f4f6", borderRadius: 4,
            fontSize: 10.5, fontWeight: 700, color: "#374151", fontFamily: "monospace",
          }}>DR {order.dr}</span>
          <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{order.marketplace}</span>
        </div>
      </td>

      {/* Article */}
      <td style={{ ...tdStyle(), maxWidth: 220 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", lineHeight: 1.35 }}>{order.articleTitle}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4 }}>
          {order.contentOption}{order.wordCount ? ` · ${order.wordCount} words` : ""} · {order.niche}
        </div>
      </td>

      {/* Total */}
      <td style={tdStyle()}>
        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: "#111827" }}>
          {order.currency === "EUR" ? "€" : "$"}{order.total.toLocaleString()}
        </div>
        <span style={{
          display: "inline-block", padding: "1px 6px", marginTop: 3,
          background: order.currency === "EUR" ? "#dbeafe" : "#dcfce7",
          color: order.currency === "EUR" ? "#1e40af" : "#166534",
          fontSize: 10, fontWeight: 700, borderRadius: 4,
        }}>{order.currency}</span>
      </td>

      {/* Status */}
      <td style={{ ...tdStyle(), position: "relative" }}>
        <div onClick={() => setStatusOpen(o => !o)}>
          <StatusBadge status={order.status} editing={statusOpen} />
        </div>
        {statusOpen && (
          <StatusDropdown
            current={order.status}
            onSelect={(s) => { onStatusChange(order.id, s); setStatusOpen(false); }}
            onClose={() => setStatusOpen(false)}
          />
        )}
      </td>

      {/* Link Monitor */}
      <td style={tdStyle()}>
        <MonitorBadge status={order.monitor} lastCheck={order.lastCheck} nextCheck={order.nextCheck} />
        {order.status === "published" && (
          <div style={{ marginTop: 4 }}>
            <IndexedBadge indexed={order.indexed} />
          </div>
        )}
      </td>

      {/* Published URL */}
      <td style={{ ...tdStyle(), maxWidth: 240 }}>
        {order.publishedUrl ? (
          <div>
            <a
              href={order.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11.5, color: "#0052cc", fontFamily: "monospace",
                textDecoration: "none", display: "block",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >{order.publishedUrl}</a>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
              padding: "1px 6px", borderRadius: 4, background: "transparent", border: "none",
              color: "#9ca3af", fontSize: 10, fontWeight: 600, cursor: "pointer",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          </div>
        ) : (
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 9px", borderRadius: 6,
            background: "#eff6ff", color: "#1d4ed8",
            border: "1px dashed #93c5fd", fontSize: 11.5, fontWeight: 700,
            cursor: "pointer",
          }}>+ Add URL</button>
        )}
      </td>

      {/* Actions */}
      <td style={tdStyle()}>
        <div style={{ display: "flex", gap: 4 }}>
          <IconBtn tooltip="View details">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </IconBtn>
          <IconBtn tooltip="Download content">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </IconBtn>
          <IconBtn tooltip="Edit notes">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </IconBtn>
          <IconBtn tooltip="Start monitoring">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function IconBtn({ tooltip, children }: { tooltip: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={tooltip}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: hover ? "#f3f4f6" : "#fff",
        border: "1px solid #e8eaed", color: "#6b7280",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "background 0.1s",
      }}
    >{children}</button>
  );
}

function tdStyle(): React.CSSProperties {
  return { padding: "14px 14px", borderBottom: "1px solid #f0f2f5", verticalAlign: "top" };
}

export default function AdminOrdersPage() {
  const { loading } = useAuthContext();
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>(SAMPLE_ORDERS);

  if (loading) return <LoadingSpinner />;

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || o.domain.toLowerCase().includes(q) || o.clientEmail.toLowerCase().includes(q) || o.articleTitle.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts: Record<string, number> = { All: orders.length };
  for (const key of ["pending", "writing", "waiting", "published", "cancelled"] as OrderStatus[]) {
    counts[key] = orders.filter(o => o.status === key).length;
  }

  function handleStatusChange(id: string, newStatus: OrderStatus) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
  }

  const kpis = [
    { label: "Open orders",         value: orders.filter(o => !["published", "cancelled"].includes(o.status)).length.toString(), detail: `${orders.filter(o => o.status === "waiting").length} awaiting publication`, color: "#0052cc" },
    { label: "Past 30d revenue",    value: "$" + orders.reduce((s, o) => s + o.total, 0).toLocaleString(), detail: "+18% vs last month", color: "#166534" },
    { label: "Avg fulfillment",     value: "6.2 days", detail: "-0.8d vs last month", color: "#166534" },
    { label: "Live monitored links", value: orders.filter(o => o.monitor === "active").length.toString(), detail: `${orders.filter(o => o.monitor === "missing").length} missing`, color: "#a35d00" },
    { label: "SLA breaches (7d)",   value: "2", detail: "Both resolved today", color: "#dc2626" },
  ];

  return (
    <>
      <style>{`
        .admin-orders-page { padding: 32px 40px; max-width: 1400px; margin: 0 auto; }
        @media (max-width: 1024px) { .admin-orders-page { padding: 20px 20px; } }
        @media (max-width: 768px) { .admin-orders-page { padding: 16px 12px; } }
      `}</style>
      <div className="admin-orders-page">

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#111827" }}>Order management</h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Process, fulfill and track every customer order across the marketplace network.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GhostBtn>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Saved views
            </GhostBtn>
            <GhostBtn>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export orders
            </GhostBtn>
            <button style={{
              padding: "7px 12px", borderRadius: 8, background: "#111827", color: "#fff",
              border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              + New manual order
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ padding: "13px 16px", background: "#fff", borderRadius: 10, border: "1px solid #e8eaed" }}>
              <div style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", letterSpacing: -0.4, marginTop: 4, color: "#111827" }}>{k.value}</div>
              <div style={{ fontSize: 11, color: k.color, fontWeight: 700, marginTop: 2 }}>{k.detail}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
          padding: "12px 16px", background: "#fff",
          border: "1px solid #e8eaed", borderRadius: 12, flexWrap: "wrap",
        }}>
          <div style={{
            flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8, background: "#f9fafb",
            border: "1px solid #f0f2f5",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by email, domain, article title or order ID…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#111827" }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_FILTER_KEYS.map(key => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  style={{
                    padding: "7px 12px", borderRadius: 8,
                    background: active ? "#111827" : "#fff",
                    color: active ? "#fff" : "#374151",
                    border: `1px solid ${active ? "#111827" : "#e8eaed"}`,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  {STATUS_FILTER_LABELS[key]}
                  <span style={{
                    padding: "0 6px", borderRadius: 4,
                    background: active ? "rgba(255,255,255,0.15)" : "#f3f4f6",
                    color: active ? "#fff" : "#9ca3af",
                    fontSize: 10.5, fontWeight: 700,
                  }}>{counts[key] ?? 0}</span>
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 24, background: "#e8eaed", flexShrink: 0 }} />

          <GhostBtn>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            More filters
          </GhostBtn>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaed", overflow: "visible" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>No orders found</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                {searchQuery ? "No orders match your search" : "Orders will appear here as users place them"}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Client", "Domain", "Article", "Total", "Status", "Link monitor", "Published URL", "Actions"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
                        textTransform: "uppercase", color: "#9ca3af", textAlign: "left",
                        borderBottom: "1px solid #e8eaed", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <OrderRow key={order.id} order={order} onStatusChange={handleStatusChange} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          <div style={{
            padding: "12px 16px", borderTop: "1px solid #f0f2f5",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 12, color: "#9ca3af",
          }}>
            <span>Showing {filtered.length} of {orders.length} orders</span>
            <div style={{ display: "flex", gap: 6 }}>
              {["‹ Prev", "1", "2", "3", "Next ›"].map((p, i) => (
                <button key={p} style={{
                  padding: "5px 10px", borderRadius: 7,
                  border: "1px solid #e8eaed",
                  background: i === 1 ? "#111827" : "#fff",
                  color: i === 1 ? "#fff" : "#374151",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

function GhostBtn({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 12px", borderRadius: 8,
        border: "1px solid #e8eaed",
        background: hover ? "#f9fafb" : "#fff",
        color: "#374151", fontSize: 12, fontWeight: 600,
        cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        transition: "background 0.1s",
      }}
    >{children}</button>
  );
}
