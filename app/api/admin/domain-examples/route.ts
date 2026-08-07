import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS domain_examples (
      domain TEXT PRIMARY KEY,
      example_url TEXT,
      example_title TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// GET — list all LP domains with their example URLs. Reads from
// admin_domain_examples_agg, a materialized view pre-aggregating dr/traffic/
// offer_count per domain — querying lp_marketplace_domains (2.3M rows) with
// live joins+GROUP BY on every request took ~10.7s (full seq scans across
// all 3 tables to sort/paginate a global top-N) and 504'd on Vercel. The
// view trades near-realtime freshness for a sub-millisecond query; it needs
// a periodic `REFRESH MATERIALIZED VIEW CONCURRENTLY admin_domain_examples_agg`
// wired into the existing scrapper sync cadence to stay current.
export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q")?.toLowerCase() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    await ensureTable();

    const searchClause = search ? sql`AND a.domain LIKE ${"%" + search + "%"}` : sql``;

    const rows = await db.execute(sql`
      SELECT
        a.domain,
        a.dr,
        a.traffic,
        a.category,
        a.offer_count,
        de.example_url,
        de.example_title,
        de.updated_at AS example_updated_at
      FROM admin_domain_examples_agg a
      LEFT JOIN domain_examples de ON de.domain = a.domain
      WHERE 1=1
      ${searchClause}
      ORDER BY a.dr DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM admin_domain_examples_agg a
      WHERE 1=1
      ${searchClause}
    `);

    return NextResponse.json({
      domains: rows.rows,
      total: Number(countRow.rows[0]?.total ?? 0),
      page,
      limit,
    });
  } catch (err) {
    console.error("[/api/admin/domain-examples GET]", err);
    return NextResponse.json({ error: "Failed to load domains" }, { status: 500 });
  }
}

// POST — upsert example URL for a domain
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { domain: string; example_url: string; example_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { domain, example_url, example_title = "" } = body;
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });

  try {
    await ensureTable();

    await db.execute(sql`
      INSERT INTO domain_examples (domain, example_url, example_title, updated_at)
      VALUES (${domain.toLowerCase()}, ${example_url || null}, ${example_title || null}, CURRENT_TIMESTAMP)
      ON CONFLICT (domain) DO UPDATE SET
        example_url = EXCLUDED.example_url,
        example_title = EXCLUDED.example_title,
        updated_at = CURRENT_TIMESTAMP
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/domain-examples POST]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
