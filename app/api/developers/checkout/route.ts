export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { userId: string; email: string; plan: PlanKey };
    const { userId, email, plan } = body;

    if (!userId || !email || !plan || !PLANS[plan]) {
      return NextResponse.json({ error: "Missing userId, email or plan." }, { status: 400 });
    }

    const planConfig = PLANS[plan];

    if (!planConfig.priceId) {
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

    const origin = req.headers.get("origin") ?? "https://linkpricer.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${origin}/developers/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/developers/dashboard`,
      metadata: { userId, plan },
      subscription_data: {
        metadata: { userId, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/developers/checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
