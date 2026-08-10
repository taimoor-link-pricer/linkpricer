import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// Backs the chat dock's conversation list, which is driven by Firestore
// (real conversations = orders with actual messages, discovered via a
// collectionGroup query — see components/admin/chat-dock.tsx). Firestore's
// order mirror only carries enough to authorize chat access (userId) and
// label the thread minimally (domain, title) -- it never got client email,
// so the dock asks Postgres, the actual source of truth, for display labels
// on exactly the order ids it found conversations for. Bounded to 50 ids
// per call so a pathological id list can't turn this into an unbounded scan.
const MAX_IDS = 50;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const idsParam = new URL(req.url).searchParams.get("ids");
    if (!idsParam) return NextResponse.json({ orders: [] });
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json({ orders: [] });

    const rows = await db
      .select({
        id: orders.id,
        clientEmail: users.email,
        domain: orders.snapshotDomain,
        articleTitle: orders.articleTitle,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .where(inArray(orders.id, ids));

    return NextResponse.json({ orders: rows });
  } catch (err) {
    console.error("[/api/admin/orders/meta GET]", err);
    return NextResponse.json({ error: "Failed to fetch order metadata" }, { status: 500 });
  }
}
