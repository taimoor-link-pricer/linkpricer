export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import {
  priceIdForPlan,
  planFromSubscription,
  planLimits,
  periodEnd,
  isDowngrade,
  currentSchedulePhase,
  phaseDurationFromPrice,
} from "@/lib/billing";
import { BillingError, billingContext, handle, NO_STORE } from "@/lib/billing-session";

/**
 * How long a quoted proration stays honourable, in seconds.
 *
 * Proration is computed to the second, so a quote and the charge that follows
 * only agree if both are computed at the same instant — hence passing an
 * explicit proration_date through both calls. Accepting an arbitrarily old one
 * would let someone sit on a stale quote (or replay it) and be billed against a
 * moment that no longer reflects what they've used, so quotes go stale quickly.
 */
const QUOTE_TTL_SECONDS = 15 * 60;

interface Body {
  plan?: string;
  preview?: boolean;
  prorationDate?: number;
}

const PLAN_PRICES = Object.fromEntries(
  (Object.keys(PLANS) as PlanKey[]).map((p) => [p, PLANS[p].priceUsd])
) as Record<PlanKey, number>;

/**
 * Moves the subscription to `newPriceId` when the current period ends, leaving
 * this period exactly as the customer paid for it.
 *
 * Used for downgrades. Charging nothing and changing nothing today is the
 * point: they bought this period at the higher tier, so the quota and the
 * price both hold until it runs out. Stripe expresses that as a two-phase
 * schedule — the rest of the paid period on the old price, then the new one.
 */
async function scheduleAtPeriodEnd(sub: Stripe.Subscription, newPriceId: string) {
  const duration = phaseDurationFromPrice(sub.items.data[0]?.price);

  const scheduleId =
    typeof sub.schedule === "string" ? sub.schedule : (sub.schedule?.id ?? null);

  const schedule = scheduleId
    ? await stripe.subscriptionSchedules.retrieve(scheduleId)
    : await stripe.subscriptionSchedules.create({ from_subscription: sub.id });

  // The phase that is running *now* — not the last one. On a schedule that
  // already carries a pending downgrade the last phase is that pending change,
  // and rebuilding phase 0 from it moves the current phase's start date, which
  // Stripe rejects outright ("You can not modify the start date of the current
  // phase"). That made a pending downgrade impossible to change your mind
  // about.
  const current = currentSchedulePhase(schedule.phases, Math.floor(Date.now() / 1000));
  const currentPriceId = (() => {
    const first = current?.items?.[0]?.price;
    return typeof first === "string" ? first : (first?.id ?? null);
  })();
  if (!current || !currentPriceId) {
    throw new BillingError(500, {
      error: "schedule_failed",
      message: "Could not schedule that change. Please contact support.",
    });
  }

  return stripe.subscriptionSchedules.update(schedule.id, {
    // release, not cancel: once the new phase has billed once, the schedule
    // lets go and the subscription carries on renewing at the new price by
    // itself. `cancel` would end the subscription instead.
    end_behavior: "release",
    phases: [
      {
        items: [{ price: currentPriceId, quantity: 1 }],
        start_date: current.start_date,
        end_date: current.end_date,
      },
      // One billing interval, then `end_behavior: release` hands the
      // subscription back so it renews at the new price on its own.
      // (`iterations` was replaced by `duration` on this API version.)
      { items: [{ price: newPriceId, quantity: 1 }], duration },
    ],
  });
}

async function liveSubscription(customerId: string): Promise<Stripe.Subscription> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
    expand: ["data.schedule"],
  });
  const live = subs.data.find((s) => s.status === "active" || s.status === "trialing");
  if (!live) {
    throw new BillingError(409, {
      error: "no_active_subscription",
      message: "You don't have an active subscription to change. Subscribe to a plan first.",
    });
  }
  return live;
}

