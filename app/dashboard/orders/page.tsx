"use client";

// Ported verbatim from the confirmed design source: v1-interactive/orders.jsx
// (SAMPLE_ORDERS, STATUS_CONFIG, OrderCard, ChatModal, LinkMonitoringModal,
// Tour — all colors/copy/behaviour taken directly from that file, not just
// screenshots). Per explicit instruction this pass matches the design using
// representative order data; the `orders` DB table already has matching
// columns (snapshotDomain, snapshotMarketplaceName, articleTitle, targetUrl,
// anchorText, articleUrl, wordCount, totalAmount, status) for a real-data
// follow-up. Real backend also still needed per Karolis's walkthrough: live
// Google-index checks for Link Monitoring, persisted chat, and the exact
// Stripe/company-details gating in front of "Pay Now" (he was explicit that
// sequencing there is still undecided — "you figure out what's best").
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { useUnreadOrders } from "@/lib/contexts/unread-orders-context";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { getOrderMetaExt } from "@/lib/orders/metadata";
import type { ClientOrderAction } from "@/lib/orders/types";
import { currencySymbol } from "@/lib/orders/types";
import { prettyMarketplaceName } from "@/lib/marketplace-name";

const C = {
  ink: "#0f1620", ink2: "#374151", ink3: "#6b7280", mute: "#9ca3af", mute2: "#d1d5db",
  line: "#e5e7eb", line2: "#f3f4f6", bg3: "#f3f4f6", accent: "#0052cc",
};

type OrderStatus =
  | "confirming_with_marketplace" | "approval_required" | "price_increase_requested"
  | "article_review" | "payment_pending" | "waiting_for_publication" | "approved"
  | "published" | "complete" | "cancelled";

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; urgent: boolean }> = {
  confirming_with_marketplace: { label: "Confirming with Marketplace", color: "#003d99", bg: "#cce5ff", urgent: false },
  approval_required: { label: "Approval Required", color: "#8b5900", bg: "#fce8c6", urgent: true },
  price_increase_requested: { label: "Price Increase Requested", color: "#8b5900", bg: "#fce8c6", urgent: true },
  article_review: { label: "Article Review", color: "#8b5900", bg: "#fce8c6", urgent: true },
  payment_pending: { label: "Payment Pending", color: "#8b5900", bg: "#fce8c6", urgent: true },
  waiting_for_publication: { label: "Waiting for Publication", color: "#003d99", bg: "#cce5ff", urgent: false },
  approved: { label: "Approved", color: "#003d99", bg: "#cce5ff", urgent: false },
  published: { label: "Published", color: "#006621", bg: "#d4f4dd", urgent: false },
  complete: { label: "Complete", color: "#006621", bg: "#d4f4dd", urgent: false },
  cancelled: { label: "Cancelled", color: "#8b0000", bg: "#ffcccb", urgent: false },
};

interface Order {
  id: string; domain: string; marketplace: string; status: OrderStatus; title: string;
  targetUrl: string; anchorText: string; price: number; newPrice?: number; wordCount: number;
  draftUrl?: string; articleUrl?: string; daysLive?: number; notes?: string | null; placedAt?: string;
  currency: string;
}

// Raw shape returned by GET /api/orders (a row of the `orders` table).
type ApiOrder = {
  id: string;
  status: string;
  snapshotDomain: string | null;
  snapshotMarketplaceName: string | null;
  snapshotCurrency: string | null;
  articleTitle: string | null;
  targetUrl: string;
  anchorText: string | null;
  totalAmount: string;
  wordCount: number | null;
  liveUrl: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  snapshotOfferMetadata: unknown;
};

function mapApiOrder(row: ApiOrder): Order {
  const ext = getOrderMetaExt(row.snapshotOfferMetadata);
  return {
    id: row.id,
    domain: row.snapshotDomain ?? "—",
    marketplace: row.snapshotMarketplaceName ?? "—",
    status: (row.status as OrderStatus) in STATUS_CONFIG ? (row.status as OrderStatus) : "confirming_with_marketplace",
    title: row.articleTitle ?? "Custom Article",
    targetUrl: row.targetUrl,
    anchorText: row.anchorText ?? "",
    price: parseFloat(row.totalAmount),
    newPrice: ext.pendingPriceAmount ?? undefined,
    wordCount: row.wordCount ?? 0,
    draftUrl: ext.draftUrl ?? undefined,
    articleUrl: row.liveUrl ?? undefined,
    notes: row.reviewNotes ?? ext.pendingPriceReason ?? null,
    placedAt: row.createdAt ?? undefined,
    currency: row.snapshotCurrency ?? "USD",
  };
}

