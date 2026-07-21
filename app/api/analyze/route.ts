import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
}

// Marketplace prices are stored in their source currency (mo.currency / so.currency / p.currency),
// not USD. Convert to USD here so every price leaving this route is genuinely USD — the frontend's
// priceFmt(usd, displayCurrency) assumes its input is already USD.
const CURRENCY_TO_USD: Record<string, number> = { USD: 1, EUR: 1 / 0.92, GBP: 1 / 0.79 };
function toUsd(amount: number | null | undefined, currency: string | null | undefined): number | null {
  if (amount == null) return null;
  const rate = CURRENCY_TO_USD[(currency ?? "USD").trim().toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

function computeGrade(dr: number | null, traffic: number | null): string {
  if (dr == null) return "C";
  if (dr >= 70 && (traffic ?? 0) >= 50000) return "A+";
  if (dr >= 60 && (traffic ?? 0) >= 10000) return "A";
  if (dr >= 45) return "B+";
  if (dr >= 30) return "B";
  return "C";
}

function computeScore(dr: number | null, traffic: number | null): number {
  const drPart = Math.min(dr ?? 0, 100) * 0.6;
  const trafPart = Math.min(Math.log10(Math.max(traffic ?? 1, 1)) / 7, 1) * 40;
  return Math.round(drPart + trafPart);
}

function fmtUpdated(ts: string | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export async function POST(req: NextRequest) {
  let body: { domains: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { domains } = body;
  if (!Array.isArray(domains) || domains.length === 0) {
    return NextResponse.json({ error: "domains array required" }, { status: 400 });
  }

  const normalized = domains.map(normalizeDomain).filter(Boolean).slice(0, 200);
  if (normalized.length === 0) {
    return NextResponse.json({ found: [], notFound: [] });
  }

  const domainList = sql.join(
    normalized.map((d) => sql`${d}`),
    sql`, `
  );

  try {
    // Ensure domain_examples table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS domain_examples (
        domain TEXT PRIMARY KEY,
        example_url TEXT,
        example_title TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [lpRows, gradeRows, marketplaceRows, vendorRows, exampleRows] = await Promise.all([
      // LP catalog: DR, traffic, keywords, ref domains, min price
      db.execute(sql`
        SELECT
          LOWER(d.w) AS domain,
          MAX(d.country) AS country,
          MAX(d.language) AS lang,
          MAX(d.category) AS category,
          COALESCE(MAX(ads."domain_rating"::float), MAX(m."domainRating"::float)) AS dr,
          MAX(m."orgTraffic") AS traffic,
          MAX(m."orgKeywords") AS keywords,
          MAX(m."refDomains") AS ref_domains,
          MIN(p.price::float) AS best_price,
          MAX(TRIM(COALESCE(p.currency::text, 'EUR'))) AS currency
        FROM lp_marketplace_domains d
        JOIN lp_domain_price p ON p."domainId" = d.id
        LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id
        LEFT JOIN lp_ahrefs_dr_staging ads ON ads.domain = LOWER(d.w)
        WHERE d."isActive" = true
          AND p."isActive" = true
          AND p.price::float > 0
          AND d."deletedAt" IS NULL
          AND LOWER(d.w) IN (${domainList})
        GROUP BY LOWER(d.w)
      `),
      // Domains table: grade override
      db.execute(sql`
        SELECT LOWER(domain) AS domain, value_grade AS grade, value_score AS score
        FROM domains
        WHERE LOWER(domain) IN (${domainList})
      `),
      // Marketplace offers (synced from external platforms)
      db.execute(sql`
        SELECT
          LOWER(d.domain) AS domain,
          mo.marketplace_name AS name,
          mo.min_price,
          mo.max_price,
          mo.currency,
          mo.delivery_time_days,
          mo.quality_score,
          mo.link_type,
          mo.tat,
          mo.updated_at
        FROM marketplace_offers mo
        JOIN domains d ON d.id = mo.domain_id
        WHERE mo.available = true
          AND mo.min_price::float > 0
          AND LOWER(d.domain) IN (${domainList})
        ORDER BY mo.min_price::float ASC
      `),
      // Vendor (supplier) offers
      db.execute(sql`
        SELECT
          LOWER(so.domain) AS domain,
          COALESCE(u.vendor_name, CONCAT(u.first_name, ' ', u.last_name), u.email) AS vendor_name,
          so.min_price,
          so.max_price,
          so.currency,
          so.delivery_time_days,
          so.updated_at,
          so.status
        FROM supplier_offers so
        JOIN users u ON u.id = so.vendor_user_id
        WHERE so.status = 'active'
          AND so.is_active = true
          AND so.min_price::float > 0
          AND LOWER(so.domain) IN (${domainList})
        ORDER BY so.min_price::float ASC
      `),
      // Admin-set example URLs
      db.execute(sql`
        SELECT domain, example_url, example_title
        FROM domain_examples
        WHERE domain IN (${domainList})
          AND example_url IS NOT NULL
          AND example_url != ''
      `),
    ]);

    // Build example map keyed by domain
    const exampleMap = new Map<string, { url: string; title: string }>();
    for (const r of exampleRows.rows) {
      exampleMap.set(r.domain as string, {
        url: r.example_url as string,
        title: (r.example_title as string) ?? "",
      });
    }

    // Build grade map
    const gradeMap = new Map<string, { grade: string; score: number }>();
    for (const r of gradeRows.rows) {
      gradeMap.set(r.domain as string, {
        grade: (r.grade as string) ?? "C",
        score: Number(r.score ?? 0),
      });
    }

    // Build offers map keyed by domain
    type RawOffer = {
      name: string;
      type: "API" | "Vendor" | "DB";
      updated: string;
      minPrice: number;
      maxPrice: number;
      quality: number;
      delivery: number;
      tat: number;
      link: string;
      example: string | null;
    };
    const offersMap = new Map<string, RawOffer[]>();

    for (const r of marketplaceRows.rows) {
      const domain = r.domain as string;
      if (!offersMap.has(domain)) offersMap.set(domain, []);
      const ex = exampleMap.get(domain);
      const minUsd = toUsd(Number(r.min_price ?? 0), r.currency as string | null) ?? 0;
      const maxUsd = toUsd(Number(r.max_price ?? r.min_price ?? 0), r.currency as string | null) ?? minUsd;
      offersMap.get(domain)!.push({
        name: (r.name as string) ?? "Marketplace",
        type: "DB",
        updated: fmtUpdated(r.updated_at as string | null),
        minPrice: minUsd,
        maxPrice: maxUsd,
        quality: Math.min(5, Math.max(1, Number(r.quality_score ?? 3))),
        delivery: Number(r.delivery_time_days ?? 14),
        tat: Number(r.tat ?? r.delivery_time_days ?? 14),
        link: (r.link_type as string) ?? "Dofollow",
        example: ex?.url ?? null,
      });
    }

    for (const r of vendorRows.rows) {
      const domain = r.domain as string;
      if (!offersMap.has(domain)) offersMap.set(domain, []);
      const exV = exampleMap.get(domain);
      const minUsd = toUsd(Number(r.min_price ?? 0), r.currency as string | null) ?? 0;
      const maxUsd = toUsd(Number(r.max_price ?? r.min_price ?? 0), r.currency as string | null) ?? minUsd;
      offersMap.get(domain)!.push({
        name: `Vendor: ${r.vendor_name as string}`,
        type: "Vendor",
        updated: fmtUpdated(r.updated_at as string | null),
        minPrice: minUsd,
        maxPrice: maxUsd,
        quality: 3,
        delivery: Number(r.delivery_time_days ?? 14),
        tat: Number(r.delivery_time_days ?? 14),
        link: "Dofollow",
        example: exV?.url ?? null,
      });
    }

    // Sort offers by minPrice within each domain
    for (const offers of offersMap.values()) {
      offers.sort((a, b) => a.minPrice - b.minPrice);
    }

    const foundDomains = new Set<string>();
    const found = lpRows.rows.map((r) => {
      const domain = r.domain as string;
      foundDomains.add(domain);
      const dr = r.dr != null ? Number(r.dr) : null;
      const traffic = r.traffic != null ? Number(r.traffic) : null;
      const gradeInfo = gradeMap.get(domain);
      const offers = offersMap.get(domain) ?? [];
      const lpPrice = toUsd(r.best_price != null ? Number(r.best_price) : null, r.currency as string | null);
      const offerMin = offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null;
      // Prefer marketplace_offers (kept fresh by the scraper fleet) over
      // lp_domain_price, a legacy table most connectors stopped writing to
      // (frozen ~March 2026 for 44/46 marketplaces). Blending with Math.min
      // let a months-stale number beat today's real price whenever it was
      // lower. lp is fallback-only, for domains with no offers coverage yet.
      const bestPrice = offerMin ?? lpPrice;

      return {
        domain,
        country: (r.country as string) ?? "US",
        lang: (r.lang as string) ?? "en",
        category: (r.category as string) ?? "General",
        dr: dr ?? 0,
        drTrend: "flat" as const,
        traffic: traffic ?? 0,
        keywords: r.keywords != null ? Number(r.keywords) : 0,
        refDomains: r.ref_domains != null ? Number(r.ref_domains) : 0,
        grade: gradeInfo?.grade ?? computeGrade(dr, traffic),
        score: computeScore(dr, traffic),
        bestPrice,
        yourPrice: null as number | null,
        noPrice: bestPrice == null,
        offers,
      };
    });

    const notFound = normalized.filter((d) => !foundDomains.has(d));

    return NextResponse.json({ found, notFound });
  } catch (err) {
    console.error("[/api/analyze]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
