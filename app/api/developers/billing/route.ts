export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, PLANS, type PlanKey } from "@/lib/stripe";
import {
  effectiveDefaultPm,
  isCardExpired,
  isRenewing,
  periodEnd,
  pickGoverningSubscription,
  planFromSubscription,
  scheduledPlanChange,
  toBillingDetails,
  toInvoiceDto,
} from "@/lib/billing";
import { billingContext, handle, NO_STORE } from "@/lib/billing-session";

export interface CardDto {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  /** Already past its expiry month — Stripe will decline it on the next renewal. */
  isExpired: boolean;
  /** False when detaching this card would strand a subscription that still renews. */
  removable: boolean;
  /** Why it can't be removed, in the customer's words. Null when it can. */
  removeBlockedReason: string | null;
}

/**
 * The message shown where the Remove button is, so the rule is visible before
 * anyone clicks rather than discovered by being refused. Deliberately derived
 * from the same `isRenewing` predicate the DELETE handler enforces — if the two
 * ever disagreed, the UI would offer an action the API refuses.
 */
const LAST_CARD_REASON =
  "This is your only card and your subscription is still renewing. Add another card to remove this one.";

export interface SubscriptionDto {
  id: string;
  plan: PlanKey | null;
  planName: string | null;
  status: Stripe.Subscription.Status;
  amount: number | null;
  currency: string;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  defaultPaymentMethodId: string | null;
  /** A downgrade waiting for this period to end, if one is pending. */
  scheduledChange: { plan: PlanKey | null; planName: string | null; effectiveAt: string | null } | null;
}

function toCard(pm: Stripe.PaymentMethod, defaultId: string | null, blocked: boolean): CardDto {
  const c = pm.card;
  return {
    id: pm.id,
    brand: c?.brand ?? "card",
    last4: c?.last4 ?? "••••",
    expMonth: c?.exp_month ?? 0,
    expYear: c?.exp_year ?? 0,
    isDefault: pm.id === defaultId,
    isExpired: isCardExpired(pm),
    removable: !blocked,
    removeBlockedReason: blocked ? LAST_CARD_REASON : null,
  };
}

/**
 * Everything the billing page renders, read live from Stripe.
 *
 * Stripe is the source of truth here rather than our own mirrored columns:
 * card state, proration, and cancel-at-period-end all change through paths we
 * don't control (the customer portal, a failed renewal, a dunning retry), and
 * a mirror that drifts shows someone the wrong card or the wrong renewal date.
 * Only the API key's on/off state is mirrored locally, because the hot path
 * that checks it runs on every API request and can't call Stripe.
 */
export async function GET(req: NextRequest) {
  return handle("/api/developers/billing", async () => {
    const ctx = await billingContext(req);

    if (!ctx.customerId) {
      return NextResponse.json(
        {
          customerId: null,
          subscription: null,
          cards: [],
          invoices: [],
          invoicesHasMore: false,
          billingDetails: { name: null, address: null },
        },
        { headers: NO_STORE }
      );
    }

    const [customer, subs, pms, invoices] = await Promise.all([
      stripe.customers.retrieve(ctx.customerId),
      // schedule expanded so a pending downgrade can be read off its phases
      // without a second round trip.
      stripe.subscriptions.list({
        customer: ctx.customerId,
        status: "all",
        limit: 10,
        expand: ["data.schedule"],
      }),
      stripe.paymentMethods.list({ customer: ctx.customerId, type: "card", limit: 20 }),
      // Kept in step with PAGE_SIZE in ./invoices — the cursor handed to that
      // route is the last id on this page, so a mismatch would skip or repeat
      // invoices at the seam.
      stripe.invoices.list({ customer: ctx.customerId, limit: 12 }),
    ]);

    const live = pickGoverningSubscription(subs.data);

    // Shared with the card-adoption path on purpose: if this disagreed with
    // what that decides, the "Default" badge would point at a different card
    // than the one Stripe actually charges.
    const effectiveDefault = effectiveDefaultPm(customer, live);

    // Mirrors the DELETE guard exactly: the last card is locked only while a
    // subscription is still going to charge it.
    const lastCardLocked = isRenewing(live) && pms.data.length <= 1;

    const plan = live ? planFromSubscription(live) : null;
    const item = live?.items?.data?.[0];
    const price = item?.price;

    const subscription: SubscriptionDto | null = live
      ? {
          id: live.id,
          plan,
          planName: plan ? PLANS[plan].name : null,
          status: live.status,
          amount: price?.unit_amount ?? null,
          currency: price?.currency ?? "usd",
          interval: price?.recurring?.interval ?? null,
          currentPeriodEnd: (() => {
            const pe = periodEnd(live);
            return pe ? new Date(pe * 1000).toISOString() : null;
          })(),
          cancelAtPeriodEnd: live.cancel_at_period_end,
          defaultPaymentMethodId: effectiveDefault,
          scheduledChange: scheduledPlanChange(live, (p) => PLANS[p].name),
        }
      : null;

    return NextResponse.json(
      {
        customerId: ctx.customerId,
        subscription,
        cards: pms.data.map((pm) => toCard(pm, effectiveDefault, lastCardLocked)),
        billingDetails: toBillingDetails(customer),
        invoices: invoices.data.map(toInvoiceDto),
        invoicesHasMore: invoices.has_more,
      },
      { headers: NO_STORE }
    );
  });
}
