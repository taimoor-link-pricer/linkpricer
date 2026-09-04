export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { BillingError, billingContextWithCustomer, handle, NO_STORE } from "@/lib/billing-session";
import { toBillingDetails } from "@/lib/billing";
import { COUNTRY_CODES } from "@/lib/countries";

const VALID_COUNTRIES: ReadonlySet<string> = new Set(COUNTRY_CODES);

const LIMITS = { name: 150, line1: 200, line2: 200, city: 100, state: 100, postalCode: 20 } as const;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * The name and address printed on this customer's invoices.
 *
 * Checkout collects this on the way in, but every customer who subscribed
 * before that was turned on has none — and an invoice with no address isn't
 * usable as a business expense record. This is how they fix it without us
 * having to reach into Stripe by hand.
 */
export async function POST(req: NextRequest) {
  return handle("/api/developers/billing/details", async () => {
    // WithCustomer, not the plain context: someone can set their billing
    // address before they ever subscribe, and there'd be nothing to write to.
    const ctx = await billingContextWithCustomer(req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = str(body.name, LIMITS.name);
    const line1 = str(body.line1, LIMITS.line1);
    // Deliberately NOT truncated before validation. Slicing to two characters
    // first turns "LITHUANIA" into "LI" — Liechtenstein — and stores it with a
    // 200, which is how a customer ends up with the wrong country printed on a
    // VAT invoice and no error to tell them. Checking membership rather than a
    // shape also rejects well-formed nonsense like "ZZ".
    const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";

    if (!line1) {
      throw new BillingError(400, { error: "missing_line1", message: "Street address is required." });
    }
    if (!VALID_COUNTRIES.has(country)) {
      throw new BillingError(400, { error: "invalid_country", message: "Select a valid country." });
    }

    const customer = await stripe.customers.update(ctx.customerId, {
      // Empty strings rather than omissions: Stripe merges address fields, so
      // omitting `line2` on a save that cleared it would silently keep the old
      // value and print a stale address on the next invoice.
      // Empty string, not undefined. `undefined` means "leave unchanged", so a
      // customer who put the wrong company name on their invoices could never
      // take it off again — the same trap the address fields avoid below.
      name,
      address: {
        line1,
        line2: str(body.line2, LIMITS.line2),
        city: str(body.city, LIMITS.city),
        state: str(body.state, LIMITS.state),
        postal_code: str(body.postalCode, LIMITS.postalCode),
        country,
      },
    });

    return NextResponse.json(toBillingDetails(customer), { headers: NO_STORE });
  });
}
