"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";
import { getOrderMetaExt } from "@/lib/orders/metadata";
import { ORDER_STATUSES, type OrderStatus, type ClientOrderAction } from "@/lib/orders/types";
import type { OrderStatusChangedMeta, OrderMessageMeta } from "@/lib/orders/events";

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f6f8" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// The 10-state machine isn't strictly linear (price-increase/approval/review are
// side-branches, not sequential steps), so the progress bar collapses them into
// one shared "In progress" stage rather than pretending there's a single line.
const STAGE_IDS = ["placed", "in_progress", "waiting_for_publication", "published", "complete"] as const;
type StageId = (typeof STAGE_IDS)[number];
const STAGE_LABELS: Record<StageId, string> = {
  placed: "Order placed",
  in_progress: "In progress",
  waiting_for_publication: "On marketplace",
  published: "Live · URL delivered",
  complete: "Invoiced",
};
const STATUS_TO_STAGE: Record<OrderStatus, StageId> = {
  confirming_with_marketplace: "in_progress",
  approval_required: "in_progress",
  price_increase_requested: "in_progress",
  article_review: "in_progress",
  payment_pending: "in_progress",
  approved: "in_progress",
  waiting_for_publication: "waiting_for_publication",
  published: "published",
  complete: "complete",
  cancelled: "in_progress",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  confirming_with_marketplace: "Confirming with marketplace",
  approval_required: "Approval required",
  price_increase_requested: "Price increase requested",
  article_review: "Article ready for review",
  payment_pending: "Payment pending",
  approved: "Approved",
  waiting_for_publication: "Waiting for publication",
  published: "Published",
  complete: "Complete",
  cancelled: "Cancelled",
};

interface ApiOrder {
  id: string;
  status: string;
  snapshotDomain: string | null;
  snapshotMarketplaceName: string | null;
  createdAt: string | null;
  targetUrl: string;
  anchorText: string | null;
  wordCount: number | null;
  contentOption: string;
  requirements: string | null;
  articleTitle: string | null;
  selectedPrice: string;
  contentPrice: string | null;
  totalAmount: string;
  snapshotCurrency: string | null;
  snapshotOfferMetadata: unknown;
  liveUrl: string | null;
}