export async function POST(req: NextRequest) {
  return handle("/api/developers/billing/change-plan", async () => {
    const ctx = await billingContext(req);
    if (!ctx.customerId) {
      throw new BillingError(409, {
        error: "no_active_subscription",
        message: "You don't have an active subscription to change.",
      });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const plan = body.plan as PlanKey | undefined;

    if (!plan || !(plan in PLANS)) {
      throw new BillingError(400, { error: "invalid_plan", message: "Unknown plan." });
    }

    const newPriceId = priceIdForPlan(plan);
    if (!newPriceId) {
      throw new BillingError(500, { error: "plan_not_configured", message: "That plan has no price configured." });
    }

    const sub = await liveSubscription(ctx.customerId);
    const currentPlan = planFromSubscription(sub);
    if (currentPlan === plan) {
      throw new BillingError(409, { error: "same_plan", message: `You're already on ${PLANS[plan].name}.` });
    }

    const item = sub.items.data[0];
    if (!item) {
      throw new BillingError(500, { error: "malformed_subscription", message: "Subscription has no billable item." });
    }

    const downgrade = isDowngrade(currentPlan, plan, PLAN_PRICES);
    const effectiveAt = (() => {
      const pe = periodEnd(sub);
      return pe ? new Date(pe * 1000).toISOString() : null;
    })();

    // ─── preview ────────────────────────────────────────────────────────────
    if (body.preview) {
      // A downgrade has nothing to price. Nothing is charged, nothing is
      // credited, and the current plan runs to the end of the period the
      // customer already paid for — so there is no proration to quote and no
      // quote that can go stale.
      if (downgrade) {
        return NextResponse.json(
          {
            preview: true,
            scheduled: true,
            prorationDate: null,
            fromPlan: currentPlan,
            toPlan: plan,
            currency: sub.items.data[0]?.price?.currency ?? "usd",
            credit: 0,
            charge: 0,
            dueNow: 0,
            creditedToBalance: 0,
            balanceApplied: 0,
            balanceRemaining: 0,
            isUpgrade: false,
            effectiveAt,
            nextRenewal: effectiveAt,
            nextRenewalAmount: PLANS[plan].priceUsd * 100,
            lines: [],
          },
          { headers: NO_STORE }
        );
      }

      const prorationDate = Math.floor(Date.now() / 1000);

      const invoice = await stripe.invoices.createPreview({
        customer: ctx.customerId,
        subscription: sub.id,
        subscription_details: {
          items: [{ id: item.id, price: newPriceId }],
          proration_behavior: "always_invoice",
          proration_date: prorationDate,
        },
      });

      // Only the proration lines belong in the quote. A preview of an upgrade
      // also carries the *next* period's regular charge, and summing every line
      // would quote someone a figure that folds in a renewal they aren't paying
      // today.
      const prorationLines = invoice.lines.data.filter((l) => l.parent?.subscription_item_details?.proration);
      const credit = prorationLines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
      const charge = prorationLines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);

      return NextResponse.json(
        {
          preview: true,
          prorationDate,
          expiresAt: new Date((prorationDate + QUOTE_TTL_SECONDS) * 1000).toISOString(),
          fromPlan: currentPlan,
          toPlan: plan,
          currency: invoice.currency,
          credit,
          charge,
          // Existing account credit (from an earlier downgrade) that Stripe
          // will consume on this invoice. Without this the quote can show
          // proration lines totalling $39.99 next to "Due now $0.00" and give
          // the reader no way to reconcile the two.
          balanceApplied: Math.abs((invoice.starting_balance ?? 0) - (invoice.ending_balance ?? 0)),
          balanceRemaining: Math.abs(invoice.ending_balance ?? 0),
          // What actually gets taken from the card now. Stripe nets the credit
          // against the charge; on a downgrade the result is negative and is
          // held as customer balance against the next invoice rather than
          // refunded, so never present it as money coming back.
          dueNow: Math.max(0, invoice.amount_due),
          creditedToBalance: invoice.amount_due < 0 ? Math.abs(invoice.amount_due) : 0,
          isUpgrade: (PLANS[plan].priceUsd ?? 0) > (currentPlan ? PLANS[currentPlan].priceUsd : 0),
          nextRenewal: (() => {
            const pe = periodEnd(sub);
            return pe ? new Date(pe * 1000).toISOString() : null;
          })(),
          nextRenewalAmount: PLANS[plan].priceUsd * 100,
          lines: prorationLines.map((l) => ({
            description: l.description,
            amount: l.amount,
          })),
        },
        { headers: NO_STORE }
      );
    }

    // ─── apply ──────────────────────────────────────────────────────────────
    if (downgrade) {
      await scheduleAtPeriodEnd(sub, newPriceId);

      // Deliberately not touching api_keys or users.stripe_plan here. The
      // customer stays on their current plan — and their current quota — until
      // the period they paid for actually ends. The phase transition emits
      // customer.subscription.updated, and the webhook derives the plan from
      // the newly billed price, which is what moves the quota then.
      return NextResponse.json(
        {
          ok: true,
          scheduled: true,
          plan: currentPlan,
          planName: currentPlan ? PLANS[currentPlan].name : null,
          scheduledPlan: plan,
          scheduledPlanName: PLANS[plan].name,
          effectiveAt,
        },
        { headers: NO_STORE }
      );
    }

    const prorationDate = body.prorationDate;
    if (!prorationDate || !Number.isFinite(prorationDate)) {
      throw new BillingError(400, {
        error: "missing_proration_date",
        message: "Preview the change before applying it.",
      });
    }

    const age = Math.floor(Date.now() / 1000) - prorationDate;
    if (age < -60 || age > QUOTE_TTL_SECONDS) {
      throw new BillingError(409, {
        error: "quote_expired",
        message: "That price quote has expired. Review the change again.",
      });
    }

    // An upgrade while a downgrade is pending has to clear the schedule first:
    // a scheduled subscription takes its price from the schedule's phases, so
    // updating the subscription underneath one is reverted at the next phase
    // boundary — the customer would pay for the upgrade now and be moved back
    // down at the end of the period.
    //
    // Done *after* every validation above, and never before. Releasing first
    // meant a request that was then rejected for a missing or expired quote
    // still destroyed the customer's pending downgrade on its way out — a
    // failed call with a permanent side effect.
    const activeScheduleId =
      typeof sub.schedule === "string" ? sub.schedule : (sub.schedule?.id ?? null);
    if (activeScheduleId) {
      await stripe.subscriptionSchedules.release(activeScheduleId);
    }

    // Reusing the quote's proration_date is what makes the customer pay exactly
    // the number they were shown. Recomputing it here would silently bill a few
    // seconds' more usage than the quote said.
    //
    // The idempotency key is keyed on the quote, so a double-click or a retry
    // after a dropped response collapses into one plan change and one invoice
    // instead of prorating twice.
    const updated = await stripe.subscriptions.update(
      sub.id,
      {
        items: [{ id: item.id, price: newPriceId }],
        proration_behavior: "always_invoice",
        proration_date: prorationDate,
        // Keep metadata in step with reality. Nothing should read plan from
        // here any more (planFromSubscription reads the billed price instead),
        // but leaving it stale would mislead anyone reading the Stripe
        // dashboard.
        metadata: { ...(sub.metadata ?? {}), userId: ctx.userId, plan },
      },
      { idempotencyKey: `plan-change:${sub.id}:${prorationDate}` }
    );

    // Apply the new quota now rather than waiting for customer.subscription
    // .updated to arrive. The webhook does the same write and is what makes
    // this correct when the change originates outside this route, but a user
    // who upgrades and immediately retries a rate-limited call should not be
    // told to wait on webhook delivery. Both paths write the same values, so
    // whichever lands second is a no-op.
    const applied = planFromSubscription(updated) ?? plan;
    const { monthlyLimit, dailyLimit, perMinuteLimit } = planLimits(applied);

    // monthly_limit has to be in this write, not just the other two. It is the
    // quota the public API actually enforces, so omitting it left an upgraded
    // customer paying Growth's $20 while still being cut off at Starter's
    // 1,000 requests — with the dashboard cheerfully reporting 2,500, because
    // that figure came from the plan rather than from the key.
    //
    // month_count is deliberately untouched: quota already spent this month
    // stays spent across a plan change.
    // One transaction, not two round trips. Stripe has already been charged by
    // this point, so a failure between these two writes left the customer
    // paying for the new plan with the old quota still enforced (or the plan
    // shown correctly while the key kept the old limits) — with no compensating
    // path and nothing to detect it. db.batch commits both or neither.
    await db.batch([
      db.execute(sql`
        UPDATE api_keys
        SET monthly_limit = ${monthlyLimit}, daily_limit = ${dailyLimit}, per_minute_limit = ${perMinuteLimit}
        WHERE user_id = ${ctx.userId} AND is_active = true
      `),
      db.execute(sql`
        UPDATE users SET stripe_plan = ${applied} WHERE id = ${ctx.userId}
      `),
    ]);

    return NextResponse.json(
      {
        ok: true,
        plan: applied,
        planName: PLANS[applied].name,
        monthlyLimit,
        dailyLimit,
        perMinuteLimit,
      },
      { headers: NO_STORE }
    );
  });
}

/**
 * Calls off a scheduled downgrade, leaving the customer on their current plan.
 *
 * `release` detaches the schedule and leaves the subscription exactly as it is
 * — still active, still on the price it is billing today. `cancel` would end
 * the subscription outright, which is emphatically not what "keep my current
 * plan" means.
 */
export async function DELETE(req: NextRequest) {
  return handle("/api/developers/billing/change-plan/cancel-scheduled", async () => {
    const ctx = await billingContext(req);
    if (!ctx.customerId) {
      throw new BillingError(409, { error: "no_active_subscription", message: "You don't have a subscription." });
    }

    const sub = await liveSubscription(ctx.customerId);
    const scheduleId = typeof sub.schedule === "string" ? sub.schedule : (sub.schedule?.id ?? null);
    if (!scheduleId) {
      // Nothing pending. Report success — a stale tab clicking this twice
      // shouldn't produce an error for a state that is already what they want.
      return NextResponse.json({ ok: true, unchanged: true }, { headers: NO_STORE });
    }

    await stripe.subscriptionSchedules.release(scheduleId);
    const plan = planFromSubscription(sub);
    return NextResponse.json(
      { ok: true, plan, planName: plan ? PLANS[plan].name : null },
      { headers: NO_STORE }
    );
  });
}
