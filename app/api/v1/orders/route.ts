export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, authenticate, rateLimit } from "@/lib/order-api/http";
import { getOrderByReference, placeOrder } from "@/lib/order-api/orders";

/**
 * POST /api/v1/orders — place one order for one listing.
 * Idempotent on client_reference; see lib/order-api/orders.ts.
 */
export async function POST(req: NextRequest) {
  const caller = authenticate(req);
  if (caller instanceof Response) return caller;
  const limited = rateLimit(caller, "order");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }

  try {
    return await placeOrder(caller, body, req.nextUrl.origin);
  } catch (err) {
    console.error("[/api/v1/orders POST]", err);
    return apiError("server_error", "Something went wrong on our side. Safe to retry with the same client_reference.", 500);
  }
}

/** GET /api/v1/orders?client_reference=ORD-0231-1 — has this reference been placed? */
export async function GET(req: NextRequest) {
  const caller = authenticate(req);
  if (caller instanceof Response) return caller;
  const limited = rateLimit(caller, "read");
  if (limited) return limited;

  const ref = req.nextUrl.searchParams.get("client_reference");
  if (!ref) return apiError("invalid_request", "client_reference is required.", 400);

  try {
    return await getOrderByReference(caller, ref);
  } catch (err) {
    console.error("[/api/v1/orders GET]", err);
    return apiError("server_error", "Something went wrong on our side. Safe to retry.", 500);
  }
}
