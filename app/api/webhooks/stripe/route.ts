export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { generateApiKey } from "@/lib/api-keys";
import { planFromSubscription, planLimits, isEntitled, pickGoverningSubscription } from "@/lib/billing";
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-error";
import type Stripe from "stripe";

// Must be raw body for signature verification — disable Next.js body parsing
export const runtime = "nodejs";

/**
 * Turns a user's API access on or off in response to subscription state.
 *
 * Written as one statement per direction because the two are not symmetric.
 * Deactivating can safely hit every key a user owns, but reactivating cannot:
 * `api_keys_one_active_per_user` is a unique index over user_id WHERE
 * is_active, so flipping every historical key back on (a user accumulates one
 * per regeneration) would violate it. Only the newest key comes back.
 */
async function setKeyActive(userId: string, active: boolean) {
  if (!active) {
    await db.execute(sql`UPDATE api_keys SET is_active = false WHERE user_id = ${userId}`);
    return;
  }
  await db.execute(sql`
    UPDATE api_keys SET is_active = true
    WHERE id = (
      SELECT id FROM api_keys WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1
    )
  `);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as PlanKey | undefined;

  if (!userId || !plan || !PLANS[plan]) return;

  const { plain, hash } = generateApiKey();
  const { monthlyLimit, dailyLimit, perMinuteLimit } = planLimits(plan);
  const name = `Linkpricer API — ${PLANS[plan].name}`;

  // Deactivate whatever's currently active and issue the new key in one
  // transaction — two separate round trips let two checkout-completed calls
  // for the same user (two distinct sessions landing close together; genuine
  // Stripe retries are already filtered out by the idempotency check above)
  // both deactivate-then-insert and leave two active keys behind.
  //
  // A transaction, NOT a single data-modifying CTE. The CTE version
  // (WITH deactivated AS (UPDATE …) INSERT …) reads as atomic but is not
  // ordered: every statement in a CTE sees the same snapshot, so the INSERT
  // does not observe the UPDATE, and the api_keys_one_active_per_user partial
  // index rejects it outright with 23505. That is not a race — it failed on
  // the very first replay tried against a user who already had an active key,
  // which is exactly the resubscribe path. Statements in a transaction do run
  // in order and do see each other, so the deactivate is visible to the
  // insert.
  const issue = () => db.batch([
    db.execute(sql`UPDATE api_keys SET is_active = false WHERE user_id = ${userId} AND is_active = true`),
    db.execute(sql`
      INSERT INTO api_keys (user_id, key_hash, name, monthly_limit, daily_limit, per_minute_limit, is_active, plain_key_temp)
      VALUES (${userId}, ${hash}, ${name}, ${monthlyLimit}, ${dailyLimit}, ${perMinuteLimit}, true, ${plain})
      RETURNING id
    `),
  ]);

  try {
    await issue();
  } catch (err) {
    // Only a unique violation is recoverable here (another checkout for this
    // same user committing between our deactivate and our insert). The code
    // has to be read through pgErrorCode: Drizzle wraps driver errors, so the
    // `err.code` this used to test is undefined on every real error and the
    // recovery below never ran even once.
    if (pgErrorCode(err) !== PG_UNIQUE_VIOLATION) throw err;
    await issue();
  }

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
  if (!userId) return;

  // Read the plan off the subscription's billed price, never off metadata.
  // Metadata is stamped when the subscription is created and a plan change
  // does not rewrite it, so a switched customer would keep the old plan's
  // quota while paying the new plan's price. The price id is the thing Stripe
  // actually charges, so it cannot drift from the invoice.
  // Derive the plan from the customer's GOVERNING subscription, not from
  // whichever subscription this event happened to be about.
  //
  // A customer can hold more than one live subscription (the checkout race
  // that produced three concurrent Starters on one account). This handler
  // fires per subscription, so an event about the stray $10 sub would rewrite
  // a Scale customer's limits down to Starter's — and the next event about the
  // other sub would put them back, flapping the quota. Resolving the governing
  // subscription first makes the outcome the same whichever event arrives and
  // in whatever order.
  let governing: Stripe.Subscription = sub;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  if (customerId) {
    try {
      const all = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      governing = pickGoverningSubscription(all.data) ?? sub;
    } catch (err) {
      // Fall back to the event's own subscription — worse, but still correct
      // for the overwhelmingly common single-subscription customer.
      console.error("[stripe/webhook] Could not resolve governing subscription; using the event's own.", err);
    }
  }

  const plan = planFromSubscription(governing);
  if (!plan) {
    // An unrecognised price means someone changed the plan catalogue without
    // updating STRIPE_PRICE_*. Leaving limits untouched is the safe failure:
    // it keeps serving the customer at their existing quota rather than
    // guessing, and this line is the breadcrumb.
    console.error(
      `[stripe/webhook] Subscription ${governing.id} is on a price with no matching plan — limits left unchanged.`
    );
    return;
  }

  const { monthlyLimit, dailyLimit, perMinuteLimit } = planLimits(plan);

  // cancel_at_period_end does not revoke anything: the customer keeps the
  // access they've paid for until the period actually ends, at which point
  // Stripe sends customer.subscription.deleted and that handler turns the key
  // off. Status alone decides entitlement here.
  // A plan change resizes the quota but must not hand back quota already
  // spent this month: month_count stays as it is, so a customer who has used
  // 900 of Starter's 1,000 and upgrades to Growth has 1,600 left, not 2,500.
  // Downgrading below what is already spent simply leaves them at the limit
  // until the 1st, which is the correct outcome — they used it.
  // Entitlement FIRST, then limits.
  //
  // The order used to be the other way round, and the limits UPDATE is scoped
  // to `is_active = true`. So for a customer whose key had been deactivated by
  // a lapse, it matched zero rows — and the reactivation that followed brought
  // the key back carrying whatever quota it had before. Someone who lapsed on
  // Starter and resubscribed on Scale was reactivated with Starter's 1,000
  // while paying $50 for 10,000. Turning the key on first means the UPDATE has
  // a row to find.
  await setKeyActive(userId, isEntitled(governing));

  await db.execute(sql`
    UPDATE api_keys
    SET monthly_limit    = ${monthlyLimit},
        daily_limit      = ${dailyLimit},
        per_minute_limit = ${perMinuteLimit}
    WHERE user_id = ${userId} AND is_active = true
  `);

  // stripe_subscription_id is written here too, not just at checkout. It used
  // to be set once and never refreshed, so it went stale the moment a customer
  // resubscribed — and a stale value is what made the delete handler above
  // clear the wrong row.
  await db.execute(sql`
    UPDATE users SET stripe_plan = ${plan}, stripe_subscription_id = ${governing.id} WHERE id = ${userId}
  `);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  // A deleted subscription does NOT mean this customer has stopped paying.
  //
  // This handler used to revoke unconditionally: setKeyActive(userId, false)
  // turns off EVERY key the user owns, and the UPDATE nulled their plan. But a
  // customer can hold more than one live subscription (see the checkout race),
  // and Stripe deliveries can arrive out of order — so a delete for an old,
  // already-superseded subscription would kill API access for someone Stripe is
  // still billing today. Observed in the live data: a user whose
  // stripe_subscription_id had been nulled by a delete for a *different*
  // subscription than the one actually active.
  //
  // Ask Stripe what is actually true before taking anything away.
  let stillEntitled = false;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  if (customerId) {
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      stillEntitled = subs.data.some((s) => s.id !== sub.id && isEntitled(s));
    } catch (err) {
      // Failing closed here would revoke a paying customer's access on a
      // transient Stripe error. Failing open leaves access on until the next
      // event, which is the cheaper mistake by far.
      console.error("[stripe/webhook] Could not confirm remaining subscriptions; leaving access in place.", err);
      return;
    }
  }

  if (stillEntitled) {
    console.log(`[stripe/webhook] ${sub.id} deleted but user ${userId} still has an entitling subscription — access kept.`);
    return;
  }

  await setKeyActive(userId, false);

  // Scoped to the subscription actually being deleted, so a stale or
  // out-of-order delivery cannot clear state belonging to a newer one.
  await db.execute(sql`
    UPDATE users SET stripe_plan = null, stripe_subscription_id = null
    WHERE id = ${userId}
      AND (stripe_subscription_id = ${sub.id} OR stripe_subscription_id IS NULL)
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
    // The idempotency row was inserted before the handler ran, so a failure
    // partway through (e.g. the API key insert succeeds but the following
    // stripe_plan UPDATE times out) would otherwise strand the user in that
    // half-updated state forever — Stripe's automatic retry would just hit
    // the duplicate check above and get a silent 200 without ever re-running
    // the handler. Release the claim so the retry actually retries.
    await db.execute(sql`
      DELETE FROM stripe_webhook_events WHERE stripe_event_id = ${event.id}
    `).catch((cleanupErr) => {
      console.error("[stripe/webhook] Failed to release idempotency claim after handler error:", cleanupErr);
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
