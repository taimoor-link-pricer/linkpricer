import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getUsdRates, toUsd as toUsdWithRates } from "@/lib/currency";
import { normalizeDomain } from "@/lib/normalize-domain";
import { getCurrentUser } from "@/lib/get-current-user";

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

// Mirrors search/page.tsx's NICHES list — same ids, mapped to the matching
// niche-specific price columns that already exist on both marketplace_offers
// and supplier_offers. "general" (or anything unrecognized) means "just use
// the base min_price/max_price," same as before this existed.
const NICHE_COLUMNS: Record<string, { min: string; max: string }> = {
  igaming: { min: "gambling_min_price", max: "gambling_max_price" },
  adult: { min: "adult_min_price", max: "adult_max_price" },
  cbd: { min: "cbd_min_price", max: "cbd_max_price" },
  loans: { min: "loan_min_price", max: "loan_max_price" },
  dating: { min: "dating_min_price", max: "dating_max_price" },
  crypto: { min: "crypto_min_price", max: "crypto_max_price" },
  forex: { min: "trading_forex_min_price", max: "trading_forex_max_price" },
  insertion: { min: "link_insertion_min_price", max: "link_insertion_max_price" },
};

// Picks the niche-specific price for a row when one was requested and the
// offer actually has it set; otherwise falls back to the base price — a
// niche selection changes which number is shown, it never hides an offer
// that simply doesn't have niche-specific pricing set.
function nichePrice(row: Record<string, unknown>, niche: string): { min: unknown; max: unknown } {
  const cols = NICHE_COLUMNS[niche];
  if (cols) {
    const min = row[cols.min];
    if (min != null) return { min, max: row[cols.max] ?? min };
  }
  return { min: row.min_price, max: row.max_price ?? row.min_price };
}

// Anti-scraping throttle, not a metered quota — this is a free, frequently-used
// interactive feature (paste domains, click Analyze), so the limit is sized to
// never bother a human clicking the button, only a script hammering the
// endpoint to sweep the catalog (up to 200 domains x 4 joined tables per call).
// Reuses the same user_activity_events log related-sites' quota already uses,
// just with a 1-minute window instead of a weekly one.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_EVENT_TYPE = "analyze_domains";

