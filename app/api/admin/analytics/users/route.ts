import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, userActivityEvents, orders } from "@/lib/db/schema";
import { ilike, desc, sql, count, eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const exportCsv = searchParams.get("export") === "csv";

  const where = search ? ilike(users.email, `%${search}%`) : undefined;

  try {
    if (exportCsv) {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          loginCount: users.loginCount,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt));

      const csvRows = await Promise.all(
        allUsers.map(async (u) => {
          const [bulkStats] = await db
            .select({
              totalBulkSearches: sql<number>`count(*)::int`,
              totalDomainsSearched: sql<number>`coalesce(sum(cast(${userActivityEvents.metadata}->>'domainCount' as integer)), 0)::int`,
            })
            .from(userActivityEvents)
            .where(
              sql`${userActivityEvents.userId} = ${u.id} and ${userActivityEvents.eventType} = 'bulk_search'`
            );

          const [orderStats] = await db
            .select({ totalOrders: sql<number>`count(*)::int` })
            .from(orders)
            .where(eq(orders.userId, u.id));

          const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
          const escape = (v: string | number | null) => {
            const s = v === null || v === undefined ? "" : String(v);
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          };
          const fmt = (d: string | null) =>
            d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : "";

          return [
            escape(name),
            escape(u.email ?? ""),
            fmt(u.lastLoginAt),
            fmt(u.createdAt),
            u.loginCount ?? 0,
            orderStats?.totalOrders ?? 0,
            bulkStats?.totalBulkSearches ?? 0,
            bulkStats?.totalDomainsSearched ?? 0,
          ].join(",");
        })
      );

      const csv = [
        "Name,Email,Last Login,Registered,Total Logins,Total Orders,Bulk Searches,Domains Searched",
        ...csvRows,
      ].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="user_analytics.csv"`,
        },
      });
    }

    const [countResult, rows] = await Promise.all([
      db.select({ total: count() }).from(users).where(where),
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          loginCount: users.loginCount,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          role: users.role,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
    ]);

    const total = Number(countResult[0].total);

    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        firstName: u.firstName,
        lastName: u.lastName,
        loginCount: u.loginCount ?? 0,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        role: u.role,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error("[GET /api/admin/analytics/users]", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
