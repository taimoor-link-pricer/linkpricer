"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { getOrderMetaExt } from "@/lib/orders/metadata";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f6f8" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type MonitorStatus = "pending" | "active" | "missing" | "modified" | "error";

const STATUS: Record<OrderStatus, { label: string; bg: string; fg: string; dot: string }> = {
  confirming_with_marketplace: { label: "Confirming w/ Marketplace", bg: "#cce5ff", fg: "#003d99", dot: "#2563eb" },
  approval_required: { label: "Approval Required", bg: "#fce8c6", fg: "#8b5900", dot: "#d97706" },
  price_increase_requested: { label: "Price Increase Requested", bg: "#fce8c6", fg: "#8b5900", dot: "#d97706" },
  article_review: { label: "Article Review", bg: "#fce8c6", fg: "#8b5900", dot: "#d97706" },
  payment_pending: { label: "Payment Pending", bg: "#fce8c6", fg: "#8b5900", dot: "#d97706" },
  waiting_for_publication: { label: "Waiting for Publication", bg: "#ede9fe", fg: "#5b21b6", dot: "#7c3aed" },
  approved: { label: "Approved", bg: "#dcfce7", fg: "#166534", dot: "#16a34a" },
  published: { label: "Published", bg: "#d1fae5", fg: "#065f46", dot: "#059669" },
  complete: { label: "Complete", bg: "#a7f3d0", fg: "#065f46", dot: "#047857" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626" },
};

const MONITOR: Record<MonitorStatus, { label: string; bg: string; fg: string }> = {
  pending:  { label: "Pending",  bg: "#f1f5f9", fg: "#475569" },
  active:   { label: "Active",   bg: "#d1fae5", fg: "#065f46" },
  missing:  { label: "Missing",  bg: "#fee2e2", fg: "#991b1b" },
  modified: { label: "Modified", bg: "#fef3c7", fg: "#92400e" },
  error:    { label: "Error",    bg: "#fee2e2", fg: "#991b1b" },
};

type StatusFilterKey = "all" | OrderStatus;
const STATUS_FILTER_KEYS: StatusFilterKey[] = ["all", ...ORDER_STATUSES];

interface AdminOrder {
  id: string;
  clientEmail: string;
  createdAt: string | null;
  domain: string;
  marketplace: string;
  articleTitle: string;
  contentOption: string;
  wordCount: number | null;
  niche: string;
  total: number;
  currency: string;
  status: OrderStatus;
  monitor: MonitorStatus | null;
  lastCheck: string | null;
  nextCheck: string | null;
  indexed: boolean | null;
  publishedUrl: string | null;
  openReportCount: number;
  reviewNotes: string | null;
  targetUrl: string;
  anchorText: string | null;
}

// Raw shape returned by GET /api/admin/orders.
type ApiRow = {
  order: {
    id: string;
    status: string;
    snapshotDomain: string | null;
    snapshotMarketplaceName: string | null;
    snapshotCurrency: string | null;
    articleTitle: string | null;
    contentOption: string;
    wordCount: number | null;
    totalAmount: string;
    liveUrl: string | null;
    reviewNotes: string | null;
    createdAt: string | null;
    targetUrl: string;
    anchorText: string | null;
    snapshotOfferMetadata: unknown;
  };
  clientEmail: string | null;
  openReportCount: number;
  monitor: { status: string | null; lastCheckedAt: string | null; nextCheckAt: string | null; isIndexed: boolean | null } | null;
};

const CONTENT_OPTION_LABEL: Record<string, string> = {
  provided: "We Write",
  uploaded: "Client Upload",
  url: "Existing Article",
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function mapApiRow(row: ApiRow): AdminOrder {
  const ext = getOrderMetaExt(row.order.snapshotOfferMetadata);
  const status = (ORDER_STATUSES as readonly string[]).includes(row.order.status)
    ? (row.order.status as OrderStatus)
    : "confirming_with_marketplace";
  return {
    id: row.order.id,
    clientEmail: row.clientEmail ?? "—",
    createdAt: fmtDate(row.order.createdAt),
    domain: row.order.snapshotDomain ?? "—",
    marketplace: row.order.snapshotMarketplaceName ?? "—",
    articleTitle: row.order.articleTitle ?? "Custom Article",
    contentOption: CONTENT_OPTION_LABEL[row.order.contentOption] ?? row.order.contentOption,
    wordCount: row.order.wordCount,
    niche: ext.contentNiche ?? "General",
    total: parseFloat(row.order.totalAmount),
    currency: row.order.snapshotCurrency ?? "USD",
    status,
    monitor: (row.monitor?.status as MonitorStatus) ?? null,
    lastCheck: fmtDate(row.monitor?.lastCheckedAt ?? null),
    nextCheck: fmtDate(row.monitor?.nextCheckAt ?? null),
    indexed: row.monitor?.isIndexed ?? null,
    publishedUrl: row.order.liveUrl,
    openReportCount: row.openReportCount,
    reviewNotes: row.order.reviewNotes,
    targetUrl: row.order.targetUrl,
    anchorText: row.order.anchorText,
  };
}

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
        background: "#fff", borderRadius: 10, minWidth: 240,
        border: "1px solid #e8eaed",
        boxShadow: "0 12px 28px rgba(15,22,32,0.14)",
        overflow: "hidden", maxHeight: 340, overflowY: "auto",
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

function MonitorBadge({ status, lastCheck, nextCheck, onStart }: { status: MonitorStatus | null; lastCheck?: string | null; nextCheck?: string | null; onStart: () => void }) {
  if (!status) return (
    <button onClick={onStart} style={{
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
          chk {lastCheck ?? "—"} · next {nextCheck ?? "—"}
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

function OrderRow({
  order, onStatusChange, onEditUrl, onEditNotes, onStartMonitor, onViewDetails, onOpenChat,
}: {
  order: AdminOrder;
  onStatusChange: (id: string, s: OrderStatus) => void;
  onEditUrl: (id: string) => void;
  onEditNotes: (id: string) => void;
  onStartMonitor: (id: string) => void;
  onViewDetails: (id: string) => void;
  onOpenChat: (id: string) => void;
}) {
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
        <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "monospace" }}>{order.clientEmail}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 2 }}>#{order.id.slice(0, 8)} · {order.createdAt ?? "—"}</div>
        {order.openReportCount > 0 && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, padding: "1px 7px", borderRadius: 5, background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700 }}>
            🚩 {order.openReportCount} report{order.openReportCount > 1 ? "s" : ""}
          </div>
        )}
      </td>

      {/* Domain */}
      <td style={tdStyle()}>
        <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{order.domain}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4 }}>{order.marketplace}</div>
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
        <MonitorBadge status={order.monitor} lastCheck={order.lastCheck} nextCheck={order.nextCheck} onStart={() => onStartMonitor(order.id)} />
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
            <button onClick={() => onEditUrl(order.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
              padding: "1px 6px", borderRadius: 4, background: "transparent", border: "none",
              color: "#9ca3af", fontSize: 10, fontWeight: 600, cursor: "pointer",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          </div>
        ) : (
          <button onClick={() => onEditUrl(order.id)} style={{
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
          <IconBtn tooltip="View details" onClick={() => onViewDetails(order.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </IconBtn>
          <IconBtn tooltip="Edit notes" onClick={() => onEditNotes(order.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </IconBtn>
          <IconBtn tooltip="Start monitoring" onClick={() => onStartMonitor(order.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </IconBtn>
          <IconBtn tooltip="Chat with client" onClick={() => onOpenChat(order.id)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </IconBtn>
        </div>
      </td>
    </tr>
  );
}

function IconBtn({ tooltip, children, onClick }: { tooltip: string; children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={tooltip}
      onClick={onClick}
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

function DetailsModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const rows: [string, string][] = [
    ["Order ID", order.id],
    ["Client", order.clientEmail],
    ["Domain", order.domain],
    ["Marketplace", order.marketplace],
    ["Article title", order.articleTitle],
    ["Target URL", order.targetUrl],
    ["Anchor text", order.anchorText ?? "—"],
    ["Content", order.contentOption],
    ["Word count", order.wordCount ? String(order.wordCount) : "—"],
    ["Niche", order.niche],
    ["Total", `${order.currency === "EUR" ? "€" : "$"}${order.total.toLocaleString()}`],
    ["Status", STATUS[order.status].label],
    ["Published URL", order.publishedUrl ?? "—"],
    ["Review notes", order.reviewNotes ?? "—"],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8eaed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Order details</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: "8px 20px" }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 12.5, color: "#111827", wordBreak: "break-all" as const }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AdminChatMessage {
  senderType: "admin" | "client";
  senderName: string;
  body: string;
  time: string;
}

function AdminChatModal({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const { profile } = useAuthContext();
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [chatError, setChatError] = useState("");
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/chat-init`, { method: "POST" });
        if (!res.ok) throw new Error("chat-init failed");
        if (cancelled) return;

        const q = query(collection(db, "orders", order.id, "messages"), orderBy("createdAt", "asc"));
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            const next: AdminChatMessage[] = snap.docs.map((d) => {
              const data = d.data() as { senderType: "admin" | "client"; senderName: string; body: string; createdAt: Timestamp | null };
              const ts = data.createdAt?.toDate();
              return {
                senderType: data.senderType,
                senderName: data.senderName,
                body: data.body,
                time: ts ? ts.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sending…",
              };
            });
            setMessages(next);
            setReady(true);
          },
          (err) => {
            console.error("[AdminChatModal] onSnapshot", err);
            setChatError("Couldn't load messages. Try closing and reopening this chat.");
            setReady(true);
          }
        );
      } catch (err) {
        console.error("[AdminChatModal] chat-init", err);
        setChatError("Couldn't open this chat. Try again in a moment.");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [order.id]);

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || !profile) return;
    setInputValue("");
    try {
      await addDoc(collection(db, "orders", order.id, "messages"), {
        senderId: profile.uid,
        senderType: "admin",
        senderName: profile.displayName || profile.email || "Linkpricer team",
        body: text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[AdminChatModal] send failed", err);
      setChatError("Message didn't send. Check your connection and try again.");
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 640, height: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(15,23,42,0.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8eaed", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Chat: {order.domain}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{order.clientEmail} · {order.articleTitle}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {!ready && <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Loading messages…</div>}
          {chatError && <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center" }}>{chatError}</div>}
          {ready && !chatError && messages.length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>No messages yet.</div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: msg.senderType === "admin" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", padding: "10px 14px", borderRadius: 12, background: msg.senderType === "admin" ? "#0052cc" : "#f3f4f6", color: msg.senderType === "admin" ? "#fff" : "#111827" }}>
                {msg.senderType === "client" && <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6b7280", marginBottom: 2 }}>{msg.senderName}</div>}
                <div style={{ fontSize: 13 }}>{msg.body}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: msg.senderType === "admin" ? "rgba(255,255,255,0.75)" : "#9ca3af" }}>{msg.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #e8eaed", padding: "12px 20px", display: "flex", gap: 10, background: "#f9fafb" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Reply to this customer…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #e8eaed", fontSize: 13, color: "#111827" }}
          />
          <button onClick={handleSend} style={{ padding: "10px 16px", borderRadius: 8, background: "#0052cc", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const { loading: authLoading } = useAuthContext();
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load orders");
      setOrders((data.orders as ApiRow[]).map(mapApiRow));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    const t = setTimeout(load, 200); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, statusFilter, searchQuery]);

  if (authLoading) return <LoadingSpinner />;

  async function handleStatusChange(id: string, newStatus: OrderStatus) {
    let publishedUrl: string | undefined;
    let pendingPriceAmount: number | undefined;
    if (newStatus === "published") {
      const order = orders.find(o => o.id === id);
      publishedUrl = order?.publishedUrl ?? window.prompt("Published URL (required to mark as Published):") ?? undefined;
      if (!publishedUrl) return;
    }
    if (newStatus === "price_increase_requested") {
      const raw = window.prompt("New proposed price (numeric):");
      if (!raw) return;
      pendingPriceAmount = parseFloat(raw);
    }
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, publishedUrl, pendingPriceAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleEditUrl(id: string) {
    const order = orders.find(o => o.id === id);
    const url = window.prompt("Published URL:", order?.publishedUrl ?? "");
    if (!url) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: order?.status, publishedUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update URL");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update URL");
    }
  }

  async function handleEditNotes(id: string) {
    const order = orders.find(o => o.id === id);
    const notes = window.prompt("Internal review notes (not visible to client):", order?.reviewNotes ?? "");
    if (notes == null) return;
    try {
      const res = await fetch(`/api/admin/orders/${id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update notes");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update notes");
    }
  }

  async function handleStartMonitor(id: string) {
    try {
      const res = await fetch(`/api/admin/orders/${id}/monitor`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start monitoring");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start monitoring");
    }
  }

  const counts: Record<string, number> = { all: orders.length };
  for (const key of ORDER_STATUSES) counts[key] = orders.filter(o => o.status === key).length;

  const kpis = [
    { label: "Open orders", value: orders.filter(o => !["published", "complete", "cancelled"].includes(o.status)).length.toString(), detail: `${orders.filter(o => o.status === "waiting_for_publication").length} awaiting publication`, color: "#0052cc" },
    { label: "Revenue (loaded page)", value: "$" + orders.reduce((s, o) => s + o.total, 0).toLocaleString(), detail: `${orders.length} orders`, color: "#166534" },
    { label: "Live monitored links", value: orders.filter(o => o.monitor === "active").length.toString(), detail: `${orders.filter(o => o.monitor === "missing").length} missing`, color: "#a35d00" },
    { label: "Open reports", value: orders.reduce((s, o) => s + o.openReportCount, 0).toString(), detail: "Client-submitted issues", color: "#dc2626" },
  ];

  const detailsOrder = detailsId ? orders.find(o => o.id === detailsId) ?? null : null;
  const chatOrder = chatId ? orders.find(o => o.id === chatId) ?? null : null;

  return (
    <>
      <style>{`
        .admin-orders-page { padding: 32px 40px; max-width: 1400px; margin: 0 auto; }
        @media (max-width: 1024px) { .admin-orders-page { padding: 20px 20px; } }
        @media (max-width: 768px) { .admin-orders-page { padding: 16px 12px; } }
      `}</style>
      <div className="admin-orders-page">

        {detailsOrder && <DetailsModal order={detailsOrder} onClose={() => setDetailsId(null)} />}
        {chatOrder && <AdminChatModal order={chatOrder} onClose={() => setChatId(null)} />}

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#111827" }}>Order management</h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Process, fulfill and track every customer order across the marketplace network.</p>
          </div>
          <a href="/api/admin/orders/export" style={{
            padding: "7px 12px", borderRadius: 8, border: "1px solid #e8eaed",
            background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600,
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export orders
          </a>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterKey)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e8eaed", fontSize: 12.5, fontWeight: 600, color: "#374151", background: "#fff" }}
          >
            <option value="all">All statuses ({counts.all ?? 0})</option>
            {ORDER_STATUSES.map(key => (
              <option key={key} value={key}>{STATUS[key].label} ({counts[key] ?? 0})</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e8eaed", overflow: "visible" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "64px 20px", color: "#9ca3af", fontSize: 13 }}>Loading orders…</div>
          ) : loadError ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#991b1b", fontSize: 13 }}>{loadError}</div>
          ) : orders.length === 0 ? (
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
                  {orders.map(order => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      onEditUrl={handleEditUrl}
                      onEditNotes={handleEditNotes}
                      onStartMonitor={handleStartMonitor}
                      onViewDetails={setDetailsId}
                      onOpenChat={setChatId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{
            padding: "12px 16px", borderTop: "1px solid #f0f2f5",
            fontSize: 12, color: "#9ca3af",
          }}>
            Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
          </div>
        </div>

      </div>
    </>
  );
}
