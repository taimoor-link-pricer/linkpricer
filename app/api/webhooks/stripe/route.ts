export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";
import type Stripe from "stripe";

// Must be raw body for signature verification — disable Next.js body parsing
export const runtime = "nodejs";

function planLimits(plan: PlanKey) {
  const p = PLANS[plan];
  return { dailyLimit: Math.ceil(p.monthlyQuota / 30), perMinuteLimit: p.perMinuteLimit };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as PlanKey | undefined;

  if (!userId || !plan || !PLANS[plan]) return;

  const { plain, hash } = generateApiKey();
  const { dailyLimit, perMinuteLimit } = planLimits(plan);

  // Deactivate any existing keys for this user
  await db.execute(sql`
    UPDATE api_keys SET is_active = false WHERE user_id = ${userId}
  `);

  // Issue new API key (store plain temporarily for one-time dashboard reveal)
  await db.execute(sql`
    INSERT INTO api_keys (user_id, key_hash, name, daily_limit, per_minute_limit, is_active, plain_key_temp)
    VALUES (${userId}, ${hash}, ${`Linkpricer API — ${PLANS[plan].name}`}, ${dailyLimit}, ${perMinuteLimit}, true, ${plain})
  `);

  // Store subscription metadata on user
  const subId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id ?? null;

  await db.execute(sql`
    UPDATE users
    SET stripe_subscription_id = ${subId},
        stripe_plan             = ${plan}
    WHERE id = ${userId}
  `);

  console.log(`[stripe/webhook] API key issued for user ${userId} on plan ${plan}.`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const plan = sub.metadata?.plan as PlanKey | undefined;
  if (!userId || !plan || !PLANS[plan]) return;

  const { dailyLimit, perMinuteLimit } = planLimits(plan);
  const active = sub.status === "active" || sub.status === "trialing";

  await db.execute(sql`
    UPDATE api_keys
    SET daily_limit      = ${dailyLimit},
        per_minute_limit  = ${perMinuteLimit},
        is_active         = ${active}
    WHERE user_id = ${userId} AND is_active = true
  `);

  await db.execute(sql`
    UPDATE users SET stripe_plan = ${plan} WHERE id = ${userId}
  `);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  await db.execute(sql`
    UPDATE api_keys SET is_active = false WHERE user_id = ${userId}
  `);

  await db.execute(sql`
    UPDATE users SET stripe_plan = null, stripe_subscription_id = null WHERE id = ${userId}
  `);
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    console.error("[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET or stripe-signature header — rejecting.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe guarantees at-least-once delivery. Record the event id
  // first and bail out if we've already processed it, before touching any
  // downstream state (e.g. re-issuing an API key on checkout.session.completed).
  try {
    const inserted = await db.execute(sql`
      INSERT INTO stripe_webhook_events (stripe_event_id, event_type)
      VALUES (${event.id}, ${event.type})
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
    `);
    if ((inserted.rows ?? inserted).length === 0) {
      console.log(`[stripe/webhook] Duplicate delivery of ${event.id}, skipping.`);
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[stripe/webhook] Idempotency check failed:", err);
    return NextResponse.json({ error: "Idempotency check failed" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
