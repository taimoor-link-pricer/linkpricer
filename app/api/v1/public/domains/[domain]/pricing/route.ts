// Reads the x-api-key header and the niche query param on every call, so this
// is request-time work by construction — declared explicitly rather than left
// to inference, matching the other authenticated routes under /api/developers.
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { handlePricingRequest } from "@/lib/public-api/handler";

/**
 * The public pricing endpoint.
 *
 * Prices are split into `marketplace` (what the sources charge, no fee) and
 * `linkpricer` (what the customer pays, fee included) rather than the five
 * flat fields this used to return, which mixed the two bases with no field
 * name saying which was which. Each niche also carries a label, a one-line
 * summary naming what its price is for, and its own freshness date, and
 * `available_niches` distinguishes "not sold here" from "you filtered it out".
 *
 * The shape is pinned by lib/public-api/contract.test.ts, which asserts the
 * exact key set at every level — the previous shape was changed twice without
 * anything failing, and that is what this prevents.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ domain: string }> }
) {
  return handlePricingRequest(req, ctx);
}
