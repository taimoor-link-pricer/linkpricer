import { db } from "@/lib/db";
import { linkMonitors, type orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type OrderRow = typeof orders.$inferSelect;

// Bootstraps (or repairs) the link_monitors row for an order once it's published.
// Called both as a side effect of the admin status PATCH (auto-create-on-publish)
// and from the manual "Start monitoring" recovery action — same upsert either way.
export async function upsertLinkMonitor(order: OrderRow, publishedUrl: string) {
  if (!order.userId) throw new Error(`Order ${order.id} has no owning user; cannot create a link monitor`);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [existing] = await db.select().from(linkMonitors).where(eq(linkMonitors.orderId, order.id)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(linkMonitors)
      .set({
        publishedUrl,
        targetUrl: order.targetUrl,
        anchorText: order.anchorText ?? "",
        domain: order.snapshotDomain ?? "",
      })
      .where(eq(linkMonitors.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(linkMonitors)
    .values({
      orderId: order.id,
      userId: order.userId,
      publishedUrl,
      targetUrl: order.targetUrl,
      anchorText: order.anchorText ?? "",
      domain: order.snapshotDomain ?? "",
      status: "pending",
      nextCheckAt: sevenDaysFromNow,
      daysLive: 0,
    })
    .returning();
  return created;
}
