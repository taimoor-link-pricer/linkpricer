import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, users } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

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
      .select({ order: orders, clientEmail: users.email })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .where(where)
      .orderBy(desc(orders.createdAt));

    const header = [
      "Order ID", "Order Date", "Client Email", "Domain", "Marketplace",
      "Order Type", "Content Option", "Word Count", "Article Title",
      "Target URL", "Anchor Text", "Requirements", "Price Type",
      "Guest Post Price", "Content Price", "Total Amount", "Currency",
      "Status", "Published URL",
    ];
    const lines = [header.join(",")];
    for (const { order: o, clientEmail } of rows) {
      lines.push([
        o.id, o.createdAt, clientEmail, o.snapshotDomain, o.snapshotMarketplaceName,
        o.orderType, o.contentOption, o.wordCount, o.articleTitle,
        o.targetUrl, o.anchorText, o.requirements, o.priceType,
        o.selectedPrice, o.contentPrice, o.totalAmount, o.snapshotCurrency,
        o.status, o.liveUrl,
      ].map(csvEscape).join(","));
    }

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[/api/admin/orders/export GET]", err);
    return NextResponse.json({ error: "Failed to export orders" }, { status: 500 });
  }
}
