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

    // Plan switching isn't supported yet — this endpoint only starts a fresh
    // subscription, and doing that for someone who already has one creates a
    // second active Stripe subscription (double billing, no proration)
    // instead of changing the existing one. Block it here — not just in the
    // UI — so a direct call can't create a duplicate either.
    const existing = await db.execute(sql`
      SELECT stripe_plan FROM users WHERE id = ${userId} LIMIT 1
    `);
    if (existing.rows[0]?.stripe_plan) {
      return NextResponse.json(
        { error: "You already have an active plan. Contact hello@linkpricer.com to switch plans." },
        { status: 409 }
      );
    }

    const planConfig = PLANS[plan];

    // Read price ID at request time to avoid build-time env var inlining
    const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? "";
    if (!priceId) {
      return NextResponse.json({ error: "Plan price not configured." }, { status: 500 });
    }

    // Look up or create Stripe customer for this user
    const rows = await db.execute(sql`
      SELECT stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1
    `);

    let customerId: string | null = (rows.rows[0]?.stripe_customer_id as string) ?? null;

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
        success_url: `${origin}/developers/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/developers/dashboard`,
        metadata: { userId, plan },
        subscription_data: {
          metadata: { userId, plan },
        },
      },
      { idempotencyKey: `checkout:${userId}:${plan}` }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/developers/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
