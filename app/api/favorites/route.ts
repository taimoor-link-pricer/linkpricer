import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { db } from "@/lib/db";
import { favorites, domains } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface FavoriteDomainOut {
  domain: string;
  price: number | null;
  dr: number;
  traffic: number;
  category: string | null;
}

// Best-effort live price lookup against the real marketplace catalog —
// favorited domains only store DR/traffic/category (from `domains`, the
// table `favorites.domainId` FKs to); price is looked up fresh each time
// since it changes far more often than DR/traffic.
async function fetchBestPrices(domainNames: string[]): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (domainNames.length === 0) return priceMap;
  const domainList = sql.join(domainNames.map((d) => sql`${d}`), sql`, `);
  const rows = await db.execute(sql`
    SELECT LOWER(d.w) AS domain, MIN(p.price::float) AS price
    FROM lp_marketplace_domains d
    JOIN lp_domain_price p ON p."domainId" = d.id
    WHERE d."isActive" = true AND p."isActive" = true AND LOWER(d.w) IN (${domainList})
    GROUP BY LOWER(d.w)
  `);
  for (const r of rows.rows) priceMap.set(r.domain as string, Number(r.price));
  return priceMap;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await db
    .select({
      domain: domains.domain,
      dr: domains.domainRating,
      traffic: domains.orgTraffic,
      category: domains.category,
    })
    .from(favorites)
    .innerJoin(domains, eq(favorites.domainId, domains.id))
    .where(eq(favorites.userId, user.uid))
    .orderBy(desc(favorites.createdAt));

  const priceMap = await fetchBestPrices(rows.map((r) => r.domain));

  const result: FavoriteDomainOut[] = rows.map((r) => ({
    domain: r.domain,
    price: priceMap.get(r.domain.toLowerCase()) ?? null,
    dr: r.dr ?? 0,
    traffic: r.traffic ?? 0,
    category: r.category,
  }));

  return NextResponse.json({ favorites: result });
}

interface FavoriteBody {
  domain: string;
  dr?: number;
  traffic?: number;
  category?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: FavoriteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = (body.domain ?? "").trim().toLowerCase();
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  // favorites.domainId FKs to domains.id, not the domain string directly —
  // get-or-create the domains row first. domains.domain has a unique
  // constraint, so this upsert is safe under concurrent requests; on
  // conflict we only touch the `domain` column (no-op) so an existing row's
  // DR/traffic/category (possibly more authoritative) isn't clobbered.
  const [domainRow] = await db
    .insert(domains)
    .values({
      domain,
      domainRating: body.dr ?? null,
      orgTraffic: body.traffic ?? null,
      category: body.category ?? null,
    })
    .onConflictDoUpdate({ target: domains.domain, set: { domain } })
    .returning({ id: domains.id });

  await db
    .insert(favorites)
    .values({ userId: user.uid, domainId: domainRow.id })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const domain = new URL(req.url).searchParams.get("domain")?.trim().toLowerCase() ?? "";
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  const [domainRow] = await db.select({ id: domains.id }).from(domains).where(eq(domains.domain, domain)).limit(1);
  if (domainRow) {
    await db.delete(favorites).where(and(eq(favorites.userId, user.uid), eq(favorites.domainId, domainRow.id)));
  }

  return NextResponse.json({ ok: true });
}
