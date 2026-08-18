import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { adminDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// Bounds how many of the caller's most-recent orders get checked for an
// unread admin reply. Each check is two Firestore reads via the Admin SDK
// (the order doc, for clientLastReadAt — and its messages subcollection's
// latest doc), fanned out in parallel per order — cheap individually, but
// unbounded fan-out isn't: an account with years of order history would
// otherwise fire two reads per historical order on every poll. 200
// comfortably covers real usage (open conversations are a small fraction of
// any account's total orders) while keeping a hard ceiling. This is a badge,
// not the source of truth — an old order past the cutoff that somehow got a
// fresh reply just won't contribute to the count; its own page always shows
// the real thread regardless.
const MAX_ORDERS_CHECKED = 200;

interface LatestMessageDoc {
  senderType?: "admin" | "client";
  createdAt?: Timestamp;
}

interface OrderMirrorDoc {
  clientLastReadAt?: Timestamp;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Same ownership boundary as GET /api/orders — Postgres remains the
    // source of truth for *which* orders this user can see (including
    // company-shared ones); only the read-receipt itself lives in Firestore.
    const visibility = user.companyId
      ? or(eq(orders.userId, user.uid), eq(orders.companyId, user.companyId))
      : eq(orders.userId, user.uid);

    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(visibility)
      .orderBy(desc(orders.createdAt))
      .limit(MAX_ORDERS_CHECKED);

    const checked = await Promise.all(
      rows.map(async ({ id }) => {
        try {
          const orderRef = adminDb.collection("orders").doc(id);
          const [orderSnap, messagesSnap] = await Promise.all([
            orderRef.get(),
            orderRef.collection("messages").orderBy("createdAt", "desc").limit(1).get(),
          ]);
          if (messagesSnap.empty) return null;

          const latest = messagesSnap.docs[0].data() as LatestMessageDoc;
          // Only an admin reply makes an order "unread" for the client — the
          // client's own last message obviously isn't unread to themselves.
          if (latest.senderType !== "admin" || !latest.createdAt) return null;

          const lastRead = (orderSnap.data() as OrderMirrorDoc | undefined)?.clientLastReadAt ?? null;
          const unread = !lastRead || latest.createdAt.toMillis() > lastRead.toMillis();
          return unread ? id : null;
        } catch (err) {
          // One order's Firestore reads failing (missing mirror doc on a
          // pre-chat order, a transient error) must not blank the badge for
          // every other order in the same response.
          console.error("[/api/orders/unread-summary] order", id, err);
          return null;
        }
      })
    );

    const unreadOrderIds = checked.filter((id): id is string => id !== null);
    return NextResponse.json({ totalUnread: unreadOrderIds.length, unreadOrderIds });
  } catch (err) {
    console.error("[/api/orders/unread-summary GET]", err);
    return NextResponse.json({ error: "Failed to load unread summary" }, { status: 500 });
  }
}
