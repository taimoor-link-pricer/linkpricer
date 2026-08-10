"use client";

// Facebook-style chat dock: a collapsed launcher bubble (bottom-right) that
// expands into a conversation list, which drills into a single thread. Lives
// once in the admin layout (not per-page) so it persists and stays connected
// while navigating between admin pages, same as Messenger's dock does across
// a whole site.
//
// Data model: a "conversation" is any order that has at least one Firestore
// message under orders/{id}/messages. One collectionGroup listener across
// every order's messages subcollection drives the whole list (not one
// listener per conversation, which wouldn't scale) — reduced client-side to
// the single latest message per order. Unread is derived, not stored as a
// boolean: each order doc carries `adminLastReadAt` (stamped whenever an
// admin opens that thread), and a conversation is unread if its latest
// message is from the client and newer than that stamp.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  collection, collectionGroup, doc, documentId, addDoc, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, where, limit, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";

interface ConversationMeta {
  clientEmail: string | null;
  domain: string | null;
  articleTitle: string | null;
}

interface LatestMessage {
  body: string;
  senderType: "admin" | "client";
  senderName: string;
  createdAt: Date | null;
}

interface Conversation {
  id: string;
  latest: LatestMessage;
  meta: ConversationMeta | undefined;
  unread: boolean;
}

interface ChatDockContextValue {
  // meta is optional -- the orders list already has domain/clientEmail/
  // articleTitle in hand and can pass it straight through so the thread
  // header shows correctly immediately, including for an order that has no
  // messages yet at all (which, by definition, can't appear in the live
  // message feed this dock's list view is built from -- see the note on
  // ConversationThread below for why that split matters).
  openConversation: (orderId: string, meta?: ConversationMeta) => void;
}

const ChatDockContext = createContext<ChatDockContextValue | null>(null);

export function useChatDock(): ChatDockContextValue {
  const ctx = useContext(ChatDockContext);
  if (!ctx) throw new Error("useChatDock must be used within ChatDockProvider");
  return ctx;
}

