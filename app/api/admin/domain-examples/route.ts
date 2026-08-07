import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

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

// GET — list all LP domains with their example URLs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q")?.toLowerCase() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    await ensureTable();

    const searchClause = search ? sql`AND LOWER(d.w) LIKE ${"%" + search + "%"}` : sql``;

    const rows = await db.execute(sql`
      SELECT
        LOWER(d.w) AS domain,
        MAX(m."domainRating"::float) AS dr,
        MAX(m."orgTraffic") AS traffic,
        MAX(d.category) AS category,
        de.example_url,
        de.example_title,
        de.updated_at AS example_updated_at,
        MAX(
          (CASE WHEN p.price IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN p."secondPrice" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN p."thirdPrice" IS NOT NULL THEN 1 ELSE 0 END)
        ) AS offer_count
      FROM lp_marketplace_domains d
      LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id
      LEFT JOIN lp_domain_price p ON p."domainId" = d.id AND p."isActive" = true
      LEFT JOIN domain_examples de ON de.domain = LOWER(d.w)
      WHERE d."isActive" = true AND d."deletedAt" IS NULL
      ${searchClause}
      GROUP BY LOWER(d.w), de.example_url, de.example_title, de.updated_at
      ORDER BY MAX(m."domainRating"::float) DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countRow = await db.execute(sql`
      SELECT COUNT(DISTINCT LOWER(d.w)) AS total
      FROM lp_marketplace_domains d
      WHERE d."isActive" = true AND d."deletedAt" IS NULL
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
