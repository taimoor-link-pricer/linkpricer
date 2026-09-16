import { sendEmail, sendTelegram } from "./channels";
import { recordNotification, wasRecentlySent, DEFAULT_DEDUPE_WINDOW_MS, type NotificationChannel } from "./log";

export { SUPPORT_REPLY_TO } from "./channels";
export { getNotificationLog, NOTIFICATION_EVENT_TYPE } from "./log";

export type NotifyParams = {
  // What happened, for the log and for reading the history back ("order_published").
  event: string;
  channel: NotificationChannel;
  // Unique per notification instance; defaults to `${event}:${orderId ?? ""}`.
  dedupeKey?: string;
  dedupeWindowMs?: number;
  // Email only. Telegram always goes to the one admin group.
  to?: string[];
  subject?: string;
  text: string;
  html?: string;
  replyTo?: string;
  // The user this notification is about — the order's owner. Used for the log.
  userId?: string | null;
  orderId?: string | null;
};

// The one way anything in the app sends a notification: deduplicated, logged,
// and never throwing. Callers run it inside after() so a slow SendGrid call
// doesn't hold up the client's response.
export async function notify(params: NotifyParams): Promise<boolean> {
  const dedupeKey = params.dedupeKey ?? `${params.event}:${params.orderId ?? ""}`;

  if (await wasRecentlySent(dedupeKey, params.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS)) {
    console.info(`[notifications] skipping duplicate ${dedupeKey}`);
    return false;
  }

  const recipients = params.channel === "email" ? params.to ?? [] : ["telegram:admin-group"];
  if (params.channel === "email" && recipients.length === 0) {
    console.warn(`[notifications] no recipients for ${dedupeKey}`);
    return false;
  }

  const result =
    params.channel === "email"
      ? await sendEmail({ to: recipients, subject: params.subject ?? "", text: params.text, html: params.html, replyTo: params.replyTo })
      : await sendTelegram(params.text);

  await recordNotification(params.userId ?? null, {
    dedupeKey,
    event: params.event,
    channel: params.channel,
    recipients,
    orderId: params.orderId ?? null,
    subject: params.subject ?? null,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
  });

  return result.ok;
}
