export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getUsdRates } from "@/lib/currency";
import { isValidHostname, normalizeDomain } from "@/lib/public-api/common";
import { apiError, apiOk, authenticate, rateLimit } from "@/lib/order-api/http";
import { getListings, parseRobotNiche, ROBOT_NICHE_CODES } from "@/lib/order-api/listings";

/**
 * GET /api/v1/listings?domain=example.com&niche=igaming
 *
 * Every buyable guest-post listing on one domain, priced exactly as the public
 * pricing API prices it (see lib/order-api/listings.ts). Order API keys only.
 */
export async function GET(req: NextRequest) {
  const caller = authenticate(req);
  if (caller instanceof Response) return caller;
  const limited = rateLimit(caller, "read");
  if (limited) return limited;

  const params = req.nextUrl.searchParams;
  const domain = normalizeDomain(params.get("domain") ?? "");
  if (!isValidHostname(domain)) {
    return apiError("invalid_request", "domain is required: a bare host such as example.com.", 400);
  }
  const nicheParam = (params.get("niche") ?? "").trim();
  const niche = nicheParam ? parseRobotNiche(nicheParam) : null;
  if (nicheParam && !niche) {
    return apiError("invalid_request", `niche must be one of: ${ROBOT_NICHE_CODES.join(", ")}`, 400);
  }

  try {
    const listings = await getListings(domain, await getUsdRates(), niche);
    return apiOk({ domain, listings });
  } catch (err) {
    console.error("[/api/v1/listings]", err);
    return apiError("server_error", "Something went wrong on our side. Safe to retry.", 500);
  }
}