const CONTENT_OPTION_LABEL: Record<string, string> = {
  provided: "We Write",
  uploaded: "Client Upload",
  url: "Existing Article",
};

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ padding: "3px 10px", background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>Cancelled</span>
          <span style={{ fontSize: 12.5, color: "#6b7280" }}>This order was cancelled.</span>
        </div>
      </div>
    );
  }

  const currentStage = STATUS_TO_STAGE[status];
  const currentIdx = STAGE_IDS.indexOf(currentStage);

  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Progress</h3>
        <span style={{ padding: "3px 10px", background: "#dbeafe", color: "#1e40af", fontSize: 11, fontWeight: 700, borderRadius: 999 }}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {STAGE_IDS.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const dotColor = done ? "#059669" : active ? "#0052cc" : "#e8eaed";
          const lineColor = i < currentIdx ? "#059669" : "#e8eaed";
          const labelColor = done ? "#059669" : active ? "#0052cc" : "#9ca3af";

          return (
            <div key={stage} style={{ display: "flex", alignItems: "flex-start", flex: i < STAGE_IDS.length - 1 ? 1 : "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                  background: done ? "#059669" : active ? "#eff6ff" : "#fff",
                  border: `2px solid ${dotColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : active ? (
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "#0052cc" }} />
                  ) : null}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: labelColor, textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {i < STAGE_IDS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: lineColor, marginTop: 14, marginLeft: -1, marginRight: -1 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 600, flexShrink: 0, paddingRight: 12 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600, fontFamily: mono ? "monospace" : "inherit", textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

function DetailsCard({ order }: { order: ApiOrder }) {
  const ext = getOrderMetaExt(order.snapshotOfferMetadata);
  const gpPrice = parseFloat(order.selectedPrice);
  const contentPrice = parseFloat(order.contentPrice ?? "0");
  const total = parseFloat(order.totalAmount);
  const fee = Math.max(0, total - gpPrice - contentPrice);
  const currencySign = order.snapshotCurrency === "EUR" ? "€" : "$";

  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#111827" }}>Order details</h3>
      <KV label="Order ID" value={order.id} mono />
      <KV label="Domain" value={<span style={{ fontFamily: "monospace", fontWeight: 700 }}>{order.snapshotDomain ?? "—"}</span>} />
      <KV label="Marketplace" value={order.snapshotMarketplaceName ?? "—"} />
      <KV label="Article title" value={order.articleTitle ?? "Custom Article"} />
      <KV label="Target URL" value={
        <a href={order.targetUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 12, color: "#0052cc", textDecoration: "none" }}>
          {order.targetUrl} ↗
        </a>
      } />
      {order.anchorText && <KV label="Anchor text" value={`"${order.anchorText}"`} mono />}
      {order.wordCount != null && <KV label="Word count" value={`${order.wordCount} words`} />}
      <KV label="Content" value={CONTENT_OPTION_LABEL[order.contentOption] ?? order.contentOption} />

      {ext.draftUrl && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#e8f5e9", border: "1px solid #c8e6c9" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#006621", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Draft ready</div>
          <a href={ext.draftUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#006621" }}>{ext.draftUrl}</a>
        </div>
      )}

      {order.liveUrl && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#f9fafb", border: "1px dashed #e8eaed" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Published URL</div>
          <a href={order.liveUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#0052cc" }}>{order.liveUrl}</a>
        </div>
      )}

      {order.requirements && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#f9fafb", border: "1px dashed #e8eaed" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Special requirements</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{order.requirements}</div>
        </div>
      )}

      <div style={{ height: 1, background: "#e8eaed", margin: "14px 0" }} />

      <KV label="Guest post" value={`${currencySign}${gpPrice.toFixed(2)}`} mono />
      <KV label="Content writing" value={`${currencySign}${contentPrice.toFixed(2)}`} mono />
      <KV label="Management fee" value={`${currencySign}${fee.toFixed(2)}`} mono />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 0", marginTop: 2 }}>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 800 }}>Total</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 800, fontFamily: "monospace" }}>
          {currencySign}{total.toFixed(2)}
        </span>
      </div>

      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, background: "#f9fafb", border: "1px dashed #e8eaed", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
          <strong>Not yet invoiced.</strong> You&apos;ll be billed once the article goes live and we deliver the publication URL.
        </div>
      </div>
    </div>
  );
}

// ── Client action panel (mirrors dashboard/orders' OrderCard action panels) ──

function ActionPanel({ status, onAction, acting }: { status: OrderStatus; onAction: (a: ClientOrderAction) => void; acting: boolean }) {
  const btn = (bg: string, fg: string, border?: string): React.CSSProperties => ({
    padding: "10px 16px", borderRadius: 8, background: bg, color: fg,
    border: border ?? "none", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1,
    fontWeight: 600, fontSize: 13,
  });

  if (status === "price_increase_requested") {
    return (
      <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16, display: "flex", gap: 12 }}>
        <button disabled={acting} onClick={() => onAction("accept_price_increase")} style={btn("#006621", "#fff")}>Accept price increase</button>
        <button disabled={acting} onClick={() => onAction("decline")} style={btn("#fee2e2", "#8b0000", "1px solid #fecaca")}>Decline</button>
      </div>
    );
  }
  if (status === "approval_required") {
    return (
      <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16, display: "flex", gap: 12 }}>
        <button disabled={acting} onClick={() => onAction("approve_condition_change")} style={btn("#006621", "#fff")}>Approve</button>
        <button disabled={acting} onClick={() => onAction("decline")} style={btn("#fee2e2", "#8b0000", "1px solid #fecaca")}>Decline</button>
      </div>
    );
  }
  if (status === "article_review") {
    return (
      <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16 }}>
        <button disabled={acting} onClick={() => onAction("approve_article")} style={btn("#006621", "#fff")}>Approve article</button>
      </div>
    );
  }
  if (status === "confirming_with_marketplace" || status === "waiting_for_publication" || status === "approved") {
    return (
      <div style={{ marginBottom: 16 }}>
        <button disabled={acting} onClick={() => onAction("cancel")} style={btn("transparent", "#8b0000", "1px solid #fecaca")}>Cancel order</button>
      </div>
    );
  }
  return null;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

type TimelineEntry =
  | { kind: "message"; id: string; createdAt: string; msg: OrderMessageMeta }
  | { kind: "status"; id: string; createdAt: string; evt: OrderStatusChangedMeta };

function Avatar({ from }: { from: "client" | "admin" }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 999, flexShrink: 0,
      background: from === "admin" ? "linear-gradient(135deg, #2c64f0, #4f46e5)" : "linear-gradient(135deg, #f59e0b, #ef4444)",
      color: "#fff", fontWeight: 800, fontSize: 12,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #fff", boxShadow: "0 0 0 1px #e8eaed",
    }}>
      {from === "admin" ? "LP" : "ME"}
    </div>
  );
}

function Bubble({ entry }: { entry: Extract<TimelineEntry, { kind: "message" }> }) {
  const isClient = entry.msg.senderType === "client";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isClient ? "row-reverse" : "row" }}>
      <Avatar from={isClient ? "client" : "admin"} />
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 5, alignItems: isClient ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{isClient ? "You" : entry.msg.senderName ?? "Linkpricer team"}</span>
          <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{new Date(entry.createdAt).toLocaleString()}</span>
        </div>
        {entry.msg.body && (
          <div style={{
            padding: "11px 14px", borderRadius: 14,
            borderTopLeftRadius: isClient ? 14 : 4, borderTopRightRadius: isClient ? 4 : 14,
            background: isClient ? "#0052cc" : "#fff", color: isClient ? "#fff" : "#111827",
            fontSize: 13.5, lineHeight: 1.55,
            border: isClient ? "none" : "1px solid #e8eaed",
          }}>
            {entry.msg.body}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemEvent({ entry }: { entry: Extract<TimelineEntry, { kind: "status" }> }) {
  const text = entry.evt.fromStatus
    ? `Status changed: ${STATUS_LABEL[entry.evt.fromStatus as OrderStatus] ?? entry.evt.fromStatus} → ${STATUS_LABEL[entry.evt.toStatus as OrderStatus] ?? entry.evt.toStatus}`
    : `Order created · ${STATUS_LABEL[entry.evt.toStatus as OrderStatus] ?? entry.evt.toStatus}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
      <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
      <span style={{ padding: "3px 12px", borderRadius: 999, background: "#f3f4f6", fontSize: 10.5, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
    </div>
  );
}

function Chat({ orderId, domain, title }: { orderId: string; domain: string; title: string }) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [msgRes, orderRes] = await Promise.all([
        fetch(`/api/orders/${orderId}/messages`),
        fetch(`/api/orders/${orderId}`),
      ]);
      const msgData = await msgRes.json();
      const orderData = await orderRes.json();
      const msgEntries: TimelineEntry[] = (msgData.messages ?? []).map((m: OrderMessageMeta & { id: string; createdAt: string }) => ({
        kind: "message" as const, id: m.id, createdAt: m.createdAt, msg: m,
      }));
      const statusEntries: TimelineEntry[] = (orderData.statusHistory ?? []).map((e: { id: string; timestamp: string; metadata: OrderStatusChangedMeta }) => ({
        kind: "status" as const, id: e.id, createdAt: e.timestamp, evt: e.metadata,
      }));
      const merged = [...msgEntries, ...statusEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setEntries(merged);
    } catch (err) {
      console.error("[Chat load]", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  async function send() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      setEntries((prev) => [...prev, { kind: "message", id: data.message.id, createdAt: data.message.createdAt, msg: data.message }]);
      setMessage("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{
      background: "#fff", border: "1px solid #e8eaed", borderRadius: 14,
      display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 600, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #e8eaed", display: "flex", alignItems: "center", gap: 12, background: "#fafbfd", flexShrink: 0 }}>
        <Avatar from="admin" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Order conversation</h3>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Linkpricer team · replies within 1 business day</div>
        </div>
        <button title="Reporting is coming soon" disabled style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7,
          background: "#fff", border: "1px solid #e8eaed", color: "#c4c9d1", fontSize: 12, fontWeight: 600,
          cursor: "not-allowed", flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Report
        </button>
      </div>

      <div style={{ padding: "8px 18px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#374151", flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Conversation for <strong style={{ fontFamily: "monospace" }}>{domain}</strong> · <em>&quot;{title}&quot;</em></span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 16, background: "#f5f6f8" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 24 }}>Loading conversation…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 24 }}>No messages yet — send a note below.</div>
        ) : (
          entries.map((entry) => entry.kind === "status" ? <SystemEvent key={entry.id} entry={entry} /> : <Bubble key={entry.id} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 14, borderTop: "1px solid #e8eaed", background: "#fff", flexShrink: 0 }}>
        <div style={{
          border: `1.5px solid ${message ? "#0052cc" : "#e8eaed"}`, borderRadius: 12, padding: "10px 12px",
          boxShadow: message ? "0 0 0 3px #dbeafe" : "none", background: "#fff",
        }}>
          <textarea
            rows={2}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply to our team…"
            style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: 13.5, fontFamily: "inherit", color: "#111827", minHeight: 44, background: "transparent", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              <kbd style={{ padding: "0 5px", borderRadius: 4, fontSize: 10.5, background: "#f3f4f6", border: "1px solid #e8eaed", color: "#9ca3af", fontFamily: "monospace" }}>⌘</kbd>
              {" + "}
              <kbd style={{ padding: "0 5px", borderRadius: 4, fontSize: 10.5, background: "#f3f4f6", border: "1px solid #e8eaed", color: "#9ca3af", fontFamily: "monospace" }}>↵</kbd>
              {" to send"}
            </span>
            <button
              onClick={send}
              disabled={!message.trim() || sending}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: message.trim() ? "#0052cc" : "#e8eaed",
                color: message.trim() ? "#fff" : "#9ca3af",
                fontWeight: 700, fontSize: 12.5, cursor: message.trim() ? "pointer" : "default",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { loading: authLoading } = useAuthContext();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load order");
      setOrder(data.order as ApiOrder);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAction(action: ClientOrderAction) {
    setActing(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update order");
      setOrder(data.order as ApiOrder);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setActing(false);
    }
  }

  if (authLoading || loading) return <LoadingSpinner />;

  if (loadError || !order) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        {loadError ?? "Order not found"}
        <div style={{ marginTop: 12 }}>
          <Link href={ROUTES.orders} style={{ color: "#0052cc" }}>← Back to orders</Link>
        </div>
      </div>
    );
  }

  const status = (ORDER_STATUSES as readonly string[]).includes(order.status)
    ? (order.status as OrderStatus)
    : "confirming_with_marketplace";

  return (
    <>
      <style>{`
        .order-detail-page { padding: 28px 36px; max-width: 1300px; margin: 0 auto; }
        @media (max-width: 1024px) { .order-detail-page { padding: 20px 20px; } }
        @media (max-width: 768px) { .order-detail-page { padding: 16px 12px; } .order-detail-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div className="order-detail-page">

        <Link href={ROUTES.orders} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280", textDecoration: "none", fontWeight: 500, marginBottom: 18 }}>
          ← Back to orders
        </Link>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 5, fontFamily: "monospace" }}>
              ORDER · {order.id}
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: "#111827", lineHeight: 1.1 }}>
              {order.articleTitle ?? "Custom Article"}
            </h1>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 6 }}>
              <span style={{ fontFamily: "monospace", color: "#374151", fontWeight: 700 }}>{order.snapshotDomain ?? "—"}</span>
              {" · via "}{order.snapshotMarketplaceName ?? "—"}{order.createdAt ? ` · placed ${new Date(order.createdAt).toLocaleDateString()}` : ""}
            </div>
          </div>
        </div>

        <div className="order-detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 460px", gap: 18, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Timeline status={status} />
            <ActionPanel status={status} acting={acting} onAction={handleAction} />
            <DetailsCard order={order} />
          </div>

          <Chat orderId={order.id} domain={order.snapshotDomain ?? "—"} title={order.articleTitle ?? "Custom Article"} />
        </div>

      </div>
    </>
  );
}
