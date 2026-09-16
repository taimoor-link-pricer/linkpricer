import { db } from "@/lib/db";
import { userActivityEvents } from "@/lib/db/schema";
import { and, desc, eq, gt, sql } from "drizzle-orm";

// Every notification we attempt is recorded (spec rule 3: event type, recipient,
// channel, timestamp, delivery status) so support can settle "I never got the
// email" disputes. Like order history, this reuses the generic
// user_activity_events table rather than adding a table of its own — see
// lib/orders/events.ts for why.
export const NOTIFICATION_EVENT_TYPE = "notification_sent";

export type NotificationChannel = "email" | "telegram";

export type NotificationLogMeta = {
  // Stable identity of this notification, e.g. "order_published:<orderId>".
  // Deduplication is keyed on it, so it must include everything that makes two
  // sends genuinely different.
  dedupeKey: string;
  event: string;
  channel: NotificationChannel;
  recipients: string[];
  orderId?: string | null;
  subject?: string | null;
  status: "sent" | "failed";
  error?: string | null;
};

// userId is the user the notification is *about* (the order's owner), not
// necessarily the recipient — internal Telegram alerts about a client's order
// are filed under that client, same convention as the order event log.
export async function recordNotification(userId: string | null, meta: NotificationLogMeta) {
  if (!userId) {
    // user_activity_events.user_id is a NOT NULL FK, so an order with no owner
    // (legacy/guest rows) can't be logged. Console is the fallback trail rather
    // than failing the send.
    console.warn(`[notifications] no userId for ${meta.dedupeKey} — not logged to DB`, meta);
    return null;
  }
  try {
    const [row] = await db
      .insert(userActivityEvents)
      .values({ userId, eventType: NOTIFICATION_EVENT_TYPE, metadata: meta })
      .returning();
    return row;
  } catch (err) {
    console.error("[notifications] failed to write notification log", err);
    return null;
  }
}

// Spec rule 1, one notification per event: a status that flips twice, a retried
// request or a double-clicked button all replay the same dedupeKey, and only the
// first one inside the window actually sends.
export const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export async function wasRecentlySent(dedupeKey: string, windowMs = DEFAULT_DEDUPE_WINDOW_MS): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  try {
    const rows = await db
      .select({ id: userActivityEvents.id })
      .from(userActivityEvents)
      .where(
        and(
          eq(userActivityEvents.eventType, NOTIFICATION_EVENT_TYPE),
          sql`${userActivityEvents.metadata}->>'dedupeKey' = ${dedupeKey}`,
          sql`${userActivityEvents.metadata}->>'status' = 'sent'`,
          gt(userActivityEvents.timestamp, since)
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    // A failed dedupe check must not block the notification: a duplicate email
    // is a far smaller problem than a missed "action required" one.
    console.error("[notifications] dedupe check failed — sending anyway", err);
    return false;
  }
}

export async function getNotificationLog(orderId: string) {
  return db
    .select()
    .from(userActivityEvents)
    .where(
      and(
        eq(userActivityEvents.eventType, NOTIFICATION_EVENT_TYPE),
        sql`${userActivityEvents.metadata}->>'orderId' = ${orderId}`
      )
    )
    .orderBy(desc(userActivityEvents.timestamp));
}
