import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

function fmtNum(n: number | null): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function computeGrade(dr: number | null, traffic: number | null): string {
  if (dr == null) return "C";
  if (dr >= 70 && (traffic ?? 0) >= 50000) return "A+";
  if (dr >= 60 && (traffic ?? 0) >= 10000) return "A";
  if (dr >= 45) return "B+";
  if (dr >= 30) return "B";
  return "C";
}

function gradeClass(grade: string): string {
  return grade.startsWith("A") ? "hp-grade-a" : "hp-grade-b";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase().trim() ?? "";
  const limit = 8;

  try {
    const searchClause = q
      ? sql`AND LOWER(d.w) LIKE ${"%" + q + "%"}`
      : sql``;

    const rows = await db.execute(sql`
      SELECT
        LOWER(d.w) AS domain,
        MAX(d.country) AS country,
        COALESCE(MAX(ads."domain_rating"::float), MAX(m."domainRating"::float)) AS dr,
        MAX(m."orgTraffic") AS traffic,
        MAX(m."orgKeywords") AS keywords,
        MAX(m."refDomains") AS ref_domains,
        MIN(p.price::float) AS best_price
      FROM lp_marketplace_domains d
      JOIN lp_domain_price p ON p."domainId" = d.id AND p."isActive" = true
      LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id
      LEFT JOIN lp_ahrefs_dr_staging ads ON ads.domain = LOWER(d.w)
      WHERE d."isActive" = true AND d."deletedAt" IS NULL
      ${searchClause}
      GROUP BY LOWER(d.w)
      ORDER BY COALESCE(MAX(ads."domain_rating"::float), MAX(m."domainRating"::float)) DESC NULLS LAST
      LIMIT ${limit}
    `);

    const domains = rows.rows.map((r, i) => {
      const dr = r.dr != null ? Number(r.dr) : null;
      const traffic = r.traffic != null ? Number(r.traffic) : null;
      const grade = computeGrade(dr, traffic);
      const bestPrice = r.best_price != null ? Number(r.best_price) : null;
      // Rounding to a whole currency unit can erase the 15% margin entirely on
      // cheap prices (e.g. 1.21 * 1.15 = 1.39, rounds down to 1 — below source
      // price). Math.floor(price) + 1 guarantees at least one whole unit of real
      // margin in that case, while leaving normal-priced offers unchanged.
      const ourPrice = bestPrice != null ? Math.max(Math.round(bestPrice * 1.15), Math.floor(bestPrice) + 1) : null;

      return {
        id: `D${i}`,
        domain: r.domain as string,
        country: (r.country as string) ?? "US",
        dr: dr ?? 0,
        traffic: fmtNum(traffic),
        keywords: fmtNum(r.keywords != null ? Number(r.keywords) : null),
        refs: fmtNum(r.ref_domains != null ? Number(r.ref_domains) : null),
        grade,
        gradeClass: gradeClass(grade),
        price: ourPrice != null ? `$${ourPrice.toLocaleString()}` : "—",
      };
    });

    return NextResponse.json({ domains });
  } catch (err) {
    console.error("[/api/search-domains]", err);
    return NextResponse.json({ domains: [] });
  }
}
