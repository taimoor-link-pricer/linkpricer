export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { billingContextWithCustomer, handle, NO_STORE } from "@/lib/billing-session";

/**
 * Issues a SetupIntent client secret so Stripe Elements can collect and store a
 * card without the number ever reaching our servers or our logs — the card is
 * posted from the browser straight to Stripe from inside their iframe, and we
 * only ever see the resulting PaymentMethod id.
 *
 * Creating the Stripe customer here (rather than only at checkout) is what lets
 * someone save a card *before* they have any subscription.
 */
export async function POST(req: NextRequest) {
  return handle("/api/developers/billing/setup-intent", async () => {
    const ctx = await billingContextWithCustomer(req);

    const intent = await stripe.setupIntents.create({
      customer: ctx.customerId,
      payment_method_types: ["card"],
      // off_session: this card is being saved to bill later on a renewal the
      // customer isn't present for. Stripe uses it to request the stronger
      // mandate/3DS treatment now, so the future renewal is less likely to be
      // declined for authentication the customer isn't there to complete.
      usage: "off_session",
      metadata: { userId: ctx.userId },
    });

    return NextResponse.json({ clientSecret: intent.client_secret }, { headers: NO_STORE });
  });
}
