export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    // Read the cookie off the request directly — see /api/developers/me for why.
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;
    const email = decoded.email ?? "";

    const body = await req.json() as { plan: PlanKey };
    const { plan } = body;

    if (!email || !plan || !PLANS[plan]) {
      return NextResponse.json({ error: "Missing email or plan." }, { status: 400 });
    }

    // This endpoint only starts a *fresh* subscription. Running it for someone
    // who already has one creates a second active Stripe subscription (double
    // billing, no proration) instead of changing the existing one, so it is
    // blocked here and not just in the UI — a direct call can't create a
    // duplicate either. Switching plans is /api/developers/billing/change-plan,
    // which moves the existing subscription and prorates it.
    const existing = await db.execute(sql`
      SELECT stripe_plan, stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    if (existing.rows[0]?.stripe_plan) {
      return NextResponse.json(
        {
          error: "You already have an active plan.",
          message: "You already have an active plan. Change it from your billing page.",
        },
        { status: 409 }
      );
    }

    // Ask Stripe, not just our own column.
    //
    // The stripe_plan check above is a non-locking read of a value only the
    // webhook writes, so it is blind in exactly the window that matters: a
    // customer who has paid but whose webhook has not landed yet still reads as
    // having no plan. Combined with a Checkout Session that expires after 24h
    // (taking its idempotency key with it), that let the same user open a
    // second checkout and end up with two live subscriptions billing in
    // parallel. This is not hypothetical — the live account has one customer on
    // three concurrent Starter subscriptions ($30/mo for a $10 plan) and
    // another on two, created 49 minutes apart.
    //
    // Stripe is the only authority on whether this customer is already paying,
    // so consult it before creating another session.
    const existingCustomerId = (existing.rows[0]?.stripe_customer_id as string) ?? null;
    if (existingCustomerId) {
      const live = await stripe.subscriptions.list({
        customer: existingCustomerId,
        status: "all",
        limit: 100,
      });
      const entitling = live.data.filter(
        (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"
      );
      if (entitling.length > 0) {
        return NextResponse.json(
          {
            error: "You already have an active plan.",
            message: "You already have an active plan. Change it from your billing page.",
          },
          { status: 409 }
        );
      }
    }

    const planConfig = PLANS[plan];

    // Read price ID at request time to avoid build-time env var inlining
    const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? "";
    if (!priceId) {
      return NextResponse.json({ error: "Plan price not configured." }, { status: 500 });
    }

    // Reuses the row already read above rather than querying users a second time.
    let customerId: string | null = existingCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;

      await db.execute(sql`
        UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}
      `);
    }

    const origin = req.headers.get("origin") ?? "https://linkpricer.ai";

    // The "already has a plan" check above is a plain read with no locking,
    // and stripe.checkout.sessions.create is a real network call — two
    // concurrent requests (double-click, two tabs) can both read stripe_plan
    // as null and both reach here, creating two live Checkout Sessions that,
    // if both get paid, become two active subscriptions billing the same
    // user forever (the webhook only dedupes API keys, not subscriptions).
    // A deterministic idempotency key makes Stripe itself collapse concurrent
    // or repeated calls for the same user+plan into the same session instead
    // of creating a second one. Stripe retains idempotency keys for 24h,
    // matching the default Checkout Session expiry, so a legitimate retry
    // after an old session truly expired still gets a fresh session.
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        // An invoice with no address on it isn't usable as a business expense
        // record, and Stripe prints the *customer's* address, not the card's —
        // so it has to be collected here and written back. customer_update is
        // what does the writing back: without it Checkout collects the address
        // for the payment and then throws it away, leaving the customer (and
        // every invoice generated from it) blank.
        billing_address_collection: "required",
        customer_update: { address: "auto", name: "auto" },
        success_url: `${origin}/developers/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/developers/dashboard`,
        metadata: { userId, plan },
        subscription_data: {
          metadata: { userId, plan },
        },
      },
      // Versioned: Stripe replays the stored response for 24h, so without the
      // bump a customer who opened checkout just before address collection was
      // turned on would keep getting the old address-less session back.
      { idempotencyKey: `checkout:v2:${userId}:${plan}` }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/developers/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
