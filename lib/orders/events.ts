import { db } from "@/lib/db";
import { userActivityEvents } from "@/lib/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

// Reuses the existing generic `user_activity_events` table (id, userId, eventType,
// timestamp, metadata jsonb, sessionId, createdAt) as the event log for order status
// history, chat messages, and reports — no new tables were created for this feature
// (see the "Revised approach" section of the orders plan). `userId` on every row is
// always the order's owning client (FK requires a valid user); the real actor is
// tracked inside `metadata.actorId`/`metadata.actorRole`.

export const ORDER_EVENT_TYPES = {
  statusChanged: "order_status_changed",
  message: "order_message",
  report: "order_report",
} as const;

type Actor = { id: string | null; role: "client" | "admin" | "system" };

export type OrderStatusChangedMeta = {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  actorRole: Actor["role"];
  note?: string | null;
};

export type OrderMessageAttachment = {
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  kind: "image" | "file";
};

export type OrderMessageMeta = {
  orderId: string;
  senderType: Actor["role"];
  senderId: string | null;
  senderName: string | null;
  body?: string | null;
  attachments?: OrderMessageAttachment[];
};

export type OrderReportMeta = {
  orderId: string;
  category: string;
  description: string;
  pauseDelivery: boolean;
  attachments?: OrderMessageAttachment[];
  status: "open" | "in_review" | "resolved" | "dismissed";
  adminNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
};

type Executor = typeof db;

export async function recordOrderEvent(
  tx: Executor,
  params: { orderOwnerUserId: string; eventType: string; metadata: Record<string, unknown> }
) {
  const [row] = await tx
    .insert(userActivityEvents)
    .values({
      userId: params.orderOwnerUserId,
      eventType: params.eventType,
      metadata: params.metadata,
    })
    .returning();
  return row;
}

export async function getOrderEvents(orderId: string, eventType?: string) {
  const conditions = [sql`${userActivityEvents.metadata}->>'orderId' = ${orderId}`];
  if (eventType) conditions.push(eq(userActivityEvents.eventType, eventType));

  return db
    .select()
    .from(userActivityEvents)
    .where(and(...conditions))
    .orderBy(asc(userActivityEvents.timestamp));
}

export async function patchOrderEventMetadata(eventId: string, patch: Record<string, unknown>) {
  const [row] = await db
    .update(userActivityEvents)
    .set({ metadata: sql`${userActivityEvents.metadata} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(userActivityEvents.id, eventId))
    .returning();
  return row;
}
