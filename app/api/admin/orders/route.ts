import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, users, linkMonitors } from "@/lib/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const openReportCountSql = sql<number>`(
  SELECT count(*)::int FROM user_activity_events uae
  WHERE uae.event_type = 'order_report'
    AND uae.metadata->>'orderId' = ${orders.id}
    AND uae.metadata->>'status' = 'open'
)`;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = 20;
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const hasReports = searchParams.get("hasReports") === "true";

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(orders.status, status));
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(orders.snapshotDomain, `%${search}%`),
          ilike(orders.articleTitle, `%${search}%`),
          eq(orders.id, search)
        )!
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        order: orders,
        clientEmail: users.email,
        openReportCount: openReportCountSql,
        monitor: {
          status: linkMonitors.status,
          lastCheckedAt: linkMonitors.lastCheckedAt,
          nextCheckAt: linkMonitors.nextCheckAt,
          isIndexed: linkMonitors.isIndexed,
        },
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .leftJoin(linkMonitors, eq(linkMonitors.orderId, orders.id))
      .where(hasReports ? and(where, sql`${openReportCountSql} > 0`) : where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .where(where);

    return NextResponse.json({
      orders: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error("[/api/admin/orders GET]", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
