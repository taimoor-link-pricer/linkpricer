export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { planLimits, priceIdForPlan, isEntitled } from "@/lib/billing";
import { issueOrResizeKey } from "@/lib/api-keys";
import { BillingError, billingContextWithCustomer, handle, NO_STORE } from "@/lib/billing-session";

/**
 * Starts a subscription without leaving the site.
 *
 * This replaces the hosted Checkout Session redirect. The card is collected by
 * Stripe Elements in an iframe on our own page — the number still never touches
 * our servers — and this route only ever sees the resulting PaymentMethod id.
 *
 * POST { plan, paymentMethodId }
 *   -> { ok: true, plan }                         subscription is active
 *   -> { requiresAction: true, clientSecret }     card needs a 3DS challenge;
 *                                                 the client confirms it and
 *                                                 calls back to finalize
 */
export async function POST(req: NextRequest) {
  return handle("/api/developers/subscribe", async () => {
    const ctx = await billingContextWithCustomer(req);

    const body = (await req.json().catch(() => ({}))) as {
      plan?: PlanKey;
      paymentMethodId?: string;
    };
    const plan = body.plan;
    const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";

    if (!plan || !PLANS[plan]) {
      throw new BillingError(400, { error: "invalid_plan", message: "Pick a plan to subscribe to." });
    }
    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      throw new BillingError(500, { error: "plan_not_configured", message: "That plan isn't available right now." });
    }

    // Same guard the old checkout route grew: ask Stripe, not our own
    // stripe_plan column, which only the webhook writes and is therefore blind
    // in exactly the window between paying and the webhook landing. Without
    // this a double-submit becomes two live subscriptions billing in parallel.
    const existing = await stripe.subscriptions.list({ customer: ctx.customerId, status: "all", limit: 100 });
    if (existing.data.some((s) => isEntitled(s) || s.status === "past_due")) {
      throw new BillingError(409, {
        error: "already_subscribed",
        message: "You already have an active plan. Change it from your billing page.",
      });
    }

    // Adopt the card the customer just entered as the one this subscription —
    // and every renewal after it — is charged against. It is already attached
    // to the customer by the SetupIntent; this makes it the default so the
    // renewal invoice has something to charge without asking again.
    if (paymentMethodId) {
      await stripe.customers.update(ctx.customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // default_incomplete rather than letting Stripe charge blind: it creates
    // the subscription in a state we can inspect, so a card that needs a 3DS
    // challenge comes back as requires_action for the client to complete
    // instead of silently failing on the invoice and leaving a subscription
    // nobody is paying for.
    const sub = await stripe.subscriptions.create(
      {
        customer: ctx.customerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId || undefined,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.confirmation_secret"],
        // The webhook reads both of these. metadata.userId is how every
        // subscription event finds its way back to a user, and without it the
        // handlers silently ignore the event.
        metadata: { userId: ctx.userId, plan },
      },
      // A deterministic key so a double-click cannot create a second
      // subscription in the window before the guard above can see the first.
      { idempotencyKey: `subscribe:v1:${ctx.userId}:${plan}` }
    );

    const invoice = sub.latest_invoice;
    const secret =
      invoice && typeof invoice !== "string"
        ? (invoice.confirmation_secret?.client_secret ?? null)
        : null;

    if (sub.status === "incomplete" && secret) {
      // The card needs a challenge. Hand the secret back and stop here — the
      // key is issued only once the subscription is genuinely paid for.
      return NextResponse.json(
        { requiresAction: true, clientSecret: secret, subscriptionId: sub.id },
        { headers: NO_STORE }
      );
    }

    if (!isEntitled(sub)) {
      throw new BillingError(402, {
        error: "payment_failed",
        message: "That card was declined. Try another card.",
      });
    }

    await finalize(ctx.userId, plan, sub.id);
    return NextResponse.json({ ok: true, plan }, { headers: NO_STORE });
  });
}

/**
 * Called back once the client has completed a 3DS challenge, to turn a now-paid
 * subscription into an actual API key.
 *
 * Separate from the webhook on purpose: the webhook is the durable path, but it
 * can land seconds later, and a customer staring at a dashboard that still says
 * "no API key" right after paying will assume it failed. Both paths funnel into
 * issueOrResizeKey, which is idempotent, so whichever arrives first wins and the
 * other is a no-op.
 */
export async function PATCH(req: NextRequest) {
  return handle("/api/developers/subscribe", async () => {
    const ctx = await billingContextWithCustomer(req);
    const body = (await req.json().catch(() => ({}))) as { subscriptionId?: string };
    const subId = typeof body.subscriptionId === "string" ? body.subscriptionId : "";
    if (!subId) throw new BillingError(400, { error: "missing_subscription" });

    const sub = await stripe.subscriptions.retrieve(subId);
    // Never trust the id the client hands us — confirm Stripe agrees this
    // subscription belongs to the caller before acting on it.
    const owner = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (owner !== ctx.customerId) throw new BillingError(404, { error: "not_found" });

    if (!isEntitled(sub)) {
      throw new BillingError(402, {
        error: "payment_incomplete",
        message: "That payment didn't complete. Try again or use another card.",
      });
    }

    const plan = (sub.metadata?.plan as PlanKey) ?? null;
    if (!plan || !PLANS[plan]) throw new BillingError(500, { error: "plan_unknown" });

    await finalize(ctx.userId, plan, sub.id);
    return NextResponse.json({ ok: true, plan }, { headers: NO_STORE });
  });
}

async function finalize(userId: string, plan: PlanKey, subscriptionId: string) {
  const { monthlyLimit, dailyLimit, perMinuteLimit } = planLimits(plan);
  await issueOrResizeKey({ userId, planName: PLANS[plan].name, monthlyLimit, dailyLimit, perMinuteLimit });
  await db.execute(sql`
    UPDATE users SET stripe_plan = ${plan}, stripe_subscription_id = ${subscriptionId} WHERE id = ${userId}
  `);
}
