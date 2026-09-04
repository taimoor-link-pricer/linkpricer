export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { periodEnd } from "@/lib/billing";
import type Stripe from "stripe";
import { BillingError, billingContext, handle, NO_STORE } from "@/lib/billing-session";

/**
 * Schedules or reverses a cancellation.
 *
 * Cancellation is always at period end, never immediate: the customer has paid
 * through the current period, so revoking the API key the moment they click
 * would take away access they already own. Stripe keeps the subscription
 * `active` until the period rolls over and then emits
 * customer.subscription.deleted, which is where the key actually gets
 * deactivated — so nothing here touches api_keys.
 *
 * POST   { resume?: boolean }  — schedule cancellation, or call off a scheduled one.
 */
export async function POST(req: NextRequest) {
  return handle("/api/developers/billing/cancel", async () => {
    const ctx = await billingContext(req);
    if (!ctx.customerId) {
      throw new BillingError(409, { error: "no_active_subscription", message: "You don't have a subscription." });
    }

    const body = (await req.json().catch(() => ({}))) as { resume?: boolean };
    const resume = body.resume === true;

    const subs = await stripe.subscriptions.list({
      customer: ctx.customerId,
      status: "all",
      limit: 10,
      // Needed to tell whether a subscription schedule governs this
      // subscription — see the release below. Unexpanded, `schedule` is just
      // an id string and its status is unknown.
      expand: ["data.schedule"],
    });
    const live = subs.data.find((s) => s.status === "active" || s.status === "trialing");

    if (!live) {
      throw new BillingError(409, {
        error: "no_active_subscription",
        message: "You don't have an active subscription.",
      });
    }

    if (live.cancel_at_period_end === !resume) {
      // Already in the requested state. Report success rather than an error so
      // a double-click or a stale tab doesn't surface a scary failure for a
      // no-op.
      const pe = periodEnd(live);
      return NextResponse.json(
        {
          ok: true,
          unchanged: true,
          cancelAtPeriodEnd: live.cancel_at_period_end,
          accessUntil: pe ? new Date(pe * 1000).toISOString() : null,
        },
        { headers: NO_STORE }
      );
    }

    // A customer who has scheduled a downgrade cannot be cancelled directly:
    // Stripe owns the subscription through a subscription schedule and rejects
    // `cancel_at_period_end` outright with "the subscription is managed by the
    // subscription schedule sub_sched_… Please update the schedule instead."
    // That error was reaching the customer verbatim, internal id and all, and
    // left them with no way to cancel at all — they had to guess that undoing
    // the downgrade first would unblock it.
    //
    // Releasing the schedule hands the subscription back to normal management
    // without changing what the customer is on right now; the pending
    // downgrade goes with it, which is the right outcome for someone who is
    // cancelling the whole thing. Only done on the cancel path — resuming
    // needs no such thing.
    let releasedSchedule = false;
    if (!resume && live.schedule && typeof live.schedule !== "string") {
      const status = live.schedule.status;
      if (status === "active" || status === "not_started") {
        await stripe.subscriptionSchedules.release(live.schedule.id);
        releasedSchedule = true;
      }
    }

    let updated: Stripe.Subscription;
    try {
      updated = await stripe.subscriptions.update(live.id, { cancel_at_period_end: !resume });
    } catch (err) {
      // The release above is not reversible from here, so a failure at this
      // point leaves the customer in a state they did not ask for: their
      // pending plan change is gone AND the cancellation did not happen. Say
      // so explicitly rather than surfacing a bare Stripe error that leaves
      // them thinking nothing changed.
      if (releasedSchedule) {
        console.error("[/api/developers/billing/cancel] update failed after schedule release", err);
        throw new BillingError(500, {
          error: "cancel_incomplete",
          message:
            "Your scheduled plan change was cancelled, but we could not finish cancelling your subscription. Your plan is unchanged and still renewing — please try cancelling again.",
        });
      }
      throw err;
    }
    const pe = periodEnd(updated);

    return NextResponse.json(
      {
        ok: true,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        // Until this date the key keeps working — the UI states it plainly so
        // nobody cancels expecting billing to stop and access to continue, or
        // the reverse.
        accessUntil: pe ? new Date(pe * 1000).toISOString() : null,
      },
      { headers: NO_STORE }
    );
  });
}
