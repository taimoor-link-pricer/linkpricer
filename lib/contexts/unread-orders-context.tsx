"use client";

// Client-side counterpart to the admin chat dock's unread tracking
// (components/admin/chat-dock.tsx) — same data (a *LastReadAt stamp on the
// Firestore orders/{id} doc, compared against the latest message), but
// deliberately not fetched the same way. The dock gets live updates from one
// collectionGroup Firestore listener across every order because
// firestore.rules grants that query to admins only (see its comment on why —
// a get()-based per-order check doesn't survive a multi-hundred-document
// query). A client has no such collection-group access, and shouldn't need
// one just to badge their own orders — so this polls a small server endpoint
// (/api/orders/unread-summary, Admin SDK) instead of holding a live
// Firestore listener open per order. That endpoint also does the actual
// ownership check in Postgres (same as the rest of the orders API) before
// ever touching Firestore, since firestore.rules itself has no notion of
// company-shared orders today. Net effect: slightly less real-time (up to
// POLL_MS stale) in exchange for not needing any new Firestore
// security-rule surface for this feature.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthContext } from "./auth-context";

interface UnreadOrdersContextValue {
  totalUnread: number;
  isOrderUnread: (orderId: string) => boolean;
  // Fire-and-forget: optimistically clears locally, POSTs the read receipt
  // server-side, and reverts the optimistic clear if that POST fails (so a
  // dropped request shows unread again on the next poll instead of silently
  // going stale forever). Safe to call repeatedly / on an already-read order.
  markRead: (orderId: string) => void;
  refresh: () => void;
}

const UnreadOrdersContext = createContext<UnreadOrdersContextValue | null>(null);

const POLL_MS = 60_000;
const EMPTY_SET: ReadonlySet<string> = new Set();

export function UnreadOrdersProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuthContext();
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  // Orders markRead has already cleared locally but the next poll hasn't
  // confirmed yet — kept out of the set even if a poll that was already in
  // flight when markRead fired still reports them unread (its response
  // reflects Postgres state from before the mark-read write landed). The
  // *following* poll will agree either way, so this only needs to bridge one
  // cycle, not track anything long-term.
  const pendingReadRef = useRef<Set<string>>(new Set());

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/orders/unread-summary");
      if (!res.ok) return;
      const data = await res.json();
      const ids: string[] = Array.isArray(data.unreadOrderIds) ? data.unreadOrderIds : [];
      const pending = pendingReadRef.current;
      // Anything the server now agrees is read can drop out of the pending
      // set — otherwise it grows for the lifetime of the session.
      pending.forEach((id) => { if (!ids.includes(id)) pending.delete(id); });
      setUnreadIds(new Set(ids.filter((id) => !pending.has(id))));
    } catch {
      // Best-effort — next poll retries. A stale badge for one cycle isn't
      // worth surfacing an error over.
    }
  }, []);

  // /dashboard/* redirects admins (role "vendor") to /admin before they'd
  // ever see this — see auth-context.tsx — but this masks `unreadIds` behind
  // the same guard regardless, rather than relying on that redirect: orders
  // belong to clients, and this way there's no state to reset (and no
  // setState-in-effect to avoid) when profile briefly clears on sign-out —
  // consumers just read zero until the tree unmounts.
  const canFetch = !!profile && profile.role !== "vendor";
  const effectiveUnreadIds = canFetch ? unreadIds : EMPTY_SET;

  useEffect(() => {
    if (!canFetch) return;
    fetchSummary();
    const interval = setInterval(fetchSummary, POLL_MS);
    return () => clearInterval(interval);
  }, [canFetch, fetchSummary]);

  const markRead = useCallback((orderId: string) => {
    pendingReadRef.current.add(orderId);
    setUnreadIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
    fetch(`/api/orders/${orderId}/mark-read`, { method: "POST" }).catch(() => {
      pendingReadRef.current.delete(orderId);
      // Doesn't restore the order to `unreadIds` immediately — the next poll
      // (server truth) will if it's genuinely still unread. Avoids a flash
      // of the badge reappearing for what's often a transient network blip.
    });
  }, []);

  const isOrderUnread = useCallback((orderId: string) => effectiveUnreadIds.has(orderId), [effectiveUnreadIds]);

  return (
    <UnreadOrdersContext.Provider value={{ totalUnread: effectiveUnreadIds.size, isOrderUnread, markRead, refresh: fetchSummary }}>
      {children}
    </UnreadOrdersContext.Provider>
  );
}

export function useUnreadOrders(): UnreadOrdersContextValue {
  const ctx = useContext(UnreadOrdersContext);
  if (!ctx) throw new Error("useUnreadOrders must be used within an UnreadOrdersProvider");
  return ctx;
}
