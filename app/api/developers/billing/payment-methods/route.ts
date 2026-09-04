export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { BillingError, billingContext, handle, NO_STORE } from "@/lib/billing-session";
import { adoptSavedCard, assertOwnedCard } from "@/lib/billing-cards";
import { pmId } from "@/lib/billing";

/**
 * Completes a card save.
 *
 * A SetupIntent leaves the card attached but inert — Stripe never promotes it,
 * and it certainly doesn't retry the invoice that made the customer come here
 * in the first place. This is the second half of "add card": adopt it as the
 * default where that's the right call, and settle a stalled subscription while
 * the customer is still present.
 *
 * Accepts either the payment method id (the on-page flow, where confirmSetup
 * hands it back) or the SetupIntent id (the 3DS redirect flow, where the page
 * is reloaded from scratch and only has `?setup_intent=` to go on).
 */
export async function POST(req: NextRequest) {
  return handle("/api/developers/billing/payment-methods", async () => {
    const ctx = await billingContext(req);
    if (!ctx.customerId) {
      throw new BillingError(404, { error: "not_found", message: "Card not found." });
    }

    const body = (await req.json().catch(() => ({}))) as {
      paymentMethodId?: unknown;
      setupIntentId?: unknown;
    };

    let id: string;

    if (typeof body.setupIntentId === "string" && body.setupIntentId) {
      if (!/^seti_[A-Za-z0-9_]+$/.test(body.setupIntentId)) {
        throw new BillingError(400, { error: "invalid_id", message: "Malformed setup intent id." });
      }
      // Same reasoning as assertOwnedCard: a SetupIntent that doesn't exist and
      // one belonging to somebody else must answer identically.
      let intent: Stripe.SetupIntent;
      try {
        intent = await stripe.setupIntents.retrieve(body.setupIntentId);
      } catch {
        throw new BillingError(404, { error: "not_found", message: "Card not found." });
      }

      // SetupIntent ids also travel through the browser (they're in the return
      // URL), so this needs the same ownership check a payment method gets.
      if (pmId(intent.customer) !== ctx.customerId) {
        throw new BillingError(404, { error: "not_found", message: "Card not found." });
      }
      if (intent.status !== "succeeded") {
        throw new BillingError(409, {
          error: "not_saved",
          message: "That card wasn't saved. Please try again.",
        });
      }
      const attached = pmId(intent.payment_method);
      if (!attached) {
        throw new BillingError(409, {
          error: "not_saved",
          message: "That card wasn't saved. Please try again.",
        });
      }
      id = attached;
    } else if (typeof body.paymentMethodId === "string" && body.paymentMethodId) {
      await assertOwnedCard(body.paymentMethodId, ctx.customerId);
      id = body.paymentMethodId;
    } else {
      throw new BillingError(400, {
        error: "missing_id",
        message: "A payment method or setup intent id is required.",
      });
    }

    const result = await adoptSavedCard(ctx.customerId, id);
    return NextResponse.json({ ...result, paymentMethodId: id }, { headers: NO_STORE });
  });
}
