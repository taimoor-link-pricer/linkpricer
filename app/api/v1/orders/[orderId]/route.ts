export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { handleOrderApi } from "@/lib/order-api/http";
import { getOrder } from "@/lib/order-api/orders";

/** GET /api/v1/orders/{order_id} — one order's status. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  return handleOrderApi(req, "read", async (caller, log) => {
    const { orderId } = await ctx.params;
    log.order_id = orderId;
    return getOrder(caller, orderId);
  });
}
