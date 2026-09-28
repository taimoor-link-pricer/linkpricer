export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getUsdRates } from "@/lib/currency";
import { isValidHostname, normalizeDomain } from "@/lib/public-api/common";
import { apiError, apiOk, handleOrderApi } from "@/lib/order-api/http";
import { getListings, parseRobotNiche, ROBOT_NICHE_CODES } from "@/lib/order-api/listings";

/**
 * GET /api/v1/listings?domain=example.com&niche=igaming
 *
 * Every buyable guest-post listing on one domain, priced exactly as the public
 * pricing API prices it (see lib/order-api/listings.ts). Order API keys only.
 */
export async function GET(req: NextRequest) {
  return handleOrderApi(req, "read", async (_caller, log) => {
    const params = req.nextUrl.searchParams;
    const domain = normalizeDomain(params.get("domain") ?? "");
    log.domain = domain || null;
    if (!isValidHostname(domain)) {
      return apiError("invalid_request", "domain is required: a bare host such as example.com.", 400);
    }
    const nicheParam = (params.get("niche") ?? "").trim();
    const niche = nicheParam ? parseRobotNiche(nicheParam) : null;
    if (nicheParam && !niche) {
      return apiError("invalid_request", `niche must be one of: ${ROBOT_NICHE_CODES.join(", ")}`, 400);
    }
    log.niche = niche;

    const listings = await getListings(domain, await getUsdRates(), niche);
    log.listings = listings.length;
    return apiOk({ domain, listings });
  });
}
