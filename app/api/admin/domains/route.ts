import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
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

// Backed by admin_domain_marketplace_summary, a materialized view (see
// migration/setup note below) precomputing exactly this domain/DR/market
// count/best price/last-synced rollup. The live version of this query --
// domains INNER JOIN marketplace_offers WHERE available, GROUP BY domain,
// ORDER BY domain LIMIT 25 -- has to aggregate the full ~1.7M-row join
// before it can sort and paginate (Postgres can't use an index to skip that
// for an aggregate query), and a plain COUNT(DISTINCT ...) over the same
// join is just as expensive. Measured on production data (599K domains,
// 2.15M offers): ~5.5s for one page of rows, ~12s for the count, run
// concurrently -- comfortably over typical serverless function timeouts,
// which is exactly the 504 this was causing on every single page load.
// Against the view, both queries are sub-100ms.
//
// The view is NOT auto-refreshing -- it reflects the domain/offer data as
// of whenever it was last refreshed (`REFRESH MATERIALIZED VIEW
// CONCURRENTLY admin_domain_marketplace_summary;`, safe to run anytime,
// needs the unique index on domain_id already created alongside it). It
// should be refreshed after the nightly marketplace sync job runs, same
// cadence as the underlying data actually changes -- there is currently no
// automatic hook for that; wire it into that job's own schedule when
// convenient.
export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const exportCsv = searchParams.get("export") === "csv";
  const searchPattern = `%${search}%`;

  try {
    if (exportCsv) {
      const rows = search
        ? await db.execute(sql`
            SELECT domain, dr, market_count, best_price, currency, last_synced
            FROM admin_domain_marketplace_summary
            WHERE domain ILIKE ${searchPattern}
            ORDER BY domain ASC
          `)
        : await db.execute(sql`
            SELECT domain, dr, market_count, best_price, currency, last_synced
            FROM admin_domain_marketplace_summary
            ORDER BY domain ASC
          `);

      const csvRows = (rows.rows ?? rows).map((r: Record<string, unknown>) =>
        [
          escape(r.domain as string),
          escape((r.dr as number) ?? ""),
          escape(r.market_count as number),
          escape((r.best_price as string) ?? ""),
          escape(r.currency as string),
          escape(fmtDate(r.last_synced as string | null)),
        ].join(",")
      );

      const csv = [
        "Domain,DR,Markets,Best Price,Currency,Last Synced",
        ...csvRows,
      ].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="domain-markets.csv"`,
        },
      });
    }

    const [countResult, rowsResult] = await Promise.all([
      search
        ? db.execute(sql`SELECT count(*)::int AS total FROM admin_domain_marketplace_summary WHERE domain ILIKE ${searchPattern}`)
        : db.execute(sql`SELECT count(*)::int AS total FROM admin_domain_marketplace_summary`),
      search
        ? db.execute(sql`
            SELECT domain, dr, market_count, best_price, currency, last_synced
            FROM admin_domain_marketplace_summary
            WHERE domain ILIKE ${searchPattern}
            ORDER BY domain ASC
            LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
          `)
        : db.execute(sql`
            SELECT domain, dr, market_count, best_price, currency, last_synced
            FROM admin_domain_marketplace_summary
            ORDER BY domain ASC
            LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
          `),
    ]);

    const countRows = countResult.rows ?? countResult;
    const total = Number((countRows[0] as { total: number } | undefined)?.total ?? 0);
    const rows = (rowsResult.rows ?? rowsResult) as Record<string, unknown>[];

    return NextResponse.json({
      domains: rows.map((r) => ({
        domain: r.domain,
        dr: r.dr,
        marketCount: Number(r.market_count),
        bestPrice: r.best_price,
        currency: (r.currency as string) ?? "USD",
        lastSynced: r.last_synced,
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
