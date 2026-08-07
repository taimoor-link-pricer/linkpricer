import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [[userRow], [orderRow], [revenueRow]] = await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM users`).then((r) => r.rows as { count: number }[]),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM orders`).then((r) => r.rows as { count: number }[]),
      // Order status strings have drifted across a migration from the old app
      // — some rows use the current lowercase snake_case scheme ("complete"),
      // others still carry legacy casing ("Published", "completed"). Match
      // case-insensitively against every status that represents a finished,
      // billable placement rather than trusting a single exact string.
      db
        .execute(
          sql`SELECT COALESCE(SUM(total_amount::numeric), 0) AS total FROM orders WHERE LOWER(status) IN ('complete', 'completed', 'published')`
        )
        .then((r) => r.rows as { total: string }[]),
    ]);

    return NextResponse.json({
      totalUsers: userRow?.count ?? 0,
      totalOrders: orderRow?.count ?? 0,
      revenue: Number(revenueRow?.total ?? 0),
    });
  } catch (err) {
    console.error("[/api/admin/overview-stats]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
