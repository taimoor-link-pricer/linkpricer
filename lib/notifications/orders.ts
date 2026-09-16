import type { orders } from "@/lib/db/schema";
import type { ClientOrderAction, OrderStatus } from "@/lib/orders/types";
import { isTestOrder, NEW_ORDER_RECIPIENTS } from "@/lib/orders/notify";
import { notify } from "./index";
import { notifyTeam } from "./team";

type OrderRow = typeof orders.$inferSelect;

export function clientOrderUrl(origin: string, orderId: string) {
  return `${origin}/dashboard/orders/${orderId}`;
}

export function adminOrderUrl(origin: string, orderId: string) {
  return `${origin}/admin/orders?order=${orderId}`;
}

function label(order: OrderRow) {
  return order.snapshotDomain ?? order.articleTitle ?? order.id.slice(0, 8);
}

function money(order: OrderRow) {
  return `${order.totalAmount ?? "-"} ${order.snapshotCurrency ?? "USD"}`.trim();
}

// Every client email ends with a direct link to the screen it is about — spec
// rule 2, no "log in and find it yourself".
function clientEmail(params: { intro: string; details?: string[]; cta: string; url: string }) {
  const lines = [params.intro, "", ...(params.details ?? []), "", `${params.cta}: ${params.url}`, "", "— The LinkPricer team"];
  const text = lines.filter((l) => l !== undefined).join("\n");
  const html = [
    `<p>${escapeHtml(params.intro)}</p>`,
    (params.details ?? []).length ? `<ul>${(params.details ?? []).map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>` : "",
    `<p><a href="${escapeHtml(params.url)}">${escapeHtml(params.cta)}</a></p>`,
    `<p>— The LinkPricer team</p>`,
  ].join("\n");
  return { text, html };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Order placed
// ---------------------------------------------------------------------------

// One checkout can create up to 20 order rows (one per domain), and the spec is
// explicit that the client gets one email per order — meaning per checkout, not
// per line item — so the whole batch is described in a single email.
export async function notifyOrdersPlaced(created: OrderRow[], origin: string): Promise<void> {
  const real = created.filter((o) => !isTestOrder(o));
  if (real.length === 0) return;

  const first = real[0];
  const total = real.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0).toFixed(2);
  const details = real.map((o) => `${label(o)} — ${money(o)} — ${o.targetUrl}`);
  if (real.length > 1) details.push(`Order total: ${total} ${first.snapshotCurrency ?? "USD"}`);

  const body = clientEmail({
    intro:
      real.length === 1
        ? `Thanks — we've received your order for ${label(first)} and our team is picking it up now.`
        : `Thanks — we've received your order for ${real.length} placements and our team is picking it up now.`,
    details,
    cta: real.length === 1 ? "Track your order" : "Track your orders",
    url: real.length === 1 ? clientOrderUrl(origin, first.id) : `${origin}/dashboard/orders`,
  });

  if (first.email) {
    await notify({
      event: "order_placed",
      channel: "email",
      // One email per checkout: keying on the first order id makes a retried
      // checkout (same client-minted ids) a no-op instead of a second receipt.
      dedupeKey: `order_placed:${first.id}`,
      to: [first.email],
      subject: real.length === 1 ? `Order received — ${label(first)}` : `Order received — ${real.length} placements`,
      ...body,
      userId: first.userId,
      orderId: first.id,
    });
  }

  await notify({
    event: "order_placed_internal",
    channel: "telegram",
    dedupeKey: `order_placed_internal:${first.id}`,
    text: [
      `[NEW ORDER] ${real.length === 1 ? label(first) : `${real.length} placements`}`,
      `Client: ${first.email ?? "unknown"}`,
      `Total: ${total} ${first.snapshotCurrency ?? "USD"}`,
      adminOrderUrl(origin, first.id),
    ].join("\n"),
    userId: first.userId,
    orderId: first.id,
  });
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

type ClientNotice = {
  subject: (order: OrderRow) => string;
  intro: (order: OrderRow) => string;
  cta: string;
  // Action-required emails are never batched or suppressed by a digest.
  actionRequired: boolean;
};

// Only the statuses the client should hear about. Anything not listed here —
// confirming_with_marketplace above all — is internal: the spec says never tell
// the client we're negotiating with the webmaster.
const CLIENT_NOTICES: Partial<Record<OrderStatus, ClientNotice>> = {
  approval_required: {
    subject: (o) => `Action required — approve the change on ${label(o)}`,
    intro: (o) => `Something about your ${label(o)} placement changed and needs your approval before we continue.`,
    cta: "Review and approve",
    actionRequired: true,
  },
  price_increase_requested: {
    subject: (o) => `Action required — price change on ${label(o)}`,
    intro: (o) => `The marketplace has quoted a different price for ${label(o)}. Your order is paused until you accept or decline it.`,
    cta: "Review the new price",
    actionRequired: true,
  },
  article_review: {
    subject: (o) => `Action required — your article for ${label(o)} is ready to review`,
    intro: (o) => `The draft for ${label(o)} is ready. We'll publish it once you approve.`,
    cta: "Review the article",
    actionRequired: true,
  },
  information_required: {
    subject: (o) => `Action required — we need a few details for ${label(o)}`,
    intro: (o) => `We need something from you before we can continue with ${label(o)}. The order page lists exactly what's missing.`,
    cta: "Provide the details",
    actionRequired: true,
  },
  payment_pending: {
    subject: (o) => `Action required — payment pending for ${label(o)}`,
    intro: (o) => `Your ${label(o)} placement is waiting on payment of ${money(o)} before it can go ahead.`,
    cta: "Open your order",
    actionRequired: true,
  },
  waiting_for_publication: {
    subject: (o) => `We've started work on ${label(o)}`,
    intro: (o) => `Good news — everything is confirmed for ${label(o)} and it's queued for publication.`,
    cta: "Track your order",
    actionRequired: false,
  },
  published: {
    subject: (o) => `Your link is live — ${label(o)}`,
    intro: (o) => `Your placement on ${label(o)} is live${o.liveUrl ? `: ${o.liveUrl}` : "."}`,
    cta: "See the delivered link",
    actionRequired: false,
  },
  complete: {
    subject: (o) => `Order complete — ${label(o)}`,
    intro: (o) => `Your ${label(o)} order is complete. The full delivery summary is on your order page.`,
    cta: "View the summary",
    actionRequired: false,
  },
  cancelled: {
    subject: (o) => `Order cancelled — ${label(o)}`,
    intro: (o) => `Your ${label(o)} order has been cancelled. If this wasn't expected, reply to this email and we'll sort it out.`,
    cta: "View the order",
    actionRequired: false,
  },
  refunded: {
    subject: (o) => `Refund issued — ${label(o)}`,
    intro: (o) => `We've refunded ${money(o)} for your ${label(o)} order. It can take a few working days to appear on your statement.`,
    cta: "View the order",
    actionRequired: false,
  },
};

function statusLabel(status: string | null) {
  return status ? status.replace(/_/g, " ") : "new";
}

export async function notifyOrderStatusChange(params: {
  order: OrderRow;
  fromStatus: string | null;
  toStatus: OrderStatus;
  actorRole: "client" | "admin" | "system";
  // Set when the client's own button click caused the change.
  clientAction?: ClientOrderAction;
  note?: string | null;
  origin: string;
}): Promise<void> {
  const { order, toStatus, origin } = params;
  if (isTestOrder(order)) return;
  if (params.fromStatus === toStatus) return;

  const notice = CLIENT_NOTICES[toStatus];
  // A client who moved their own order (approving an article, accepting a
  // price) doesn't need an email telling them what they just did.
  if (notice && params.actorRole !== "client" && order.email) {
    const body = clientEmail({
      intro: notice.intro(order),
      details: params.note ? [params.note] : undefined,
      cta: notice.cta,
      url: clientOrderUrl(origin, order.id),
    });
    await notify({
      event: `order_status_${toStatus}`,
      channel: "email",
      dedupeKey: `order_status_${toStatus}:${order.id}`,
      to: [order.email],
      subject: notice.subject(order),
      ...body,
      userId: order.userId,
      orderId: order.id,
    });
  }

  // The team hears about every status change, whoever made it, so nothing
  // moves on an order without someone seeing it.
  const tag = params.clientAction ? CLIENT_ACTION_TAGS[params.clientAction] : "STATUS CHANGED";
  const actor = params.actorRole === "client" ? "client" : params.actorRole === "admin" ? "team" : "system";
  await notifyTeam({
    event: "order_status_team",
    dedupeKey: `order_status_team:${order.id}:${params.fromStatus ?? "new"}->${toStatus}`,
    subject: `[${tag}] ${label(order)}: ${statusLabel(params.fromStatus)} → ${statusLabel(toStatus)}`,
    lines: [
      `Changed by: ${actor}`,
      `Client: ${order.email ?? "unknown"} — ${money(order)}`,
      params.note && `Note: ${params.note}`,
      adminOrderUrl(origin, order.id),
    ],
    userId: order.userId,
    orderId: order.id,
  });
}

// ---------------------------------------------------------------------------
// Client actions (approve / decline / accept price) — labels for the status alert
// ---------------------------------------------------------------------------

const CLIENT_ACTION_TAGS: Record<ClientOrderAction, string> = {
  accept_price_increase: "CLIENT ACCEPTED PRICE",
  approve_article: "CLIENT APPROVED ARTICLE",
  approve_condition_change: "CLIENT APPROVED CHANGE",
  decline: "CLIENT DECLINED",
  cancel: "CLIENT CANCELLED",
};

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

// A client message pings the team on Telegram straight away. Nothing is sent
// for a team message here: the client is emailed only if they haven't replied
// within the reply window (see chat.ts), so a quick back-and-forth in the chat
// doesn't fill their inbox.
export async function notifyOrderMessage(params: {
  order: OrderRow;
  messageId: string;
  senderType: "client" | "admin";
  senderName: string | null;
  preview: string;
  origin: string;
}): Promise<void> {
  const { order, origin } = params;
  if (isTestOrder(order) || params.senderType !== "client") return;
  const preview = params.preview.length > 200 ? `${params.preview.slice(0, 200)}…` : params.preview;

  await notify({
    event: "order_message_from_client",
    channel: "telegram",
    // Keyed on the message, not the order: two different questions minutes
    // apart are two different alerts.
    dedupeKey: `order_message:${params.messageId}`,
    text: [
      `[NEW CLIENT MESSAGE] ${label(order)}`,
      `From: ${params.senderName ?? order.email ?? "client"}`,
      preview,
      adminOrderUrl(origin, order.id),
    ].join("\n"),
    userId: order.userId,
    orderId: order.id,
  });
}

export { NEW_ORDER_RECIPIENTS, clientEmail, label };
