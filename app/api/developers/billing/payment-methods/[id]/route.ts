export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { BillingError, billingContext, handle, NO_STORE } from "@/lib/billing-session";
import { assertOwnedCard, setDefaultCard } from "@/lib/billing-cards";
import { effectiveDefaultPm, isCardExpired, isRenewing, pickGoverningSubscription } from "@/lib/billing";

/** Make this card the default for future invoices and for the live subscription. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle("/api/developers/billing/payment-methods/default", async () => {
    const ctx = await billingContext(req);
    const { id } = await params;
    await assertOwnedCard(id, ctx.customerId);

    const subs = await stripe.subscriptions.list({ customer: ctx.customerId!, status: "all", limit: 10 });
    await setDefaultCard(ctx.customerId!, id, pickGoverningSubscription(subs.data));

    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  });
}

/** Detach a saved card. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle("/api/developers/billing/payment-methods/delete", async () => {
    const ctx = await billingContext(req);
    const { id } = await params;
    await assertOwnedCard(id, ctx.customerId);

    const [customer, subs, pms] = await Promise.all([
      stripe.customers.retrieve(ctx.customerId!),
      stripe.subscriptions.list({ customer: ctx.customerId!, status: "all", limit: 10 }),
      stripe.paymentMethods.list({ customer: ctx.customerId!, type: "card", limit: 20 }),
    ]);

    const sub = pickGoverningSubscription(subs.data);

    // Removing the only card while a subscription is still renewing guarantees
    // a failed payment and an involuntary cancellation later — refuse it and
    // say what to do instead, rather than accepting a change whose consequence
    // lands weeks after the click.
    if (isRenewing(sub) && pms.data.length <= 1) {
      throw new BillingError(409, {
        error: "last_card",
        message:
          "This is the only card on file for an active subscription. Add another card first, or cancel your subscription.",
      });
    }

    await stripe.paymentMethods.detach(id);

    // Detaching the default leaves the subscription pointing at nothing. Adopt
    // another saved card so the next renewal still has something to charge —
    // preferring one that can actually be charged, since promoting an expired
    // card just moves the failure to the renewal.
    const remaining = pms.data.filter((pm) => pm.id !== id);
    // Checked against the *effective* default, not just the subscription's:
    // someone with no subscription yet still has a customer-level default, and
    // leaving it pointing at a detached card breaks their first checkout.
    const wasDefault = effectiveDefaultPm(customer, sub) === id;

    if (wasDefault && remaining.length > 0) {
      const next = remaining.find((pm) => !isCardExpired(pm)) ?? remaining[0];
      await setDefaultCard(ctx.customerId!, next.id, sub);
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  });
}
