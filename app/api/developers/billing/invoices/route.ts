export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { BillingError, billingContext, handle, NO_STORE } from "@/lib/billing-session";
import { toInvoiceDto } from "@/lib/billing";

/** Invoices per request. The billing page shows this many, then pages on demand. */
const PAGE_SIZE = 12;

/**
 * Paged invoice history.
 *
 * Split out of the main billing GET so that paging back through history
 * doesn't re-fetch the customer, subscription, and cards on every click. The
 * first page still comes from that endpoint — this one only serves what
 * follows, which is why it takes a cursor rather than an offset.
 */
export async function GET(req: NextRequest) {
  return handle("/api/developers/billing/invoices", async () => {
    const ctx = await billingContext(req);
    if (!ctx.customerId) {
      return NextResponse.json({ invoices: [], hasMore: false }, { headers: NO_STORE });
    }

    const cursor = req.nextUrl.searchParams.get("starting_after");
    if (cursor && !/^in_[A-Za-z0-9_]+$/.test(cursor)) {
      throw new BillingError(400, { error: "invalid_cursor", message: "Malformed invoice cursor." });
    }

    // Scoped to this customer, so a cursor from someone else's invoice returns
    // an empty page rather than leaking anything — Stripe will not cross the
    // customer filter to resolve it.
    const page = await stripe.invoices.list({
      customer: ctx.customerId,
      limit: PAGE_SIZE,
      ...(cursor ? { starting_after: cursor } : {}),
    });

    return NextResponse.json(
      { invoices: page.data.map(toInvoiceDto), hasMore: page.has_more },
      { headers: NO_STORE }
    );
  });
}