function fmtPrice(n: number | undefined, currency: string) {
  if (n == null) return "—";
  return currencySymbol(currency) + Math.round(n).toLocaleString("en-US");
}

// ── Icons (ported from the source's inline Icon component) ─────────────────
function Icon({ name, size = 16, color = "currentColor" }: { name: "x" | "check" | "chevron" | "paperclip" | "chat" | "clock" | "store" | "search" | "link"; size?: number; color?: string }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "chevron": return <svg {...props}><path d="M9 6l6 6-6 6" /></svg>;
    case "check": return <svg {...props}><path d="M5 12l4 4 10-10" /></svg>;
    case "x": return <svg {...props}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "paperclip": return <svg {...props}><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>;
    case "chat": return <svg {...props}><path d="M12 20a8 8 0 1 0-8-8c0 1 .5 2.5 1 3.5l-1.5 2.5a1 1 0 0 0 1.5 1l2-1.5c1 .5 2.5 1 3.5 1" /><path d="M9 12h6M9 16h6" /></svg>;
    case "clock": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "store": return <svg {...props}><path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" /><path d="M4 9l1 10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1l1-10" /><path d="M4 9h16M9 9v11M15 9v11" /></svg>;
    case "search": return <svg {...props}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>;
    case "link": return <svg {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
  }
}

// ── Chat modal (with attachments, ported from source) ───────────────────────
interface Attachment { id: string; name: string; size: number; kind: "image" | "file"; url: string | null }
interface ChatMessage { type: "admin" | "client"; text: string; time: string; files?: Attachment[] }

function fmtSize(b: number) {
  return b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
}

function ChatModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { profile } = useAuthContext();
  const { markRead } = useUnreadOrders();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [chatError, setChatError] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 2;
  const MAX_BYTES = 10 * 1024 * 1024;

  // Ensure the Firestore orders/{id} mirror doc exists (self-heals orders
  // placed before real-time chat existed), then attach a live listener on
  // its messages subcollection. Real-time, not polling — Firestore pushes
  // new messages to every open tab the moment either side sends one.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}/chat-init`, { method: "POST" });
        if (!res.ok) throw new Error("chat-init failed");
        if (cancelled) return;

        const q = query(collection(db, "orders", order.id, "messages"), orderBy("createdAt", "asc"));
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            const next: ChatMessage[] = snap.docs.map((d) => {
              const data = d.data() as { senderType: "admin" | "client"; body: string; createdAt: Timestamp | null };
              const ts = data.createdAt?.toDate();
              return {
                type: data.senderType,
                text: data.body,
                time: ts ? ts.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sending…",
              };
            });
            setMessages(next);
            setReady(true);
            // Re-marked read on every snapshot, not just once on open — a
            // reply arriving while this modal is already sitting open is
            // visible in the thread immediately, so it shouldn't leave the
            // nav/list badge showing unread the next time either fetches.
            // Same pattern as the admin dock's adminLastReadAt re-stamp.
            markRead(order.id);
          },
          (err) => {
            console.error("[ChatModal] onSnapshot", err);
            setChatError("Couldn't load messages. Try closing and reopening this chat.");
            setReady(true);
          }
        );
      } catch (err) {
        console.error("[ChatModal] chat-init", err);
        setChatError("Couldn't open this chat. Try again in a moment.");
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [order.id, markRead]);

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    if (!incoming.length) return;
    let err = "";
    const room = MAX_FILES - attachments.length;
    if (room <= 0) { setUploadErr(`You can attach up to ${MAX_FILES} files per message.`); return; }
    const accepted: Attachment[] = [];
    for (const f of incoming) {
      if (accepted.length >= room) { err = `You can attach up to ${MAX_FILES} files per message.`; break; }
      if (f.size > MAX_BYTES) { err = `"${f.name}" is over the 10 MB limit.`; continue; }
      const isImg = /^image\//.test(f.type);
      accepted.push({ id: Math.random().toString(36).slice(2), name: f.name, size: f.size, kind: isImg ? "image" : "file", url: isImg ? URL.createObjectURL(f) : null });
    }
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
    setUploadErr(err);
  }
  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const hit = prev.find((a) => a.id === id);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return prev.filter((a) => a.id !== id);
    });
  }
  async function handleSend() {
    const text = inputValue.trim();
    if (!text || !profile) return;
    // Attachments aren't wired to real storage yet — dropped from the
    // persisted message rather than saving a blob URL that 404s for anyone
    // else who opens this chat. Text-only for this pass.
    setInputValue("");
    setAttachments([]);
    setUploadErr("");
    try {
      await addDoc(collection(db, "orders", order.id, "messages"), {
        senderId: profile.uid,
        senderType: "client",
        senderName: profile.displayName || profile.email || "Client",
        body: text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[ChatModal] send failed", err);
      setChatError("Message didn't send. Check your connection and try again.");
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 10, width: "90%", maxWidth: 700, height: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(15,23,42,0.14)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Chat: {order.domain}</div>
            <div style={{ fontSize: 12, color: C.mute }}>{order.title}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.line}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.mute2 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {!ready && <div style={{ fontSize: 12, color: C.mute, textAlign: "center" }}>Loading messages…</div>}
          {chatError && <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center" }}>{chatError}</div>}
          {ready && !chatError && messages.length === 0 && (
            <div style={{ fontSize: 12, color: C.mute, textAlign: "center" }}>No messages yet — say hello.</div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: msg.type === "client" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "70%", padding: "12px 16px", borderRadius: 12, background: msg.type === "client" ? C.accent : C.bg3, color: msg.type === "client" ? "#fff" : C.ink2 }}>
                {msg.files && msg.files.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: msg.text ? 8 : 4 }}>
                    {msg.files.map((f) => f.kind === "image" ? (
                      <a key={f.id} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer"><img src={f.url ?? undefined} alt={f.name} style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8, display: "block", border: msg.type === "client" ? "1px solid rgba(255,255,255,0.4)" : `1px solid ${C.line}` }} /></a>
                    ) : (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: msg.type === "client" ? "rgba(255,255,255,0.18)" : "#fff", border: msg.type === "client" ? "1px solid rgba(255,255,255,0.35)" : `1px solid ${C.line}` }}>
                        <Icon name="paperclip" size={14} color={msg.type === "client" ? "#fff" : C.mute} />
                        <span style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <span style={{ fontSize: 10, opacity: 0.75 }}>{fmtSize(f.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.text && <div style={{ fontSize: 13, marginBottom: 4 }}>{msg.text}</div>}
                <div style={{ fontSize: 10, color: msg.type === "client" ? "rgba(255,255,255,0.7)" : C.mute }}>{msg.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, background: C.bg3 }}>
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "12px 20px 0" }}>
              {attachments.map((a) => (
                <div key={a.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: a.kind === "image" ? 0 : "8px 10px", paddingRight: a.kind === "image" ? 0 : 26, borderRadius: 8, background: "#fff", border: `1px solid ${C.line}`, overflow: "hidden" }}>
                  {a.kind === "image" ? (
                    <img src={a.url ?? undefined} alt={a.name} style={{ width: 56, height: 56, objectFit: "cover", display: "block" }} />
                  ) : (
                    <>
                      <Icon name="paperclip" size={14} color={C.mute} />
                      <span style={{ fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink2 }}>{a.name}</span>
                      <span style={{ fontSize: 10, color: C.mute }}>{fmtSize(a.size)}</span>
                    </>
                  )}
                  <button onClick={() => removeAttachment(a.id)} aria-label="Remove attachment" style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 999, border: "none", background: "rgba(15,23,42,0.62)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><Icon name="x" size={11} color="#fff" /></button>
                </div>
              ))}
            </div>
          )}
          {uploadErr && <div style={{ padding: "8px 20px 0", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{uploadErr}</div>}
          <div style={{ padding: "12px 20px", display: "flex", gap: 10, alignItems: "center" }}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_FILES} title="Attach images or screenshots (up to 2, max 10 MB each)" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: attachments.length >= MAX_FILES ? "not-allowed" : "pointer", opacity: attachments.length >= MAX_FILES ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.mute }}><Icon name="paperclip" size={18} /></button>
            <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type a message or attach a screenshot..." style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, color: C.ink2 }} />
            <button onClick={handleSend} style={{ padding: "10px 16px", borderRadius: 8, background: C.accent, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkMonitoringModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <style>{`
        .monitor-row { display: grid; grid-template-columns: 150px 1fr 1fr 100px; }
        @media (max-width: 600px) {
          .monitor-row { grid-template-columns: 1fr; }
          .monitor-row > div { border-bottom: 1px solid ${C.line2}; }
          .monitor-row > div:last-child { border-bottom: none; }
        }
      `}</style>
      <div style={{ background: "#fff", borderRadius: 10, width: "90%", maxWidth: 800, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(15,23,42,0.14)", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 20, borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg3 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Link Monitoring</div>
            <div style={{ fontSize: 12, color: C.mute }}>{order.domain}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.line}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.mute2 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, background: C.bg3, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 12, height: 12, borderRadius: 999, background: "#006621" }} /><div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Active</div></div>
            </div>
            <div style={{ padding: 16, background: C.bg3, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Google Index</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#006621" }}>Indexed</div>
            </div>
            <div style={{ padding: 16, background: C.bg3, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Days Live</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{order.daysLive ?? "—"}</div>
            </div>
            <div style={{ padding: 16, background: C.bg3, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Last Checked</div>
              <div style={{ fontSize: 13, color: C.ink2 }}>2 hours ago</div>
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Expected vs Found</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
            <div className="monitor-row" style={{ borderBottom: `1px solid ${C.line2}` }}>
              <div style={{ padding: 12, background: C.bg3, fontWeight: 600, fontSize: 12, color: C.ink2 }}>Target URL</div>
              <div style={{ padding: 12, fontSize: 12, color: C.ink2, fontFamily: "monospace", wordBreak: "break-all" }}>{order.targetUrl}</div>
              <div style={{ padding: 12, fontSize: 12, color: C.ink2, fontFamily: "monospace", wordBreak: "break-all" }}>{order.targetUrl}</div>
              <div style={{ padding: 12, textAlign: "center", fontWeight: 600, color: "#006621" }}>✓ Match</div>
            </div>
            <div className="monitor-row">
              <div style={{ padding: 12, background: C.bg3, fontWeight: 600, fontSize: 12, color: C.ink2 }}>Anchor Text</div>
              <div style={{ padding: 12, fontSize: 12, color: C.ink2, wordBreak: "break-word" }}>{order.anchorText}</div>
              <div style={{ padding: 12, fontSize: 12, color: C.ink2, wordBreak: "break-word" }}>{order.anchorText}</div>
              <div style={{ padding: 12, textAlign: "center", fontWeight: 600, color: "#006621" }}>✓ Match</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order, onAction, isTourCard, forceExpanded, showTourHint, onStartTour,
}: {
  order: Order; onAction: (id: string, action: ClientOrderAction) => Promise<void>;
  isTourCard: boolean; forceExpanded: boolean | null; showTourHint: boolean; onStartTour: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [linkMonitoringOpen, setLinkMonitoringOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const config = STATUS_CONFIG[order.status];
  const { isOrderUnread } = useUnreadOrders();
  const unread = isOrderUnread(order.id);

  useEffect(() => { if (forceExpanded != null) setExpanded(forceExpanded); }, [forceExpanded]);

  const tourAttr = (name: string) => (isTourCard ? { "data-tour": name } : {});

  async function runAction(action: ClientOrderAction) {
    setActing(true);
    setActionError(null);
    try {
      await onAction(order.id, action);
      setExpanded(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setActing(false);
    }
  }
  const handleApprove = () => runAction("approve_condition_change");
  const handleApprovePriceIncrease = () => runAction("accept_price_increase");
  const handleArticleApprove = () => runAction("approve_article");
  const handleDecline = () => runAction("decline");

  return (
    <div style={{ marginBottom: 16, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div onClick={() => setExpanded(!expanded)} {...tourAttr("row")} className="order-row-grid" style={{ padding: "16px 20px", alignItems: "center", cursor: "pointer", borderBottom: expanded ? `1px solid ${C.line2}` : "none" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Order Details</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><Icon name="chevron" size={16} color={C.mute2} /></span>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{order.title}</div>
          </div>
          {showTourHint && (
            <button onClick={(e) => { e.stopPropagation(); onStartTour(); }} style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>☝</span> New here? How to use
            </button>
          )}
        </div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Domain</div><div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{order.domain}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Marketplace</div><div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{prettyMarketplaceName(order.marketplace)}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Status</div><div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, background: config.bg, color: config.color, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{config.label}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Words</div><div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{order.wordCount.toLocaleString()}</div></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 4 }}>Amount</div><div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{fmtPrice(order.status === "price_increase_requested" ? (order.newPrice ?? order.price) : order.price, order.currency)}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }} {...tourAttr("tools")}>
          <button onClick={(e) => { e.stopPropagation(); setChatOpen(true); }} title={unread ? "New message" : "Chat"} style={{ position: "relative", width: 36, height: 36, borderRadius: 8, border: `1px solid ${unread ? C.accent : C.line}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: unread ? C.accent : C.ink3 }}>
            <Icon name="chat" size={18} />
            {unread && (
              <span aria-hidden style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: "#dc2626", border: "2px solid #fff" }} />
            )}
          </button>
          {(order.status === "published" || order.status === "complete") && (
            <button onClick={(e) => { e.stopPropagation(); setLinkMonitoringOpen(true); }} title="Link Monitoring" style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.ink3 }}><Icon name="link" size={18} /></button>
          )}
        </div>
      </div>

      {chatOpen && <ChatModal order={order} onClose={() => setChatOpen(false)} />}
      {linkMonitoringOpen && <LinkMonitoringModal order={order} onClose={() => setLinkMonitoringOpen(false)} />}

      {expanded && (
        <div {...tourAttr("actions")} style={{ padding: 20, borderTop: `1px solid ${C.line2}` }}>
          {actionError && (
            <div style={{ marginBottom: 16, padding: 12, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#8b0000", fontSize: 13, fontWeight: 600 }}>{actionError}</div>
          )}
          <div style={{ marginBottom: 20, textAlign: "right" as const }}>
            <Link href={`/dashboard/orders/${order.id}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 12, fontWeight: 600, color: C.accent, textDecoration: "none" }}>
              Full order timeline{order.status === "complete" ? " & rate this order" : ""} ↗
            </Link>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Target URL</div>
            <div style={{ fontSize: 12, color: C.accent, fontFamily: "monospace", wordBreak: "break-all" as const }}>{order.targetUrl}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Anchor Text</div>
            <div style={{ fontSize: 13, color: C.ink2 }}>{order.anchorText}</div>
          </div>

          {order.draftUrl && (order.status === "article_review" || order.status === "waiting_for_publication" || order.status === "approved") && (
            <div style={{ marginBottom: 20, padding: 16, background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 8, borderLeft: "4px solid #006621" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#006621", textTransform: "uppercase", marginBottom: 8 }}>📄 Article Ready</div>
              <a href={order.draftUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#006621", textDecoration: "none", wordBreak: "break-all" as const, fontWeight: 500 }}>{order.draftUrl}</a>
            </div>
          )}

          {order.articleUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, textTransform: "uppercase", marginBottom: 8 }}>Published Article</div>
              <a href={order.articleUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.accent, textDecoration: "none", wordBreak: "break-all" as const }}>{order.articleUrl}</a>
            </div>
          )}

          {order.status === "approval_required" && order.notes && (
            <div style={{ marginBottom: 20, padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, borderLeft: "4px solid #8b5900" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5900", textTransform: "uppercase", marginBottom: 8 }}>📝 Webmaster Note</div>
              <div style={{ fontSize: 13, color: "#6b4423", lineHeight: 1.5 }}>{order.notes}</div>
            </div>
          )}

          {order.status === "price_increase_requested" && order.notes && (
            <div style={{ marginBottom: 20, padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, borderLeft: "4px solid #8b5900" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b5900", textTransform: "uppercase", marginBottom: 8 }}>💰 Price Increase Request</div>
              <div style={{ fontSize: 13, color: "#6b4423", lineHeight: 1.5, marginBottom: 12 }}>{order.notes}</div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, fontWeight: 700, color: "#8b5900", textTransform: "uppercase", marginBottom: 4 }}>Original Price</div><div style={{ fontSize: 14, fontWeight: 700, textDecoration: "line-through", color: C.mute }}>{fmtPrice(order.price, order.currency)}</div></div>
                <div><div style={{ fontSize: 11, fontWeight: 700, color: "#8b5900", textTransform: "uppercase", marginBottom: 4 }}>New Price</div><div style={{ fontSize: 14, fontWeight: 700, color: "#8b5900" }}>{fmtPrice(order.newPrice, order.currency)}</div></div>
              </div>
            </div>
          )}

          {order.status === "price_increase_requested" && (
            <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleApprovePriceIncrease} disabled={acting} style={{ padding: "10px 16px", borderRadius: 8, background: "#006621", color: "#fff", border: "none", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} color="#fff" /> Accept Price Increase</button>
                <button onClick={handleDecline} disabled={acting} style={{ padding: "10px 16px", borderRadius: 8, background: "#fee2e2", color: "#8b0000", border: "1px solid #fecaca", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icon name="x" size={14} color="#8b0000" /> Decline</button>
              </div>
            </div>
          )}

          {order.status === "approval_required" && (
            <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8b5900", marginBottom: 12 }}>Publisher changed conditions</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleApprove} disabled={acting} style={{ padding: "10px 16px", borderRadius: 8, background: "#006621", color: "#fff", border: "none", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} color="#fff" /> Approve</button>
                <button onClick={handleDecline} disabled={acting} style={{ padding: "10px 16px", borderRadius: 8, background: "#fee2e2", color: "#8b0000", border: "1px solid #fecaca", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icon name="x" size={14} color="#8b0000" /> Decline</button>
              </div>
            </div>
          )}

          {order.status === "article_review" && (
            <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8b5900", marginBottom: 12 }}>Your article is ready for review</div>
              <button onClick={handleArticleApprove} disabled={acting} style={{ padding: "10px 16px", borderRadius: 8, background: "#006621", color: "#fff", border: "none", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Icon name="check" size={14} color="#fff" /> Approve Article</button>
            </div>
          )}

          {order.status === "payment_pending" && (
            <div style={{ padding: 16, background: "#fce8c6", border: "1px solid #fde68a", borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8b5900", marginBottom: 6 }}>Payment required to proceed</div>
              <div style={{ fontSize: 12.5, color: "#6b4423", lineHeight: 1.5 }}>
                We&apos;ll follow up on payment directly — use the chat above if you have questions or want to arrange it sooner.
              </div>
            </div>
          )}

          {order.status === "confirming_with_marketplace" && (
            <div style={{ padding: 16, background: "#eef4ff", border: "1px solid #cce0ff", borderRadius: 8, marginBottom: 16, borderLeft: "4px solid #003d99" }}>
              <style>{`@keyframes lp-order-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } } @keyframes lp-order-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{ marginTop: 2, width: 16, height: 16, border: "2px solid #003d99", borderTopColor: "transparent", borderRadius: "50%", animation: "lp-order-spin 0.8s linear infinite", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#003d99", marginBottom: 4 }}>Confirming your order with {prettyMarketplaceName(order.marketplace)}</div>
                  <div style={{ fontSize: 13, color: "#33518c", lineHeight: 1.5 }}>
                    We&apos;ve sent your placement to the marketplace and are confirming it&apos;s still available and locking in the agreed price and conditions. This typically takes up to 3 business days, though it can take up to 7 in some cases — no action needed. We&apos;ll notify you the moment it&apos;s confirmed, or if the publisher requests any changes.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 16 }}>
                {[{ label: "Order placed", state: "done" as const }, { label: "Confirming with marketplace", state: "active" as const }].map((step, i, arr) => (
                  <div key={step.label} style={{ display: "contents" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "#003d99", border: "2px solid #003d99", animation: step.state === "active" ? "lp-order-pulse 1.6s ease-in-out infinite" : "none" }}>
                        {step.state === "done" ? <Icon name="check" size={13} color="#fff" /> : <Icon name="store" size={12} color="#fff" />}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, textAlign: "center", color: "#003d99" }}>{step.label}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ flex: 1, height: 2, background: "#003d99", marginBottom: 22 }} />}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #cce0ff", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 12, color: "#33518c", display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="clock" size={13} color="#33518c" />
                  Sent {order.placedAt ?? "moments ago"} · typically up to 3 business days (up to 7 in some cases)
                </div>
                <button onClick={handleDecline} disabled={acting} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", color: "#8b0000", border: "1px solid #fecaca", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 12 }}>Cancel order</button>
              </div>
            </div>
          )}

          {/* CLIENT_ACTION_TRANSITIONS (lib/orders/types.ts) allows "decline"
          from waiting_for_publication/approved too, same as
          confirming_with_marketplace above — this block was missing, so a
          customer whose order reached either status had no way to cancel it
          from this page. */}
          {(order.status === "waiting_for_publication" || order.status === "approved") && (
            <div style={{ padding: 16, background: C.bg3, border: `1px solid ${C.line}`, borderRadius: 8, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 13, color: C.ink2 }}>
                {order.status === "waiting_for_publication" ? "Waiting for the marketplace to publish this placement." : "Approved — moving to publication."}
              </div>
              <button onClick={handleDecline} disabled={acting} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", color: "#8b0000", border: "1px solid #fecaca", cursor: acting ? "default" : "pointer", opacity: acting ? 0.6 : 1, fontWeight: 600, fontSize: 12 }}>Cancel order</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type TourStepDef = { selector: string; title: string; body: string; onEnter: () => void };

function Tour({ steps, stepIndex, setStepIndex, onClose }: { steps: TourStepDef[]; stepIndex: number; setStepIndex: (i: number) => void; onClose: () => void }) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => { step?.onEnter?.(); }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let raf: number;
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (el) { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector(step.selector);
      if (el) { const r = el.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - 248)); }
    }, 260);
    return () => clearTimeout(t);
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = stepIndex === steps.length - 1;
  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const btnPrimary: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, background: C.accent, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 };
  const btnGhost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, background: "transparent", color: C.ink2, border: `1px solid ${C.line}`, cursor: "pointer", fontWeight: 600, fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div style={{ position: "absolute", inset: 0 }} onClick={(e) => e.stopPropagation()} />
      {hole && <div style={{ position: "fixed", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 12, boxShadow: "0 0 0 9999px rgba(15,23,42,0.62)", border: `2px solid ${C.accent}`, pointerEvents: "none" }} />}
      {rect && (
        <div style={{ position: "fixed", top: 22, left: "50%", transform: "translateX(-50%)", zIndex: 2002, background: "#fff", borderRadius: 14, boxShadow: "0 12px 32px rgba(15,23,42,0.22)", border: `1px solid ${C.line}`, padding: "16px 18px", width: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: C.accent }}>Step {stepIndex + 1} of {steps.length}</div>
            <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.mute, padding: 0 }}><Icon name="x" size={16} /></button>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{step.title}</div>
          <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 6 }}>{steps.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i === stepIndex ? C.accent : C.mute2 }} />)}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {stepIndex > 0 && <button onClick={() => setStepIndex(stepIndex - 1)} style={btnGhost}>Back</button>}
              {!last ? <button onClick={() => setStepIndex(stepIndex + 1)} style={btnPrimary}>Next</button> : <button onClick={onClose} style={btnPrimary}>Got it</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourExpand, setTourExpand] = useState<boolean | null>(null);
  const [tourSeen, setTourSeen] = useState(false);

  useEffect(() => {
    try { setTourSeen(window.localStorage.getItem("lp_order_tour_seen") === "1"); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load orders");
        if (!cancelled) setOrders((data.orders as ApiOrder[]).map(mapApiOrder));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleOrderAction(id: string, action: ClientOrderAction) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to update order");
    setOrders((prev) => prev.map((o) => (o.id === id ? mapApiOrder(data.order as ApiOrder) : o)));
  }

  const q = searchQuery.toLowerCase();
  const filteredOrders = !q ? orders : orders.filter((order) =>
    order.domain.toLowerCase().includes(q) ||
    order.targetUrl.toLowerCase().includes(q) ||
    order.title.toLowerCase().includes(q) ||
    order.anchorText.toLowerCase().includes(q) ||
    order.id.toLowerCase().includes(q) ||
    order.marketplace.toLowerCase().includes(q) ||
    prettyMarketplaceName(order.marketplace).toLowerCase().includes(q) ||
    STATUS_CONFIG[order.status].label.toLowerCase().includes(q)
  );

  const tourOrder = filteredOrders.find((o) => STATUS_CONFIG[o.status].urgent) ?? filteredOrders[0];
  const tourCardId = tourOrder ? tourOrder.id : null;

  function startTour() { setTourStep(0); setTourExpand(false); setTourActive(true); }
  function endTour() {
    setTourActive(false);
    setTourExpand(null);
    try { window.localStorage.setItem("lp_order_tour_seen", "1"); } catch { /* noop */ }
    setTourSeen(true);
  }

  const tourSteps: TourStepDef[] = [
    { selector: '[data-tour="row"]', title: "Open an order", body: "Every order is one row in this list. Click anywhere on a row to open it — that's where all the details and actions live. Try it on this one.", onEnter: () => setTourExpand(false) },
    { selector: '[data-tour="actions"]', title: "Review & respond", body: "Once open, you'll see the target URL, anchor text, and anything that needs you — approve a publisher change, accept a new price, or decline. This is where you manage and edit an order.", onEnter: () => setTourExpand(true) },
    { selector: '[data-tour="tools"]', title: "Chat & monitor", body: "Use these icons any time to message our team about a specific order or check that your published link is still live and healthy.", onEnter: () => setTourExpand(true) },
  ];

  return (
    <div style={{ padding: "20px 32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        * { box-sizing: border-box; }
        .order-row-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 88px; gap: 16px; }
        @media (max-width: 700px) {
          .order-row-grid { grid-template-columns: 1fr; gap: 10px; }
          .order-row-grid > div:last-child { justify-content: flex-start; }
        }
      `}</style>

      {tourActive && <Tour steps={tourSteps} stepIndex={tourStep} setStepIndex={setTourStep} onClose={endTour} />}

      <DashboardNav active="orders" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.ink, margin: "0 0 8px" }}>My Orders</h1>
          <p style={{ fontSize: 14, color: C.mute, margin: 0 }}>Track and manage your guest post orders</p>
        </div>
        {tourCardId && (
          <button onClick={startTour} style={{ padding: "9px 16px", border: `1px solid ${C.line}`, borderRadius: 9, background: "#fff", color: C.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.accent, display: "inline-block" }} /> How to use this page
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24, position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: 13, display: "inline-flex", pointerEvents: "none" }}><Icon name="search" size={17} color={C.mute} /></span>
        <input
          type="text"
          placeholder="Search by domain, target URL, title, anchor text…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "12px 16px 12px 42px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 14, color: C.ink2, background: "#fff", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", outline: "none" }}
        />
        {searchQuery && <div style={{ fontSize: 12, color: C.mute, marginTop: 10 }}>Found {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}</div>}
      </div>

      {loading ? (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 56, textAlign: "center", color: C.mute, fontSize: 14 }}>
          Loading orders…
        </div>
      ) : loadError ? (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, textAlign: "center", color: "#8b0000", fontSize: 14 }}>
          {loadError}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 56, textAlign: "center", color: C.mute, fontSize: 14 }}>
          {orders.length === 0 ? "No orders yet — placements you buy will show up here." : `No orders match "${searchQuery}".`}
        </div>
      ) : (
        filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isTourCard={order.id === tourCardId}
            forceExpanded={order.id === tourCardId ? tourExpand : null}
            showTourHint={!tourSeen && !tourActive && order.id === tourCardId}
            onStartTour={startTour}
            onAction={handleOrderAction}
          />
        ))
      )}
    </div>
  );
}
