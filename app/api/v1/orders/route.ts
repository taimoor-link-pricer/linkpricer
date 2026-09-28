export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, handleOrderApi } from "@/lib/order-api/http";
import { getOrderByReference, placeOrder } from "@/lib/order-api/orders";

/**
 * POST /api/v1/orders — place one order for one listing.
 * Idempotent on client_reference; see lib/order-api/orders.ts.
 */
export async function POST(req: NextRequest) {
  return handleOrderApi(req, "order", async (caller, log) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("invalid_request", "Body must be JSON.", 400);
    }
    return placeOrder(caller, body, req.nextUrl.origin, log);
  });
}

/** GET /api/v1/orders?client_reference=ORD-0231-1 — has this reference been placed? */
export async function GET(req: NextRequest) {
  return handleOrderApi(req, "read", async (caller, log) => {
    const ref = req.nextUrl.searchParams.get("client_reference");
    log.client_reference = ref;
    if (!ref) return apiError("invalid_request", "client_reference is required.", 400);
    return getOrderByReference(caller, ref);
  });
}
