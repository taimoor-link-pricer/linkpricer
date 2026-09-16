import { Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { adminDb } from "@/lib/firebase/admin";
import { isTestOrder } from "@/lib/orders/notify";
import { notify } from "./index";
import { adminOrderUrl, clientEmail, clientOrderUrl, label } from "./orders";
import { notifyTeam } from "./team";

// How long a message may sit without a reply before the other side is chased.
export const CHAT_REPLY_WINDOW_MINUTES = Number(process.env.CHAT_REPLY_REMINDER_MINUTES ?? 10);

// Only messages this recent are considered. The cron runs every few minutes, so
// this only needs to cover a missed run or two — and it keeps the first run
// after a deploy from chasing conversations that ended days ago.
const LOOKBACK_MS = 3 * 60 * 60 * 1000;

// A message is chased once, ever.
const ONCE = 365 * 24 * 60 * 60 * 1000;

type ChatMessage = {
  id: string;
  senderType: "client" | "admin";
  senderName: string | null;
  body: string;
  createdAt: Date;
};

function toMessage(doc: QueryDocumentSnapshot): ChatMessage | null {
  const data = doc.data() as { senderType?: string; senderName?: string; body?: string; createdAt?: Timestamp };
  // createdAt is a serverTimestamp(); it can't be missing on a stored doc, but a
  // malformed one must not break the whole run.
  if (!(data.createdAt instanceof Timestamp)) return null;
  return {
    id: doc.id,
    senderType: data.senderType === "admin" ? "admin" : "client",
    senderName: data.senderName ?? null,
    body: data.body ?? "",
    createdAt: data.createdAt.toDate(),
  };
}

function preview(text: string) {
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

export type ChatReminderSummary = { threadsChecked: number; clientReminders: number; teamReminders: number };

// Finds chat threads whose newest message is older than the reply window, i.e.
// the other side hasn't answered, and chases them:
//   - newest message from the team   → email the client
//   - newest message from the client → email + Telegram the team
// Chat lives in Firestore and is written straight from the browser, so this
// reads Firestore rather than trusting the notify-message pings — a sender that
// never pinged (closed tab, old client) is still caught.
// `onlyOrderIds` limits a run to specific threads, for checking this by hand
// against the shared production data without chasing real clients.
export async function sendUnansweredChatReminders(
  origin: string,
  opts: { now?: Date; onlyOrderIds?: string[] } = {}
): Promise<ChatReminderSummary> {
  const now = opts.now ?? new Date();
  const summary: ChatReminderSummary = { threadsChecked: 0, clientReminders: 0, teamReminders: 0 };
  const cutoff = now.getTime() - CHAT_REPLY_WINDOW_MINUTES * 60 * 1000;

  // Uses the COLLECTION_GROUP index on messages.createdAt (firestore.indexes.json),
  // the same one the admin chat dock relies on.
  const snap = await adminDb
    .collectionGroup("messages")
    .where("createdAt", ">=", Timestamp.fromMillis(now.getTime() - LOOKBACK_MS))
    .orderBy("createdAt", "asc")
    .get();

  // Messages per order, oldest first.
  const threads = new Map<string, ChatMessage[]>();
  for (const doc of snap.docs) {
    const orderRef = doc.ref.parent.parent;
    if (!orderRef || orderRef.parent.id !== "orders") continue;
    if (opts.onlyOrderIds && !opts.onlyOrderIds.includes(orderRef.id)) continue;
    const msg = toMessage(doc);
    if (!msg) continue;
    const thread = threads.get(orderRef.id) ?? [];
    thread.push(msg);
    threads.set(orderRef.id, thread);
  }

  // Only threads whose last word is older than the reply window.
  const waiting = [...threads.entries()].filter(([, msgs]) => msgs[msgs.length - 1].createdAt.getTime() <= cutoff);
  summary.threadsChecked = threads.size;
  if (waiting.length === 0) return summary;

  const rows = await db.select().from(orders).where(inArray(orders.id, waiting.map(([id]) => id)));
  const byId = new Map(rows.map((o) => [o.id, o]));

  for (const [orderId, msgs] of waiting) {
    const order = byId.get(orderId);
    // No userId means the reminder can't be logged, which means it can't be
    // deduplicated either and would re-send on every run.
    if (!order || !order.userId || isTestOrder(order)) continue;

    const last = msgs[msgs.length - 1];
    // Everything the waiting side has sent since the other side last spoke.
    const unanswered: ChatMessage[] = [];
    for (let i = msgs.length - 1; i >= 0 && msgs[i].senderType === last.senderType; i--) unanswered.unshift(msgs[i]);
    const minutes = Math.round((now.getTime() - unanswered[0].createdAt.getTime()) / 60000);

    if (last.senderType === "admin") {
      if (!order.email) continue;
      const body = clientEmail({
        intro: `The LinkPricer team wants to talk to you about your ${label(order)} order and is waiting for your reply:`,
        details: unanswered.slice(-3).map((m) => preview(m.body)),
        cta: "Reply in the order chat",
        url: clientOrderUrl(origin, order.id),
      });
      const sent = await notify({
        event: "chat_unanswered_by_client",
        channel: "email",
        dedupeKey: `chat_unanswered:${last.id}`,
        dedupeWindowMs: ONCE,
        to: [order.email],
        subject: `The LinkPricer team is waiting for your reply — ${label(order)}`,
        ...body,
        userId: order.userId,
        orderId: order.id,
      });
      if (sent) summary.clientReminders++;
    } else {
      const sent = await notifyTeam({
        event: "chat_unanswered_by_team",
        dedupeKey: `chat_unanswered:${last.id}`,
        dedupeWindowMs: ONCE,
        subject: `[CHAT NOT ANSWERED ${minutes} MIN] ${label(order)}`,
        lines: [
          `Client: ${last.senderName ?? order.email ?? "unknown"}`,
          ...unanswered.slice(-3).map((m) => `> ${preview(m.body)}`),
          adminOrderUrl(origin, order.id),
        ],
        userId: order.userId,
        orderId: order.id,
      });
      if (sent) summary.teamReminders++;
    }
  }

  return summary;
}