const MESSAGE_FEED_LIMIT = 300;
const IN_QUERY_CHUNK = 30; // Firestore `in` operator max

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function relativeTime(d: Date | null): string {
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatDockProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [latestByOrder, setLatestByOrder] = useState<Map<string, LatestMessage>>(new Map());
  const [lastReadByOrder, setLastReadByOrder] = useState<Map<string, Date | null>>(new Map());
  const [metaByOrder, setMetaByOrder] = useState<Map<string, ConversationMeta>>(new Map());
  const fetchedMetaIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(collectionGroup(db, "messages"), orderBy("createdAt", "desc"), limit(MESSAGE_FEED_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Map<string, LatestMessage>();
        for (const d of snap.docs) {
          const orderId = d.ref.parent.parent?.id;
          if (!orderId || next.has(orderId)) continue; // docs are createdAt desc, so first hit per order is the latest
          const data = d.data() as { senderType: "admin" | "client"; senderName: string; body: string; createdAt: Timestamp | null };
          next.set(orderId, {
            body: data.body,
            senderType: data.senderType,
            senderName: data.senderName,
            createdAt: data.createdAt?.toDate() ?? null,
          });
        }
        setLatestByOrder(next);
      },
      (err) => console.error("[ChatDock] feed onSnapshot", err)
    );
    return unsub;
  }, []);

  const conversationIds = useMemo(() => [...latestByOrder.keys()], [latestByOrder]);
  const conversationIdsKey = conversationIds.join(",");

  useEffect(() => {
    if (conversationIds.length === 0) return;
    const unsubs = chunk(conversationIds, IN_QUERY_CHUNK).map((idsChunk) => {
      const q = query(collection(db, "orders"), where(documentId(), "in", idsChunk));
      return onSnapshot(
        q,
        (snap) => {
          setLastReadByOrder((prev) => {
            const next = new Map(prev);
            for (const d of snap.docs) {
              const ts = (d.data().adminLastReadAt as Timestamp | undefined)?.toDate() ?? null;
              next.set(d.id, ts);
            }
            return next;
          });
        },
        (err) => console.error("[ChatDock] lastRead onSnapshot", err)
      );
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdsKey]);

  useEffect(() => {
    const missing = conversationIds.filter((id) => !fetchedMetaIds.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedMetaIds.current.add(id));
    fetch(`/api/admin/orders/meta?ids=${missing.join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.orders) return;
        setMetaByOrder((prev) => {
          const next = new Map(prev);
          for (const o of data.orders as { id: string; clientEmail: string | null; domain: string | null; articleTitle: string | null }[]) {
            next.set(o.id, { clientEmail: o.clientEmail, domain: o.domain, articleTitle: o.articleTitle });
          }
          return next;
        });
      })
      .catch(() => {
        missing.forEach((id) => fetchedMetaIds.current.delete(id)); // allow retry next render
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdsKey]);

  const conversations: Conversation[] = useMemo(() => {
    return conversationIds
      .map((id) => {
        const latest = latestByOrder.get(id)!;
        const lastRead = lastReadByOrder.get(id) ?? null;
        const unread = latest.senderType === "client" && (!lastRead || (!!latest.createdAt && latest.createdAt > lastRead));
        return { id, latest, meta: metaByOrder.get(id), unread };
      })
      .sort((a, b) => (b.latest.createdAt?.getTime() ?? 0) - (a.latest.createdAt?.getTime() ?? 0));
  }, [conversationIds, latestByOrder, lastReadByOrder, metaByOrder]);

  const unreadCount = conversations.filter((c) => c.unread).length;

  function openConversation(orderId: string, meta?: ConversationMeta) {
    setActiveId(orderId);
    setOpen(true);
    if (meta) {
      fetchedMetaIds.current.add(orderId); // caller already gave us this — don't also fetch it
      setMetaByOrder((prev) => new Map(prev).set(orderId, meta));
    }
  }

  // Resolved here (not inside ChatDockUI) since it needs metaByOrder, which
  // the list view doesn't otherwise need passed down to it.
  const activeMeta = activeId ? metaByOrder.get(activeId) : undefined;

  return (
    <ChatDockContext.Provider value={{ openConversation }}>
      {children}
      {profile && (
        <ChatDockUI
          open={open}
          setOpen={setOpen}
          activeId={activeId}
          activeMeta={activeMeta}
          setActiveId={setActiveId}
          conversations={conversations}
          unreadCount={unreadCount}
        />
      )}
    </ChatDockContext.Provider>
  );
}

function ChatDockUI({
  open, setOpen, activeId, activeMeta, setActiveId, conversations, unreadCount,
}: {
  open: boolean; setOpen: (v: boolean) => void;
  activeId: string | null; activeMeta: ConversationMeta | undefined; setActiveId: (v: string | null) => void;
  conversations: Conversation[]; unreadCount: number;
}) {
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 200,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #2c64f0, #7c3aed)",
          boxShadow: "0 8px 24px rgba(44,100,240,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        aria-label="Open messages"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, padding: "0 5px",
            borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff",
          }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 200,
      width: 360, height: 520, maxHeight: "calc(100vh - 40px)",
      background: "#fff", borderRadius: 16, overflow: "hidden",
      boxShadow: "0 20px 60px rgba(15,23,42,0.28)", border: "1px solid #e8eaed",
      display: "flex", flexDirection: "column",
    }}>
      {activeId ? (
        <ConversationThread orderId={activeId} meta={activeMeta} onBack={() => setActiveId(null)} onClose={() => setOpen(false)} />
      ) : (
        <ConversationList conversations={conversations} onSelect={setActiveId} onClose={() => setOpen(false)} unreadCount={unreadCount} />
      )}
    </div>
  );
}

function DockHeader({ title, subtitle, onBack, onClose }: { title: string; subtitle?: string; onBack?: () => void; onClose: () => void }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8eaed", display: "flex", alignItems: "center", gap: 10, background: "#fff", flexShrink: 0 }}>
      {onBack && (
        <button onClick={onBack} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
      </div>
      <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: "pointer", flexShrink: 0 }}>–</button>
    </div>
  );
}

function ConversationList({ conversations, onSelect, onClose, unreadCount }: { conversations: Conversation[]; onSelect: (id: string) => void; onClose: () => void; unreadCount: number }) {
  return (
    <>
      <DockHeader title="Messages" subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined} onClose={onClose} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {conversations.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 12.5, color: "#9ca3af" }}>No conversations yet.</div>
        )}
        {conversations.map((c) => {
          const label = c.meta?.domain ?? "Loading…";
          const email = c.meta?.clientEmail ?? "";
          const initial = (email[0] ?? "?").toUpperCase();
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                background: c.unread ? "#eff6ff" : "#fff", border: "none", borderBottom: "1px solid #f3f4f6",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #2c64f0, #7c3aed)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14,
              }}>{initial}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: c.unread ? 800 : 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  <span style={{ fontSize: 10.5, color: c.unread ? "#2c64f0" : "#9ca3af", fontWeight: c.unread ? 700 : 500, flexShrink: 0 }}>{relativeTime(c.latest.createdAt)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
                <div style={{ fontSize: 12, color: c.unread ? "#111827" : "#9ca3af", fontWeight: c.unread ? 700 : 400, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.latest.senderType === "admin" ? "You: " : ""}{c.latest.body}
                </div>
              </div>
              {c.unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: "#2c64f0", flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

interface ThreadMessage { senderType: "admin" | "client"; senderName: string; body: string; time: string }

function ConversationThread({ orderId, meta, onBack, onClose }: { orderId: string; meta: ConversationMeta | undefined; onBack: () => void; onClose: () => void }) {
  const { profile } = useAuthContext();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    setReady(false);
    setMessages([]);
    (async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/chat-init`, { method: "POST" });
        if (!res.ok) throw new Error("chat-init failed");
        if (cancelled) return;

        const q = query(collection(db, "orders", orderId, "messages"), orderBy("createdAt", "asc"));
        unsubscribe = onSnapshot(
          q,
          (snap) => {
            const next: ThreadMessage[] = snap.docs.map((d) => {
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
            // Stamps "admin has seen this up to now" -- re-stamped on every
            // snapshot (not just the first) so a message arriving while this
            // thread is already open doesn't leave a stale unread badge.
            setDoc(doc(db, "orders", orderId), { adminLastReadAt: serverTimestamp() }, { merge: true }).catch(() => {});
          },
          (err) => {
            console.error("[ChatDock thread] onSnapshot", err);
            setError("Couldn't load messages.");
            setReady(true);
          }
        );
      } catch (err) {
        console.error("[ChatDock thread] chat-init", err);
        setError("Couldn't open this chat.");
        setReady(true);
      }
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const text = inputValue.trim();
    if (!text || !profile) return;
    setInputValue("");
    try {
      await addDoc(collection(db, "orders", orderId, "messages"), {
        senderId: profile.uid,
        senderType: "admin",
        senderName: profile.displayName || profile.email || "Linkpricer team",
        body: text,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[ChatDock thread] send failed", err);
      setError("Message didn't send.");
    }
  }

  const title = meta?.domain ?? "Chat";
  const subtitle = meta?.clientEmail ?? "";

  return (
    <>
      <DockHeader title={title} subtitle={subtitle} onBack={onBack} onClose={onClose} />
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {!ready && <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Loading…</div>}
        {error && <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center" }}>{error}</div>}
        {ready && !error && messages.length === 0 && (
          <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>No messages yet.</div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: msg.senderType === "admin" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: 12, background: msg.senderType === "admin" ? "#0052cc" : "#f3f4f6", color: msg.senderType === "admin" ? "#fff" : "#111827" }}>
              {msg.senderType === "client" && <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", marginBottom: 2 }}>{msg.senderName}</div>}
              <div style={{ fontSize: 12.5, wordBreak: "break-word" }}>{msg.body}</div>
              <div style={{ fontSize: 9.5, marginTop: 3, color: msg.senderType === "admin" ? "rgba(255,255,255,0.75)" : "#9ca3af" }}>{msg.time}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #e8eaed", padding: "10px 12px", display: "flex", gap: 8, background: "#f9fafb", flexShrink: 0 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Reply to this customer…"
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #e8eaed", fontSize: 12.5, color: "#111827" }}
        />
        <button onClick={handleSend} style={{ padding: "8px 14px", borderRadius: 8, background: "#0052cc", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12.5 }}>Send</button>
      </div>
    </>
  );
}
