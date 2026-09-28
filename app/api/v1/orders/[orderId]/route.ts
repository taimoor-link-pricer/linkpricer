export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiError, authenticate, rateLimit } from "@/lib/order-api/http";
import { getOrder } from "@/lib/order-api/orders";

/** GET /api/v1/orders/{order_id} — one order's status. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  const caller = authenticate(req);
  if (caller instanceof Response) return caller;
  const limited = rateLimit(caller, "read");
  if (limited) return limited;

  try {
    const { orderId } = await ctx.params;
    return await getOrder(caller, orderId);
  } catch (err) {
    console.error("[/api/v1/orders/:id GET]", err);
    return apiError("server_error", "Something went wrong on our side. Safe to retry.", 500);
  }
}
