import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import type { OrderStatus } from "@/lib/orders/types";
import { isTestOrder, NEW_ORDER_RECIPIENTS } from "@/lib/orders/notify";
import { notify } from "./index";
import { clientOrderUrl, adminOrderUrl } from "./orders";

// The statuses where the ball is in the client's court. Reminders chase these
// and nothing else — an order sitting in confirming_with_marketplace is our
// problem, not theirs.
const ACTION_REQUIRED: OrderStatus[] = [
  "approval_required",
  "price_increase_requested",
  "article_review",
  "information_required",
  "payment_pending",
];

// The statuses the scheduled jobs act on, as a whitelist rather than "anything
// not finished". The shared database still holds old-app orders whose status is
// "Published", "pending", "in_progress", "Cancelled" or "completed" — 260 of
// them — and an exclusion list would have treated every one of those as a live
// order and paged the team about it. published/complete/cancelled/refunded are
// deliberately absent: those are done, nothing about them can be stuck.
const OPEN_FOR_SCHEDULING: OrderStatus[] = [
  "confirming_with_marketplace",
  "approval_required",
  "price_increase_requested",
  "article_review",
  "payment_pending",
  "information_required",
  "waiting_for_publication",
  "approved",
];

// Orders older than this are not chased. Without it, switching these jobs on
// would fire a stuck-order alert for every order placed during development —
// all of them long dead — and bury the real ones.
const LOOKBACK_DAYS = Number(process.env.NOTIFICATION_LOOKBACK_DAYS ?? 60);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Long enough that a once-only notification is never re-sent by a later run.
const ONCE = 365 * DAY;

// Spec rule 7 wants this configurable per status in admin settings. There is no
// admin settings screen for it yet, so it is an env var with the spec's default
// — same number, one place to change it, and no schema change to undo later.
export const STUCK_ORDER_BUSINESS_DAYS = Number(process.env.STUCK_ORDER_BUSINESS_DAYS ?? 5);

export function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let days = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days++;
  }
  return days;
}

type OpenOrderRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  status: OrderStatus;
  snapshot_domain: string | null;
  total_amount: string | null;
  snapshot_currency: string | null;
  last_change: string;
  // Only here so the same isTestOrder() rule the new-order email uses can be
  // applied to these rows — test orders must never generate client reminders.
  article_title: string | null;
  target_url: string;
  anchor_text: string | null;
  requirements: string | null;
  article_url: string | null;
  original_file_name: string | null;
  additional_links: unknown;
};

// "How long has this order sat where it is" is the timestamp of its most recent
// status change, falling back to when it was placed for orders that have never
// moved. orders.created_at is a text column, hence the cast.
async function loadOpenOrders(): Promise<OpenOrderRow[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * DAY).toISOString();
  const result = await db.execute(sql`
    SELECT o.id, o.user_id, o.email, o.status, o.snapshot_domain, o.total_amount, o.snapshot_currency,
           o.article_title, o.target_url, o.anchor_text, o.requirements, o.article_url,
           o.original_file_name, o.additional_links,
           COALESCE(MAX(e.timestamp), o.created_at::timestamptz) AS last_change
    FROM orders o
    LEFT JOIN user_activity_events e
      ON e.event_type = 'order_status_changed'
     AND e.metadata->>'orderId' = o.id
    WHERE o.status = ANY(${OPEN_FOR_SCHEDULING})
      AND o.created_at::timestamptz > ${cutoff}
    GROUP BY o.id
  `);
  const rows = result.rows as unknown as OpenOrderRow[];
  return rows.filter(
    (r) =>
      !isTestOrder({
        email: r.email ?? "",
        articleTitle: r.article_title,
        targetUrl: r.target_url,
        anchorText: r.anchor_text,
        requirements: r.requirements,
        articleUrl: r.article_url,
        originalFileName: r.original_file_name,
        additionalLinks: r.additional_links,
      })
  );
}

function describe(order: OpenOrderRow) {
  return `${order.snapshot_domain ?? order.id.slice(0, 8)} — ${order.email ?? "unknown client"} — ${order.total_amount ?? "-"} ${order.snapshot_currency ?? "USD"}`;
}

