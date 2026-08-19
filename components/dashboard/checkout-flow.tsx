"use client";

// Cart → checkout → order-placed flow, extracted from app/dashboard/search/page.tsx
// so every page with an "add to cart" button (Domain Analysis, Related Sites)
// gets the same real path to placing an order instead of each one growing its
// own copy. See app/dashboard/related-sites/page.tsx for the bug this fixed:
// its cart pill collected items but had no checkout wired up at all.
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { prettyMarketplaceName } from "@/lib/marketplace-name";
import { C, priceFmt, type Currency, type CartItem } from "@/components/dashboard/results-shared";
import {
  contentPriceCents,
  DEFAULT_CONTENT_WORD_COUNT,
  MAX_ADDITIONAL_LINKS,
  currencySymbol,
  type OrderLinkPair,
} from "@/lib/orders/types";

// Mirrors computeOrderPricing's integer-cent math (lib/orders/pricing.ts) so the
// quote shown here matches what /api/orders actually charges to the cent — the
// managed fee is rounded PER ITEM server-side, not on the aggregate sum, so
// summing already-rounded per-item totals (rather than rounding the sum once)
// is required to avoid a client/server mismatch on multi-item managed carts.
function cartCentsTotals(items: { price: number; contentPrice?: number; orderType: "managed" | "direct" }[]) {
  let subtotalCents = 0;
  let feeCents = 0;
  for (const i of items) {
    const itemSubtotalCents = Math.round(i.price * 100) + Math.round((i.contentPrice ?? 0) * 100);
    subtotalCents += itemSubtotalCents;
    if (i.orderType === "managed") feeCents += Math.round(itemSubtotalCents * 0.15);
  }
  return { subtotalCents, feeCents, totalCents: subtotalCents + feeCents };
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── CartPopup ────────────────────────────────────────────────────────────────
export function CartPopup({
  items,
  currency,
  onClose,
  onRemove,
  onCheckout,
}: {
  items: CartItem[];
  currency: Currency;
  onClose: () => void;
  onCheckout: () => void;
  onRemove: (idx: number) => void;
}) {
  const { subtotalCents, feeCents, totalCents } = cartCentsTotals(items);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,22,32,0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: 460,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,22,32,0.28)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.line}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Your cart</div>
            <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>{items.length} {items.length === 1 ? "placement" : "placements"}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: `1px solid ${C.line}`, background: "#fff",
              cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: C.mute, fontSize: 16, fontWeight: 600,
            }}
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.mute, fontSize: 13 }}>Cart is empty.</div>
          ) : items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 20px",
                borderBottom: idx < items.length - 1 ? `1px solid ${C.line}` : "none",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.ink3 }}>
                {item.domain.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: C.mono }}>{item.domain}</div>
                <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>via <strong style={{ color: C.ink2 }}>{item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</strong></div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{priceFmt(item.price, currency)}</div>
                <button
                  onClick={() => onRemove(idx)}
                  style={{ marginTop: 4, fontSize: 11, color: C.mute, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Add another domain */}
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "11px 20px",
              display: "flex", alignItems: "center", gap: 8,
              background: "#fbfcfe", border: "none",
              borderTop: `1px dashed ${C.line}`,
              fontSize: 12.5, color: C.mute, fontWeight: 500,
              cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14, color: C.mute2 }}>+</span>
            Add another domain to this order
          </button>
        </div>

        {/* Summary */}
        <div style={{ borderTop: `1px solid ${C.line}`, padding: "14px 20px", background: "#fbfcfe", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Subtotal</span>
            <span>{priceFmt(subtotalCents / 100, currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3 }}>
            <span>Linkpricer fee <span style={{ fontSize: 11 }}>(15%)</span></span>
            <span>{priceFmt(feeCents / 100, currency)}</span>
          </div>
          <div style={{ height: 1, background: C.line, margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: C.ink }}>
            <span>Total</span>
            <span>{priceFmt(totalCents / 100, currency)}</span>
          </div>
        </div>

        {/* Pay note */}
        <div
          style={{
            margin: "0 20px",
            background: "#e8f6ee",
            border: `1px solid #c9e9d4`,
            borderRadius: 8,
            padding: "9px 12px",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}
        >
          <span style={{ color: "#0a7a3b", fontSize: 13, lineHeight: 1, marginTop: 1 }}>✓</span>
          <div style={{ fontSize: 11.5, color: "#0e5f30", lineHeight: 1.45 }}>
            <strong>Pay only after publication.</strong> No charge today — each article goes live before billing.
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onCheckout}
            style={{
              width: "100%",
              padding: "13px 0",
              background: C.accent,
              color: "#fff",
              border: "none",
              borderRadius: 9,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Continue to brief ›
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────
type BriefItem = CartItem & {
  title: string; targetUrl: string; anchorText: string; niche: string;
  // Optional extra target-url/anchor-text pairs beyond the primary one above —
  // same shape as orders.additionalLinks server-side (lib/orders/types.ts).
  // The primary pair stays its own targetUrl/anchorText fields, unchanged,
  // so nothing about the single-link path (still the overwhelming common
  // case) changes shape or behavior.
  additionalLinks: OrderLinkPair[];
  contentMode: "linkpricer" | "upload" | "url";
  brief: string; articleUrl: string; tone: string; contentPrice: number;
  selectedFile: File | null; uploadError: string | null;
};

// The server rejects anything that isn't a well-formed http(s) URL (zod's
// .url() in app/api/orders/route.ts) but nothing here ever checked that
// client-side — the target/article URL inputs use type="url", but that's an
// inert attribute with no <form onSubmit>/submit button wiring it up, so a
// value like "test" sailed straight through to the API and came back as a
// generic "Validation failed" with no indication of which field was wrong.
const URL_ERROR_MSG = "isn't a valid URL — include https:// (e.g. https://example.com/page)";
function isLikelyUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Single source of truth for "is this placement ready to submit," "why
// not," and which specific field is at fault — used by the header's
// readyCount, each card's status badge, the inline per-field errors below,
// and handlePlace's not-ready message, so they can't disagree the way
// ready/not-ready used to (the badge had its own separate check that
// ignored contentMode entirely, always requiring title+brief even for modes
// that don't use them, and never checking selectedFile for "upload" mode —
// so a freshly-switched-to-upload item with no file could show a false
// "✓ Ready" while a fully-valid "url"-mode item showed "Brief needed"
// forever).
function validateBriefItem(item: BriefItem): {
  ready: boolean;
  targetUrlError: string | null;
  additionalLinkErrors: (string | null)[];
  articleUrlError: string | null;
} {
  const targetUrlError = item.targetUrl && !isLikelyUrl(item.targetUrl) ? URL_ERROR_MSG : null;
  const additionalLinkErrors = item.additionalLinks.map((pair) =>
    pair.targetUrl && !isLikelyUrl(pair.targetUrl) ? URL_ERROR_MSG : null
  );
  const articleUrlError = item.contentMode === "url" && item.articleUrl && !isLikelyUrl(item.articleUrl) ? URL_ERROR_MSG : null;

  let ready = !!item.targetUrl && !!item.anchorText && !targetUrlError;
  // A half-filled extra pair (one field typed, the other blank) blocks
  // "ready" the same way the primary pair would — a customer who started
  // typing a second link almost certainly meant to finish it, not have it
  // silently dropped at submit time (see the submit-time filter below).
  for (const pair of item.additionalLinks) {
    const hasAny = !!pair.targetUrl || !!pair.anchorText;
    const hasBoth = !!pair.targetUrl && !!pair.anchorText;
    if (hasAny && !hasBoth) ready = false;
  }
  if (additionalLinkErrors.some(Boolean)) ready = false;
  if (item.contentMode === "linkpricer") ready = ready && !!item.title && !!item.brief;
  else if (item.contentMode === "url") ready = ready && !!item.articleUrl && !articleUrlError;
  else ready = ready && !!item.selectedFile;

  return { ready, targetUrlError, additionalLinkErrors, articleUrlError };
}

function isBriefItemReady(item: BriefItem): boolean {
  return validateBriefItem(item).ready;
}

// Defense in depth: if a validation issue somehow still reaches the server
// (a field this page doesn't validate yet, a future schema change, etc.),
// surface zod's actual per-field issue instead of the generic "Validation
// failed" banner that used to show regardless of what was actually wrong.
function describeOrderApiError(data: { error?: string; details?: unknown }, items: BriefItem[]): string {
  if (Array.isArray(data.details) && data.details.length > 0) {
    const issue = data.details[0] as { path?: (string | number)[]; message?: string };
    const path = issue.path;
    if (Array.isArray(path) && path[0] === "items" && typeof path[1] === "number") {
      const idx = path[1];
      const domain = items[idx]?.domain ?? `#${idx + 1}`;
      const field = path[path.length - 1];
      const fieldLabel =
        field === "targetUrl" ? "target URL" :
        field === "anchorText" ? "anchor text" :
        field === "articleUrl" ? "article URL" :
        String(field);
      return `Placement ${idx + 1} (${domain}): ${fieldLabel} — ${issue.message ?? "invalid value"}.`;
    }
  }
  return data.error ?? "Failed to place order";
}

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD_ACCEPT_EXT = [".docx", ".md", ".pdf"];

// Same formula the server actually charges (lib/orders/pricing.ts) — was
// hardcoded to 120 here before, independent of the real $37.50 charge for
// the same 750-word default, so the checkout estimate never matched the
// eventual invoice.
const CONTENT_FEE_USD = contentPriceCents(DEFAULT_CONTENT_WORD_COUNT) / 100;

// Shape of a row returned by POST /api/orders — enough fields to build a
// real receipt client-side, no separate receipt endpoint needed.
export type PlacedOrder = {
  id: string;
  snapshotDomain: string | null;
  snapshotMarketplaceName: string | null;
  articleTitle: string | null;
  totalAmount: string | null;
  snapshotCurrency: string | null;
  createdAt: string | null;
};

export function CheckoutModal({ cartItems, onClose, onPlaced }: {
  cartItems: CartItem[];
  onClose: () => void; onPlaced: (orders: PlacedOrder[]) => void;
}) {
  const { profile } = useAuthContext();
  const [items, setItems] = useState<BriefItem[]>(() =>
    cartItems.map(c => ({ ...c, title: "", targetUrl: "", anchorText: "", additionalLinks: [], niche: "", contentMode: "linkpricer", brief: "", articleUrl: "", tone: "Editorial", contentPrice: CONTENT_FEE_USD, selectedFile: null, uploadError: null }))
  );
  const [expandedIdx, setExpandedIdx] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [placingStage, setPlacingStage] = useState<"uploading" | "submitting" | null>(null);
  // React state updates are async — `disabled={placing}` alone leaves a real
  // window where a fast double-click invokes handlePlace twice before the
  // re-render lands. This ref is checked synchronously at the very top of
  // handlePlace to close that race independent of the state-driven disable.
  const placingRef = useRef(false);
  // Minted once per checkout session (not once per handlePlace call) so a
  // retry after a failed submit reuses the SAME ids. The server's insert
  // loop (POST /api/orders) writes each item's order row one at a time, not
  // inside a transaction, and relies on onConflictDoNothing(id) to make a
  // retry idempotent instead of creating duplicates for whichever items
  // already succeeded before the failure. That guarantee only holds if the
  // client actually resubmits the same ids -- freshly randomizing them on
  // every call (the previous behavior) would silently defeat it and create
  // real duplicate orders on a partial-batch failure + retry.
  const orderIdsRef = useRef<Map<number, string>>(new Map(cartItems.map((_, idx) => [idx, crypto.randomUUID()])));

  const { subtotalCents, feeCents, totalCents } = cartCentsTotals(items);
  const readyCount = items.filter(isBriefItemReady).length;
  const [placeError, setPlaceError] = useState<string | null>(null);
  // Set once the user has actually tried to submit with something missing —
  // gates the not-ready cards' red-flagged styling below so a freshly opened
  // checkout (nothing filled in yet, nothing "wrong") doesn't look like it's
  // already full of errors.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  function change(idx: number, patch: Partial<BriefItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  // Extra target-url/anchor-text pairs beyond the primary one — one flat
  // array per item, addressed by index rather than a separate id per pair
  // (they're reordered/removed by position, not referenced from elsewhere,
  // so an id would just be bookkeeping with no consumer).
  function addLinkPair(idx: number) {
    setItems(prev => prev.map((it, i) => i === idx
      ? (it.additionalLinks.length >= MAX_ADDITIONAL_LINKS ? it : { ...it, additionalLinks: [...it.additionalLinks, { targetUrl: "", anchorText: "" }] })
      : it));
  }
  function updateLinkPair(idx: number, pairIdx: number, patch: Partial<OrderLinkPair>) {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, additionalLinks: it.additionalLinks.map((p, pi) => pi === pairIdx ? { ...p, ...patch } : p) }
      : it));
  }
  function removeLinkPair(idx: number, pairIdx: number) {
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, additionalLinks: it.additionalLinks.filter((_, pi) => pi !== pairIdx) }
      : it));
  }

  function handleFileSelect(idx: number, file: File | undefined) {
    if (!file) return;
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    if (!UPLOAD_ACCEPT_EXT.includes(ext)) {
      change(idx, { uploadError: "Only .docx, .md or .pdf files are accepted." });
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      change(idx, { uploadError: "File is over the 5 MB limit." });
      return;
    }
    // Just held locally — nothing touches Storage until "Place order" is
    // clicked and every field on every placement has actually validated.
    // That way a browsed-away tab or an abandoned checkout never leaves
    // anything in Storage to clean up.
    change(idx, { selectedFile: file, uploadError: null });
  }

  function handleRemoveUpload(idx: number) {
    change(idx, { selectedFile: null, uploadError: null });
  }

  async function handlePlace() {
    if (placingRef.current) return;
    setPlaceError(null);
    const notReadyIdx = items.map((it, i) => (isBriefItemReady(it) ? -1 : i)).filter((i) => i !== -1);
    if (notReadyIdx.length > 0) {
      setAttemptedSubmit(true);
      const first = notReadyIdx[0];
      setExpandedIdx(first);
      itemRefs.current[first]?.scrollIntoView({ behavior: "smooth", block: "center" });
      const domain = items[first].domain;
      const v = validateBriefItem(items[first]);
      const reason = v.targetUrlError ?? v.articleUrlError ?? v.additionalLinkErrors.find((e): e is string => !!e) ?? "is missing a required field";
      setPlaceError(
        notReadyIdx.length === 1
          ? `Placement ${first + 1} (${domain}): ${reason}`
          : `${notReadyIdx.length} placements need attention, starting with #${first + 1} (${domain}): ${reason}`
      );
      return;
    }
    if (!profile) {
      setPlaceError("You must be signed in to place an order.");
      return;
    }
    placingRef.current = true;
    setPlacing(true);
    try {
      // orderIdsRef (not minted here) so a retry after a failed submit -- not
      // just a within-call double-submit -- replays identical order ids; see
      // its declaration above for why that matters.
      const orderIds = orderIdsRef.current;

      // Upload phase: every selected file goes straight to its final,
      // order-scoped path (order-uploads/orders/{clientOrderId}/{uid}/...)
      // — the order row doesn't exist yet, so the client mints the id and
      // the order-creation call below re-uses it. If any upload fails, we
      // never call the order API at all: no half-placed order, and nothing
      // in Storage claims to belong to an order that doesn't exist.
      setPlacingStage("uploading");
      const uploadResults = new Map<number, { uploadedFileName: string; originalFileName: string }>();
      try {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          if (item.contentMode !== "upload" || !item.selectedFile) continue;
          const ext = item.selectedFile.name.includes(".") ? item.selectedFile.name.slice(item.selectedFile.name.lastIndexOf(".")).toLowerCase() : "";
          const clientOrderId = orderIds.get(idx)!;
          const path = `order-uploads/orders/${clientOrderId}/${profile.uid}/article${ext}`;
          await uploadBytes(storageRef(storage, path), item.selectedFile);
          uploadResults.set(idx, { uploadedFileName: path, originalFileName: item.selectedFile.name });
        }
      } catch (err) {
        console.error("[handlePlace] upload failed", err);
        throw new Error("Couldn't upload your article file. Check your connection and try again.");
      }

      setPlacingStage("submitting");
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i, idx) => ({
            id: orderIds.get(idx),
            domain: i.domain,
            offerName: i.offerName,
            offerType: i.offerType,
            orderType: i.orderType,
            priceType: i.priceType,
            articleTitle: i.title || undefined,
            targetUrl: i.targetUrl,
            anchorText: i.anchorText,
            // Fully-empty pairs (never touched — the common case for anyone
            // who never clicked "+ Add another link") are dropped rather
            // than sent as ["",""] and rejected by the server's url()/min(1)
            // validation. A half-filled pair can't reach this point at all —
            // isBriefItemReady already blocks submit until every started
            // pair is completed.
            additionalLinks: i.additionalLinks.filter(p => p.targetUrl.trim() && p.anchorText.trim()),
            contentNiche: i.niche || undefined,
            contentTone: i.tone || undefined,
            contentOption: i.contentMode === "linkpricer" ? "provided" : i.contentMode === "upload" ? "uploaded" : "url",
            wordCount: i.contentMode === "linkpricer" ? DEFAULT_CONTENT_WORD_COUNT : undefined,
            requirements: i.contentMode === "linkpricer" ? i.brief : undefined,
            articleUrl: i.contentMode === "url" ? i.articleUrl : undefined,
            uploadedFileName: uploadResults.get(idx)?.uploadedFileName,
            originalFileName: uploadResults.get(idx)?.originalFileName,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(describeOrderApiError(data, items));
      }
      onPlaced(data.orders as PlacedOrder[]);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      placingRef.current = false;
      setPlacing(false);
      setPlacingStage(null);
    }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", fontSize: 13, color: C.ink, outline: "none", boxSizing: "border-box" };
  const inpErr: React.CSSProperties = { ...inp, border: "1px solid #fecaca", background: "#fff7f7" };
  const fieldErr = (msg: string) => (
    <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>{msg}</div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,22,32,0.55)", backdropFilter: "blur(4px)", overflowY: "auto" }}>
      <style>{`
        @media (max-width: 768px) {
          .checkout-root { padding: 14px 12px 40px !important; }
          .checkout-root, .checkout-root * { min-width: 0 !important; max-width: 100%; }
          .checkout-2col { grid-template-columns: 1fr !important; }
          .checkout-2col > * { width: 100% !important; position: static !important; }
          .checkout-brief-grid { grid-template-columns: 1fr !important; }
          .checkout-trust-badge { display: none; }
        }
      `}</style>
      <div className="checkout-root" style={{ minHeight: "100vh", background: C.bg, padding: "20px 32px 60px" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
            <span style={{ marginLeft: 14, fontSize: 12, color: C.mute }}>
              <button onClick={onClose} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 12, padding: 0 }}>Cart</button>
              <span style={{ margin: "0 8px" }}>›</span>
              <span style={{ color: C.ink2 }}>Checkout</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="checkout-trust-badge" style={{ fontSize: 12, color: C.mute, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.good }}>✓</span> Secure checkout · escrow protected
            </span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 18, color: C.mute, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </header>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 24, flexWrap: "wrap" }}>
          {["Cart", "Article briefs", "Confirm order"].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: i === 1 ? C.accent : i < 1 ? "#fff" : C.bg3, color: i === 1 ? "#fff" : i < 1 ? C.ink2 : C.mute, border: i < 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, fontSize: 10, fontWeight: 800, background: i === 1 ? "#fff" : i < 1 ? C.good : C.line, color: i === 1 ? C.accent : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i < 1 ? "✓" : i + 1}</span>
                {s}
              </div>
              {i < 2 && <div style={{ width: 24, height: 1, background: C.line }} />}
            </React.Fragment>
          ))}
        </div>

        <div className="checkout-2col" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 400px", gap: 18, alignItems: "flex-start" }}>
          {/* LEFT — briefs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Article briefs</h2>
                <span style={{ fontSize: 11.5, color: C.mute }}>{readyCount} of {items.length} ready · briefs auto-saved</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.mute }}>Tell us what to write. We assign editors fluent in your niche.</p>
            </div>

            {items.map((item, i) => {
              const v = validateBriefItem(item);
              const ready = v.ready;
              const flagged = attemptedSubmit && !ready;
              // Only shown once the user has tried to submit — same gate as
              // the card's own red-flagged styling, so a freshly opened
              // checkout doesn't look pre-broken before anyone's typed a URL.
              const showFieldErrors = attemptedSubmit;
              return (
              <div
                key={item.domain + i}
                ref={(el) => { itemRefs.current[i] = el; }}
                style={{
                  background: "#fff",
                  border: `1px solid ${expandedIdx === i ? C.accent : flagged ? "#f3a5a5" : C.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: expandedIdx === i ? `0 0 0 3px ${C.accent50}` : flagged ? "0 0 0 3px #fee2e2" : "none",
                }}
              >
                {/* Card header row */}
                <div onClick={() => setExpandedIdx(prev => prev === i ? -1 : i)} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderBottom: expandedIdx === i ? `1px solid ${C.line2}` : "none", background: expandedIdx === i ? C.accent50 : "transparent", cursor: "pointer" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: ready ? "#e8f6ee" : "#fdf2dd", color: ready ? C.good : "#a35d00", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, border: `1px solid ${ready ? "#bbf0c8" : "#f3d99c"}` }}>
                    {ready ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* flexWrap so a longer marketplace name (e.g. "Backlinksglobal"
                    vs "MeUp") drops to its own line on narrow viewports instead of
                    overflowing into the fixed-width Ready/Brief-needed pill next
                    to it -- same "second line" treatment the title below already
                    gets when it doesn't fit. */}
                    <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" as const, gap: "2px 10px" }}>
                      <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 14 }}>{item.domain}</span>
                      <span style={{ fontSize: 11, color: C.mute }}>via {item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: item.title ? C.ink2 : C.mute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "No title yet"}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: ready ? "#e8f6ee" : "#fdf2dd", color: ready ? C.good : "#a35d00", flexShrink: 0 }}>
                    {ready ? "Ready" : "Brief needed"}
                  </span>
                  <span style={{ color: C.mute }}>{expandedIdx === i ? "▲" : "▼"}</span>
                </div>

                {/* Expanded form */}
                {expandedIdx === i && (
                  <div className="checkout-brief-grid" style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {/* Left column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Article title</label>
                        <input type="text" value={item.title} onChange={e => change(i, { title: e.target.value })} style={inp} placeholder="e.g. Why fintech founders should rethink onboarding in 2026" />
                      </div>

                      {/* Target URL / anchor text — repeatable pair. The primary
                      pair (item.targetUrl/anchorText) is always present and
                      required, same as before this existed; "+ Add another
                      link" appends optional extra pairs for a customer who
                      wants more than one link placed in the same article. */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Target URL (where the link points)</label>
                            <input type="url" value={item.targetUrl} onChange={e => change(i, { targetUrl: e.target.value })} style={{ ...(showFieldErrors && v.targetUrlError ? inpErr : inp), fontFamily: C.mono }} placeholder="https://yourbrand.com/blog/article-slug" />
                            {showFieldErrors && v.targetUrlError && fieldErr(v.targetUrlError)}
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Anchor text</label>
                            <input type="text" value={item.anchorText} onChange={e => change(i, { anchorText: e.target.value })} style={{ ...inp, fontFamily: C.mono }} placeholder="e.g. fintech onboarding flow" />
                          </div>
                        </div>

                        {item.additionalLinks.map((pair, pairIdx) => (
                          <div key={pairIdx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Target URL #{pairIdx + 2}</label>
                              <input type="url" value={pair.targetUrl} onChange={e => updateLinkPair(i, pairIdx, { targetUrl: e.target.value })} style={{ ...(showFieldErrors && v.additionalLinkErrors[pairIdx] ? inpErr : inp), fontFamily: C.mono }} placeholder="https://yourbrand.com/blog/another-slug" />
                              {showFieldErrors && v.additionalLinkErrors[pairIdx] && fieldErr(v.additionalLinkErrors[pairIdx]!)}
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Anchor text #{pairIdx + 2}</label>
                              <input type="text" value={pair.anchorText} onChange={e => updateLinkPair(i, pairIdx, { anchorText: e.target.value })} style={{ ...inp, fontFamily: C.mono }} placeholder="e.g. another anchor" />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLinkPair(i, pairIdx)}
                              title="Remove this link"
                              style={{ height: 38, width: 38, flexShrink: 0, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.mute, fontSize: 15, cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        {item.additionalLinks.length < MAX_ADDITIONAL_LINKS && (
                          <button
                            type="button"
                            onClick={() => addLinkPair(i)}
                            style={{ alignSelf: "flex-start", padding: "7px 12px", borderRadius: 8, border: `1px dashed ${C.line}`, background: "#fff", color: C.accent700, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            + Add another link
                          </button>
                        )}
                      </div>

                      {/* Niche / Category */}
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Niche / Category</label>
                        <select value={item.niche} onChange={e => change(i, { niche: e.target.value })} style={{ ...inp, appearance: "none" as const, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 30 }}>
                          <option value="">Select niche…</option>
                          {["Fintech", "SaaS", "E-commerce", "Health & Wellness", "Travel", "Real Estate", "Education", "Marketing", "Legal", "Crypto / Web3", "Other"].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Right column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Who writes the article?</label>
                        <div className="checkout-brief-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          {[{ mode: "linkpricer", title: "Linkpricer writes it", sub: `+$${CONTENT_FEE_USD.toFixed(2)} · ${DEFAULT_CONTENT_WORD_COUNT} words`, cp: CONTENT_FEE_USD }, { mode: "upload", title: "I'll upload content", sub: "Free · .docx, .md, .pdf", cp: 0 }].map(opt => (
                            <button key={opt.mode} onClick={() => change(i, { contentMode: opt.mode as BriefItem["contentMode"], contentPrice: opt.cp })} style={{ padding: "10px", borderRadius: 10, textAlign: "left" as const, cursor: "pointer", background: item.contentMode === opt.mode ? C.accent50 : "#fff", border: `1px solid ${item.contentMode === opt.mode ? C.accent : C.line}` }}>
                              <div style={{ fontWeight: 700, fontSize: 12.5, color: item.contentMode === opt.mode ? C.accent : C.ink2 }}>{opt.title}</div>
                              <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>{opt.sub}</div>
                            </button>
                          ))}
                        </div>
                        <button onClick={() => change(i, { contentMode: "url", contentPrice: 0 })} style={{ width: "100%", padding: "10px", borderRadius: 10, textAlign: "left" as const, cursor: "pointer", background: item.contentMode === "url" ? C.accent50 : "#fff", border: `1px solid ${item.contentMode === "url" ? C.accent : C.line}` }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: item.contentMode === "url" ? C.accent : C.ink2 }}>Article already published</div>
                          <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>Free · provide URL to existing article</div>
                        </button>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>
                          {item.contentMode === "linkpricer" ? "Brief for the editor" : item.contentMode === "upload" ? "Upload article" : "Article URL"}
                        </label>
                        {item.contentMode === "linkpricer" ? (
                          <textarea value={item.brief} onChange={e => change(i, { brief: e.target.value })} style={{ ...inp, minHeight: 100, resize: "vertical" as const, lineHeight: 1.5 }} placeholder="Editorial piece — lead with industry insight…" />
                        ) : item.contentMode === "upload" ? (
                          <div>
                            {item.selectedFile ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.line}`, borderRadius: 9, padding: "12px 14px", background: "#fff" }}>
                                <span style={{ fontSize: 16 }}>📄</span>
                                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.selectedFile.name}</span>
                                <button onClick={() => handleRemoveUpload(i)} style={{ background: "none", border: "none", color: C.mute, cursor: "pointer", fontSize: 13, padding: 0 }}>Remove</button>
                              </div>
                            ) : (
                              <label
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleFileSelect(i, e.dataTransfer.files[0]); }}
                                style={{ display: "block", border: `1.5px dashed ${C.line}`, borderRadius: 9, padding: 22, textAlign: "center" as const, background: C.bg3, cursor: "pointer" }}
                              >
                                <input
                                  type="file"
                                  accept=".docx,.md,.pdf"
                                  onChange={(e) => { handleFileSelect(i, e.target.files?.[0]); e.target.value = ""; }}
                                  style={{ display: "none" }}
                                />
                                <div style={{ fontSize: 20, color: C.mute }}>↑</div>
                                <div style={{ fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>Drop .docx, .md or .pdf</div>
                                <div style={{ fontSize: 11, color: C.mute, marginTop: 2 }}>or click to choose · max 5 MB</div>
                              </label>
                            )}
                            {item.uploadError && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>{item.uploadError}</div>}
                          </div>
                        ) : (
                          <>
                            <input type="url" value={item.articleUrl} onChange={e => change(i, { articleUrl: e.target.value })} style={{ ...(showFieldErrors && v.articleUrlError ? inpErr : inp), fontFamily: C.mono }} placeholder="https://yourbrand.com/blog/article-title" />
                            {showFieldErrors && v.articleUrlError && fieldErr(v.articleUrlError)}
                          </>
                        )}
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.ink2, letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" as const }}>Tone</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                          {["Editorial", "Authoritative", "Friendly", "Technical"].map(t => (
                            <button key={t} onClick={() => change(i, { tone: t })} style={{ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: item.tone === t ? C.ink : "#fff", color: item.tone === t ? "#fff" : C.ink2, border: `1px solid ${item.tone === t ? C.ink : C.line}` }}>{t}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          {/* RIGHT — summary */}
          <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Estimated cost</h3>
              {items.map(item => (
                <div key={item.domain} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.line2}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: C.bg3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontWeight: 800, fontSize: 13, color: C.ink2, marginTop: 1 }}>{item.domain[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                      <span style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 12.5 }}>{item.domain}</span>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: C.bg3, fontWeight: 700, color: C.ink2 }}>DR {item.dr}</span>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#e8f6ee", fontWeight: 700, color: C.good }}>✓ {item.link}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.mute, marginTop: 2 }}>
                      via <strong style={{ color: C.ink2 }}>{item.offerType === "Vendor" ? item.offerName : prettyMarketplaceName(item.offerName)}</strong> · delivery {item.delivery} days{item.traffic > 0 ? ` · ${item.traffic >= 1000000 ? `${(item.traffic / 1000000).toFixed(0)}M` : item.traffic >= 1000 ? `${(item.traffic / 1000).toFixed(0)}K` : item.traffic} traffic` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 13, flexShrink: 0, paddingTop: 2 }}>${fmtCents(Math.round(item.price * 100) + Math.round(item.contentPrice * 100))}</div>
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 13 }}>
                {[{ l: `${items.length} placements subtotal`, v: `$${fmtCents(subtotalCents)}` }, { l: "Linkpricer fee (15%)", v: `$${fmtCents(feeCents)}` }, { l: "VAT (added per invoice)", v: "—", m: true }].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", color: r.m ? C.mute : C.ink2 }}>
                    <span>{r.l}</span><span style={{ fontFamily: C.mono, fontWeight: 700 }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 6px", marginTop: 6, borderTop: `1px solid ${C.line2}` }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>Estimated total</span>
                  <span style={{ fontFamily: C.mono, fontWeight: 800, fontSize: 24, color: C.ink, letterSpacing: -0.6 }}>${fmtCents(totalCents)}</span>
                </div>
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#e8f6ee", border: "1px solid #bbf0c8", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: C.good }}>✓</span>
                  <div style={{ fontSize: 11.5, color: "#0d5e2e", lineHeight: 1.4 }}><strong>$0 charged today.</strong> Each placement is invoiced after the publication URL is delivered and verified live.</div>
                </div>
              </div>
            </div>
            {placeError && (
              <div style={{ padding: "10px 12px", borderRadius: 9, background: "#fee2e2", border: "1px solid #fca5a5", color: C.bad, fontSize: 12.5, fontWeight: 600 }}>
                {placeError}
              </div>
            )}
            <button onClick={handlePlace} disabled={placing} style={{ padding: 16, background: placing ? C.ink2 : C.ink, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: placing ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {placingStage === "uploading" ? "Uploading article…" : placingStage === "submitting" ? "Placing order…" : "✓ Place order"}
            </button>
            <div style={{ fontSize: 11.5, color: C.mute, textAlign: "center" as const, lineHeight: 1.5 }}>
              By placing this order you agree to the <span style={{ color: C.accent, cursor: "pointer" }}>marketplace terms</span>. We&apos;ll send an invoice for each placement once the publication URL is delivered.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order Placed Modal ────────────────────────────────────────────────────────
function buildReceiptText(orders: PlacedOrder[]): string {
  const lines: string[] = [];
  lines.push("LINKPRICER — ORDER RECEIPT");
  lines.push(`Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`);
  lines.push("");
  let total = 0;
  for (const o of orders) {
    const amount = o.totalAmount ? parseFloat(o.totalAmount) : 0;
    total += amount;
    const sym = currencySymbol(o.snapshotCurrency);
    lines.push(`Order #${o.id.slice(0, 8)}`);
    lines.push(`  Domain:       ${o.snapshotDomain ?? "—"}`);
    lines.push(`  Marketplace:  ${o.snapshotMarketplaceName ?? "—"}`);
    lines.push(`  Article:      ${o.articleTitle ?? "—"}`);
    lines.push(`  Placed:       ${o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}`);
    lines.push(`  Amount:       ${sym}${amount.toLocaleString()}`);
    lines.push("");
  }
  lines.push(`Total: ${orders.length} placement${orders.length === 1 ? "" : "s"}, ${currencySymbol(orders[0]?.snapshotCurrency)}${total.toLocaleString()}`);
  lines.push("");
  lines.push("$0 charged today. Each placement is invoiced individually once its publication URL is delivered and verified live.");
  return lines.join("\n");
}

export function OrderPlacedModal({ orders, onClose }: { orders: PlacedOrder[]; onClose: () => void }) {
  const router = useRouter();
  const orderId = orders[0]?.id?.slice(0, 8) ?? "—";

  function handleDownloadReceipt() {
    const blob = new Blob([buildReceiptText(orders)], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `linkpricer-receipt-${orders[0]?.id?.slice(0, 8) ?? "order"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(15,22,32,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 18, padding: "44px 48px", maxWidth: 700, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "#e8f6ee", color: C.good, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "3px solid #bbf0c8", marginBottom: 14, fontSize: 28 }}>✓</div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: C.ink }}>Order confirmed.</h1>
          <p style={{ margin: "6px 0 0", color: C.mute, fontSize: 14 }}>
            <strong style={{ color: C.good }}>$0 charged today.</strong>{" "}Order ID <strong style={{ color: C.ink, fontFamily: C.mono }}>#{orderId}</strong>
          </p>
        </div>
        <div style={{ background: C.bg3, borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: C.mute, textTransform: "uppercase" as const, marginBottom: 14 }}>What happens next</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[{ icon: "✏️", t: "Editors assigned", d: "Within 24 hours, a specialist in your niche will be assigned to each article." }, { icon: "👁️", t: "Drafts ready to review", d: "2–3 days. Review drafts in your dashboard, request edits, or approve for publication." }, { icon: "🔗", t: "Published & invoiced", d: "Once live, we verify the URL and invoice that placement individually." }].map(s => (
              <div key={s.t} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "#fff", border: `1px solid ${C.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>{s.t}</div>
                <div style={{ fontSize: 12, color: C.mute, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => router.push("/dashboard/orders")} style={{ padding: "12px 22px", background: C.ink, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↗ View your orders</button>
          <button onClick={handleDownloadReceipt} style={{ padding: "12px 22px", background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>↓ Download receipt</button>
        </div>
      </div>
    </div>
  );
}