async function checkAndReserveRateLimit(userId: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM user_activity_events
    WHERE user_id = ${userId} AND event_type = ${RATE_LIMIT_EVENT_TYPE}
      AND timestamp > NOW() - INTERVAL '1 minute'
  `);
  const used = Number((rows.rows ?? rows)[0]?.n ?? 0);
  if (used >= RATE_LIMIT_PER_MINUTE) return false;
  await db.execute(sql`
    INSERT INTO user_activity_events (user_id, event_type) VALUES (${userId}, ${RATE_LIMIT_EVENT_TYPE})
  `);
  return true;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!(await checkAndReserveRateLimit(user.uid))) {
    return NextResponse.json(
      { error: "Too many analyze requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { domains: string[]; niche?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { domains } = body;
  const niche = typeof body.niche === "string" && (body.niche === "general" || body.niche in NICHE_COLUMNS)
    ? body.niche
    : "general";
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
    const rates = await getUsdRates();
    const toUsd = (amount: number | null | undefined, currency: string | null | undefined) =>
      toUsdWithRates(amount, currency, rates);

    const [domainRows, marketplaceRows, vendorRows, exampleRows] = await Promise.all([
      // Canonical domain catalog: DR, traffic, keywords, ref domains, grade/score.
      // Base/gate for `found` — every domain here shows up regardless of whether
      // it has current pricing, so a domain never gets hidden just because it
      // has no offer yet (that's handled below via noPrice, not exclusion).
      // Only actively scraper-fed table: `domains` (upsert.ts writes new rows,
      // ahrefs-dr.ts keeps domain_rating/domain_rating_updated_at fresh on its
      // own rolling ~30-day cycle) — legacy lp_marketplace_domains/
      // lp_domain_price/lp_domain_metrics are intentionally not queried here
      // (see PUBLIC_API / analyze-query notes). No JOIN needed anymore:
      // domain_rating is written here directly, not just in the staging table.
      db.execute(sql`
        SELECT
          LOWER(d.domain) AS domain,
          d.country_main_traffic AS country,
          d.language_written_in_website AS lang,
          d.category AS category,
          d.domain_rating::float AS dr,
          d.domain_rating_updated_at AS dr_updated_at,
          d.org_traffic AS traffic,
          d.org_keywords AS keywords,
          d.ref_domains AS ref_domains,
          d.value_grade AS grade,
          d.value_score AS score
        FROM domains d
        WHERE LOWER(d.domain) IN (${domainList})
        ORDER BY LOWER(d.domain)
      `),
      // Marketplace offers (synced from external platforms)
      db.execute(sql`
        SELECT
          LOWER(d.domain) AS domain,
          mo.marketplace_name AS name,
          mo.min_price,
          mo.max_price,
          mo.gambling_min_price,
          mo.gambling_max_price,
          mo.adult_min_price,
          mo.adult_max_price,
          mo.cbd_min_price,
          mo.cbd_max_price,
          mo.loan_min_price,
          mo.loan_max_price,
          mo.dating_min_price,
          mo.dating_max_price,
          mo.crypto_min_price,
          mo.crypto_max_price,
          mo.trading_forex_min_price,
          mo.trading_forex_max_price,
          mo.link_insertion_min_price,
          mo.link_insertion_max_price,
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
          so.gambling_min_price,
          so.gambling_max_price,
          so.adult_min_price,
          so.adult_max_price,
          so.cbd_min_price,
          so.cbd_max_price,
          so.loan_min_price,
          so.loan_max_price,
          so.dating_min_price,
          so.dating_max_price,
          so.crypto_min_price,
          so.crypto_max_price,
          so.trading_forex_min_price,
          so.trading_forex_max_price,
          so.link_insertion_min_price,
          so.link_insertion_max_price,
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
      const { min: rawMin, max: rawMax } = nichePrice(r as Record<string, unknown>, niche);
      const minUsd = toUsd(Number(rawMin ?? 0), r.currency as string | null) ?? 0;
      const maxUsd = toUsd(Number(rawMax ?? rawMin ?? 0), r.currency as string | null) ?? minUsd;
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
      const { min: rawMinV, max: rawMaxV } = nichePrice(r as Record<string, unknown>, niche);
      const minUsd = toUsd(Number(rawMinV ?? 0), r.currency as string | null) ?? 0;
      const maxUsd = toUsd(Number(rawMaxV ?? rawMinV ?? 0), r.currency as string | null) ?? minUsd;
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
    const found = domainRows.rows.map((r) => {
      const domain = r.domain as string;
      foundDomains.add(domain);
      const dr = r.dr != null ? Number(r.dr) : null;
      const traffic = r.traffic != null ? Number(r.traffic) : null;
      const offers = offersMap.get(domain) ?? [];
      // Price comes only from marketplace_offers/supplier_offers now — no
      // legacy lp_domain_price fallback. Domains with no current offer show
      // noPrice: true rather than a possibly stale legacy number. (~15K
      // domains that only ever had a legacy price are a known, accepted gap
      // here pending a future migration of that data into marketplace_offers.)
      const bestPrice = offers.length > 0 ? Math.min(...offers.map((o) => o.minPrice)) : null;

      return {
        domain,
        country: (r.country as string) ?? "US",
        lang: (r.lang as string) ?? "en",
        category: (r.category as string) ?? "General",
        dr: dr ?? 0,
        drUpdatedAt: (r.dr_updated_at as string | null) ?? null,
        drTrend: "flat" as const,
        traffic: traffic ?? 0,
        keywords: r.keywords != null ? Number(r.keywords) : 0,
        refDomains: r.ref_domains != null ? Number(r.ref_domains) : 0,
        grade: (r.grade as string) ?? computeGrade(dr, traffic),
        score: r.score != null ? Number(r.score) : computeScore(dr, traffic),
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
