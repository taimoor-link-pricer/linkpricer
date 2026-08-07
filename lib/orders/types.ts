export const ORDER_STATUSES = [
  "confirming_with_marketplace",
  "approval_required",
  "price_increase_requested",
  "article_review",
  "payment_pending",
  "waiting_for_publication",
  "approved",
  "published",
  "complete",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRICE_TYPES = [
  "base",
  "gambling",
  "adult",
  "cbd",
  "loan",
  "dating",
  "crypto",
  "tradingForex",
] as const;

export type PriceType = (typeof PRICE_TYPES)[number];

export const CONTENT_OPTIONS = ["provided", "uploaded", "url"] as const;
export type ContentOption = (typeof CONTENT_OPTIONS)[number];

// Single source of truth for the "Linkpricer writes it" content fee — used
// server-side (lib/orders/pricing.ts, the actual charge) and client-side
// (the checkout estimate) so the two can't drift the way they used to
// (checkout hardcoded a flat $120 while the real charge was wordCount * 5
// cents = $37.50 for the same 750-word default). No DB import here, so this
// stays safe to pull into a "use client" page.
export const CONTENT_PRICE_PER_WORD_CENTS = 5;
export const DEFAULT_CONTENT_WORD_COUNT = 750;
export function contentPriceCents(wordCount: number): number {
  return Math.round(wordCount * CONTENT_PRICE_PER_WORD_CENTS);
}

export const ORDER_TYPES = ["managed", "direct"] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

// Client-triggered transitions. Each maps to exactly one allowed (from -> to) edge,
// enforced in the PATCH /api/orders/:id route — never a raw status string from the client.
export const CLIENT_ORDER_ACTIONS = [
  "accept_price_increase",
  "decline",
  "approve_article",
  "approve_condition_change",
  "cancel",
] as const;

export type ClientOrderAction = (typeof CLIENT_ORDER_ACTIONS)[number];

export const CLIENT_ACTION_TRANSITIONS: Record<
  ClientOrderAction,
  { from: OrderStatus[]; to: OrderStatus }
> = {
  accept_price_increase: { from: ["price_increase_requested"], to: "waiting_for_publication" },
  decline: {
    from: ["approval_required", "price_increase_requested", "confirming_with_marketplace", "waiting_for_publication", "approved"],
    to: "cancelled",
  },
  approve_article: { from: ["article_review"], to: "waiting_for_publication" },
  approve_condition_change: { from: ["approval_required"], to: "waiting_for_publication" },
  cancel: {
    from: ["confirming_with_marketplace", "waiting_for_publication", "approved"],
    to: "cancelled",
  },
};

export const REPORT_CATEGORIES = [
  "late_delivery",
  "quality_below_brief",
  "off_topic",
  "editor_unresponsive",
  "marketplace_pulled_link",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
