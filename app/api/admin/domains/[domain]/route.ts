import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, marketplaceOffers } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { domain } = await params;
  const decodedDomain = decodeURIComponent(domain).toLowerCase().trim();

  try {
    const markets = await db
      .select({
        marketplaceName: marketplaceOffers.marketplaceName,
        marketplaceUrl: marketplaceOffers.marketplaceUrl,
        minPrice: marketplaceOffers.minPrice,
        maxPrice: marketplaceOffers.maxPrice,
        currency: marketplaceOffers.currency,
        lastFetchedAt: marketplaceOffers.lastFetchedAt,
        available: marketplaceOffers.available,
        linkType: marketplaceOffers.linkType,
        wordCount: marketplaceOffers.wordCount,
        publicationType: marketplaceOffers.publicationType,
        gamblingMinPrice: marketplaceOffers.gamblingMinPrice,
        adultMinPrice: marketplaceOffers.adultMinPrice,
        cbdMinPrice: marketplaceOffers.cbdMinPrice,
        loanMinPrice: marketplaceOffers.loanMinPrice,
        datingMinPrice: marketplaceOffers.datingMinPrice,
        cryptoMinPrice: marketplaceOffers.cryptoMinPrice,
      })
      .from(marketplaceOffers)
      .innerJoin(domains, eq(domains.id, marketplaceOffers.domainId))
      .where(eq(domains.domain, decodedDomain))
      .orderBy(asc(marketplaceOffers.minPrice));

    return NextResponse.json({ markets });
  } catch (err) {
    console.error("[GET /api/admin/domains/[domain]]", err);
    return NextResponse.json({ error: "Failed to fetch domain markets" }, { status: 500 });
  }
}
