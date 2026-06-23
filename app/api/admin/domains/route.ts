import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, marketplaceOffers } from "@/lib/db/schema";
import { ilike, eq, and, asc, min, max, count, countDistinct, sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

function escape(v: string | number | null) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function fmtDate(d: string | null) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) : "";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const exportCsv = searchParams.get("export") === "csv";

  const whereClause = search
    ? and(eq(marketplaceOffers.available, true), ilike(domains.domain, `%${search}%`))
    : eq(marketplaceOffers.available, true);

  try {
    if (exportCsv) {
      const rows = await db
        .select({
          domain: domains.domain,
          dr: domains.domainRating,
          marketplaceName: marketplaceOffers.marketplaceName,
          minPrice: marketplaceOffers.minPrice,
          maxPrice: marketplaceOffers.maxPrice,
          currency: marketplaceOffers.currency,
          lastFetchedAt: marketplaceOffers.lastFetchedAt,
        })
        .from(domains)
        .innerJoin(marketplaceOffers, eq(marketplaceOffers.domainId, domains.id))
        .where(whereClause)
        .orderBy(asc(domains.domain), asc(marketplaceOffers.minPrice));

      const csvRows = rows.map((r) =>
        [
          escape(r.domain),
          escape(r.dr ?? ""),
          escape(r.marketplaceName),
          escape(r.minPrice ?? ""),
          escape(r.maxPrice ?? ""),
          escape(r.currency),
          escape(fmtDate(r.lastFetchedAt)),
        ].join(",")
      );

      const csv = [
        "Domain,DR,Marketplace,Min Price,Max Price,Currency,Last Synced",
        ...csvRows,
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="domain-markets.csv"`,
        },
      });
    }

    const [countResult, rows] = await Promise.all([
      db
        .select({ total: countDistinct(domains.id) })
        .from(domains)
        .innerJoin(marketplaceOffers, eq(marketplaceOffers.domainId, domains.id))
        .where(whereClause),
      db
        .select({
          domain: domains.domain,
          dr: domains.domainRating,
          marketCount: count(marketplaceOffers.id),
          bestPrice: min(marketplaceOffers.minPrice),
          lastSynced: max(marketplaceOffers.lastFetchedAt),
          currency: sql<string>`MAX(${marketplaceOffers.currency})`,
        })
        .from(domains)
        .innerJoin(marketplaceOffers, eq(marketplaceOffers.domainId, domains.id))
        .where(whereClause)
        .groupBy(domains.id, domains.domain, domains.domainRating)
        .orderBy(asc(domains.domain))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
    ]);

    const total = Number(countResult[0]?.total ?? 0);

    return NextResponse.json({
      domains: rows.map((r) => ({
        domain: r.domain,
        dr: r.dr,
        marketCount: Number(r.marketCount),
        bestPrice: r.bestPrice,
        currency: r.currency ?? "USD",
        lastSynced: r.lastSynced,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error("[GET /api/admin/domains]", err);
    return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 });
  }
}