// ---------------------------------------------------------------------------
// Client review reminders: one after 48h, one after 5 days, then stop and flag
// internally rather than nagging the client a third time.
// ---------------------------------------------------------------------------
async function sendReviewReminders(open: OpenOrderRow[], origin: string, now: Date) {
  for (const order of open) {
    if (!ACTION_REQUIRED.includes(order.status) || !order.email) continue;
    const waitingMs = now.getTime() - new Date(order.last_change).getTime();

    const stage =
      waitingMs >= 10 * DAY ? "flag" : waitingMs >= 5 * DAY ? "second" : waitingMs >= 2 * DAY ? "first" : null;
    if (!stage) continue;

    if (stage === "flag") {
      await notify({
        event: "review_stalled_internal",
        channel: "telegram",
        dedupeKey: `review_stalled:${order.id}`,
        dedupeWindowMs: ONCE,
        text: [
          `[NO CLIENT RESPONSE] ${describe(order)}`,
          `Status ${order.status} for ${Math.floor(waitingMs / DAY)} days, two reminders sent.`,
          adminOrderUrl(origin, order.id),
        ].join("\n"),
        userId: order.user_id,
        orderId: order.id,
      });
      continue;
    }

    const days = Math.floor(waitingMs / DAY);
    await notify({
      event: `review_reminder_${stage}`,
      channel: "email",
      dedupeKey: `review_reminder_${stage}:${order.id}`,
      dedupeWindowMs: ONCE,
      to: [order.email],
      subject: `Reminder — your ${order.snapshot_domain ?? "order"} is waiting on you`,
      text: [
        `Your order for ${order.snapshot_domain ?? "a placement"} has been waiting on you for ${days} days, and we can't move it forward until you take a look.`,
        "",
        `Open your order: ${clientOrderUrl(origin, order.id)}`,
        "",
        "— The LinkPricer team",
      ].join("\n"),
      userId: order.user_id,
      orderId: order.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Stuck orders: no status change for X business days, whoever's fault it is.
// ---------------------------------------------------------------------------
async function sendStuckOrderAlerts(open: OpenOrderRow[], origin: string, now: Date) {
  for (const order of open) {
    const idle = businessDaysBetween(new Date(order.last_change), now);
    if (idle < STUCK_ORDER_BUSINESS_DAYS) continue;

    await notify({
      event: "stuck_order",
      channel: "telegram",
      dedupeKey: `stuck_order:${order.id}`,
      // Re-pings weekly rather than once: an order that stays stuck is still
      // stuck next week, and one alert a week is a nudge rather than noise.
      dedupeWindowMs: 7 * DAY,
      text: [
        `[STUCK ORDER] ${describe(order)}`,
        `No status change in ${idle} business days (status: ${order.status}).`,
        adminOrderUrl(origin, order.id),
      ].join("\n"),
      userId: order.user_id,
      orderId: order.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Daily internal digest — the record of everything Telegram deliberately
// didn't interrupt anyone about.
// ---------------------------------------------------------------------------
async function sendDailyDigest(open: OpenOrderRow[], origin: string, now: Date) {
  const since = new Date(now.getTime() - DAY).toISOString();

  const changes = await db.execute(sql`
    SELECT e.metadata->>'orderId' AS order_id,
           e.metadata->>'fromStatus' AS from_status,
           e.metadata->>'toStatus' AS to_status,
           e.timestamp,
           o.snapshot_domain, o.email
    FROM user_activity_events e
    JOIN orders o ON o.id = e.metadata->>'orderId'
    WHERE e.event_type = 'order_status_changed' AND e.timestamp > ${since}
    ORDER BY e.timestamp ASC
  `);

  const revenue = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE o.created_at::timestamptz > ${since}) AS new_orders,
      COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at::timestamptz > ${since}), 0) AS new_revenue,
      COUNT(*) FILTER (WHERE o.status = 'complete') AS open_complete,
      COUNT(*) FILTER (WHERE o.status = 'refunded') AS refunded_total
    FROM orders o
  `);
  const totals = (revenue.rows[0] ?? {}) as Record<string, string | number>;

  const waitingOnClient = open.filter(
    (o) => ACTION_REQUIRED.includes(o.status) && now.getTime() - new Date(o.last_change).getTime() >= 2 * DAY
  );
  const nearSla = open.filter((o) => {
    const idle = businessDaysBetween(new Date(o.last_change), now);
    return idle === STUCK_ORDER_BUSINESS_DAYS - 1;
  });

  const lines = [
    `LinkPricer daily digest — ${now.toISOString().slice(0, 10)}`,
    "",
    `Status changes in the last 24h: ${changes.rows.length}`,
    ...changes.rows.map(
      (r) =>
        `  • ${(r as Record<string, string>).snapshot_domain ?? (r as Record<string, string>).order_id} — ${(r as Record<string, string>).from_status ?? "new"} → ${(r as Record<string, string>).to_status} (${(r as Record<string, string>).email ?? "?"})`
    ),
    "",
    `Waiting on the client for more than 48h: ${waitingOnClient.length}`,
    ...waitingOnClient.map((o) => `  • ${describe(o)} — ${o.status}`),
    "",
    `Approaching the ${STUCK_ORDER_BUSINESS_DAYS}-business-day SLA: ${nearSla.length}`,
    ...nearSla.map((o) => `  • ${describe(o)} — ${o.status}`),
    "",
    `New orders (24h): ${totals.new_orders ?? 0} — ${totals.new_revenue ?? 0}`,
    `Orders complete (all time): ${totals.open_complete ?? 0} · refunded: ${totals.refunded_total ?? 0}`,
    "",
    `${origin}/admin/orders`,
  ];

  await notify({
    event: "daily_digest",
    channel: "email",
    // One digest per calendar day, however many times the cron fires.
    dedupeKey: `daily_digest:${now.toISOString().slice(0, 10)}`,
    dedupeWindowMs: DAY,
    to: NEW_ORDER_RECIPIENTS,
    subject: `LinkPricer daily digest — ${changes.rows.length} status changes, ${waitingOnClient.length} waiting on clients`,
    text: lines.join("\n"),
    // Internal digest: filed under no particular client, so it lives in the
    // logs rather than in the notification table (see recordNotification).
    userId: null,
  });
}

export type ScheduledRunSummary = {
  openOrders: number;
  ranAt: string;
};

// Everything the clock drives, in one pass over the open orders. Called by the
// cron route; safe to run more than once a day — every send inside is
// deduplicated on its own key.
export async function runScheduledNotifications(origin: string, opts?: { digest?: boolean }): Promise<ScheduledRunSummary> {
  const now = new Date();
  const open = await loadOpenOrders();

  await sendReviewReminders(open, origin, now);
  await sendStuckOrderAlerts(open, origin, now);
  if (opts?.digest !== false) await sendDailyDigest(open, origin, now);

  return { openOrders: open.length, ranAt: now.toISOString() };
}
