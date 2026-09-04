import type Stripe from "stripe";
import { PLANS, type PlanKey } from "@/lib/stripe";

// ─── plan ↔ price id ───────────────────────────────────────────────────────
//
// Every lookup here reads process.env at call time rather than closing over a
// value captured at module load. `PLANS[x].priceId` is populated at import
// time, which in a bundled build means the value is inlined at *build* time —
// see the same note in /api/developers/subscribe. Reading it live keeps a price
// rotation from silently requiring a redeploy.

export function priceIdForPlan(plan: PlanKey): string {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] ?? "";
}

/**
 * Reverse of priceIdForPlan. This is the *only* correct way to learn what plan
 * a subscription is on once self-service plan switching exists.
 *
 * The webhook used to read `sub.metadata.plan`, which is stamped once when the
 * subscription is created and never updated by a plan change — so after a
 * switch it would keep reporting the original plan while Stripe billed the new
 * price, resetting the customer's quota to whatever they first signed up for.
 * The subscription item's price id is the actual billed thing, so it can't
 * drift from what the customer is paying.
 */
export function planFromPriceId(priceId: string | null | undefined): PlanKey | null {
  if (!priceId) return null;
  for (const plan of Object.keys(PLANS) as PlanKey[]) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  return null;
}

/** The plan a live subscription is actually on, read off its billed price. */
export function planFromSubscription(sub: Stripe.Subscription): PlanKey | null {
  const item = sub.items?.data?.[0];
  const priceId = typeof item?.price === "string" ? item.price : item?.price?.id;
  return planFromPriceId(priceId);
}

// ─── quota ─────────────────────────────────────────────────────────────────

/**
 * The limits actually written onto a key.
 *
 * `monthlyLimit` is what the public API enforces and what /developers/docs has
 * always advertised. `dailyLimit` is retained only because the column exists
 * and older keys were provisioned from it (it is the fallback the API reads
 * when monthly_limit is NULL) — nothing enforces a daily cap any more.
 *
 * Enforcing ceil(monthlyQuota / 30) as a *daily* limit, which is what this
 * used to return, meant a Starter customer who paid for 1,000 requests a
 * month was cut off at 34 in a day: any backfill, nightly batch or first-run
 * import hit the wall immediately and no amount of waiting let them spend
 * what they had bought.
 */
export function planLimits(plan: PlanKey) {
  const p = PLANS[plan];
  return {
    monthlyLimit: p.monthlyQuota,
    dailyLimit: Math.ceil(p.monthlyQuota / 30),
    perMinuteLimit: p.perMinuteLimit,
  };
}

// ─── period ────────────────────────────────────────────────────────────────

/**
 * Billing period end, in unix seconds.
 *
 * On API version 2026-06-24.dahlia `current_period_end` no longer exists on the
 * Subscription object — it moved onto each subscription item. Reading
 * `sub.current_period_end` compiles fine and returns undefined at runtime,
 * which is exactly the kind of thing that ships silently, so this is the one
 * place that knows where the field lives.
 */
export function periodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  return item?.current_period_end ?? null;
}

/** A subscription still entitles the caller to API access. */
export function isEntitled(sub: Stripe.Subscription): boolean {
  return sub.status === "active" || sub.status === "trialing";
}

// ─── money ─────────────────────────────────────────────────────────────────

/** Stripe amounts are in the currency's minor unit. Never round with floats. */
export function formatAmount(minorUnits: number | null | undefined, currency = "usd"): string {
  const n = minorUnits ?? 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(Math.abs(n) / 100)}`;
}

// ─── subscriptions ─────────────────────────────────────────────────────────

/**
 * The subscription that actually governs this customer's access.
 *
 * `subscriptions.list({ status: "all" })` includes canceled ones, and anybody
 * who has cancelled and resubscribed has several — taking `data[0]` shows a
 * stale canceled subscription. Prefer one that entitles access, then fall back
 * to one that is merely in trouble (which still needs to be displayed, and is
 * still the subscription a new default card should be attached to).
 */
export function pickGoverningSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  return (
    subs.find((s) => s.status === "active" || s.status === "trialing") ??
    subs.find((s) => s.status === "past_due" || s.status === "unpaid" || s.status === "incomplete") ??
    null
  );
}

/**
 * This subscription will try to charge a card again — i.e. removing the last
 * card would strand it.
 *
 * `unpaid` belongs in this list. needsPayment() already treats it as
 * recoverable and the UI offers to retry the payment, but isRenewing() left it
 * out — so the guard that stops you detaching your only card considered an
 * `unpaid` subscription abandoned, let the card go, and then offered a retry
 * with nothing to charge.
 */
export function isRenewing(sub: Stripe.Subscription | null): boolean {
  if (!sub || sub.cancel_at_period_end) return false;
  return (
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due" ||
    sub.status === "unpaid"
  );
}

/** This subscription is stalled on a payment we could retry. */
export function needsPayment(sub: Stripe.Subscription | null): boolean {
  if (!sub) return false;
  return sub.status === "past_due" || sub.status === "unpaid";
}

// ─── payment methods ───────────────────────────────────────────────────────

/** Unwraps Stripe's `string | object | null` expandable payment method fields. */
export function pmId(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * The payment method Stripe will actually charge.
 *
 * A subscription's own default wins where set; Stripe falls back to the
 * customer-level default only when the subscription has none of its own.
 */
export function effectiveDefaultPm(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  sub: Stripe.Subscription | null
): string | null {
  const subDefault = pmId(sub?.default_payment_method);
  if (subDefault) return subDefault;
  // A deleted customer still resolves, just with `deleted: true` and none of
  // the normal fields — reading invoice_settings off it would throw.
  if (customer.deleted === true) return null;
  return pmId(customer.invoice_settings?.default_payment_method);
}

/**
 * A card is dead only once we are past its expiry *month* — it stays valid
 * through the last day of that month, so comparing against the 1st would flag
 * a perfectly good card as expired for the whole of its final valid month.
 */
export function isCardExpired(pm: Stripe.PaymentMethod, now = new Date()): boolean {
  const year = pm.card?.exp_year ?? 0;
  const month = pm.card?.exp_month ?? 0;
  if (year <= 0) return false;
  // UTC, deliberately. exp_month/exp_year carry no timezone, so comparing them
  // against local time makes the answer depend on where the server happens to
  // run — a June card reads as expired on June 30th at 23:00 UTC for anything
  // east of Greenwich, marking a working card dead a day early.
  return (
    year < now.getUTCFullYear() || (year === now.getUTCFullYear() && month < now.getUTCMonth() + 1)
  );
}

// ─── invoices ──────────────────────────────────────────────────────────────

export interface InvoiceDto {
  id: string;
  number: string | null;
  created: string;
  /** What was actually collected. Zero on an invoice that hasn't been paid. */
  amountPaid: number;
  /** What is owed. This is the figure to show for anything not yet paid. */
  amountDue: number;
  currency: string;
  status: string | null;
  /** Stripe-hosted page where an open invoice can be paid. */
  hostedUrl: string | null;
  pdfUrl: string | null;
}

/** True once Stripe considers the invoice settled — nothing more to collect. */
export function isInvoiceSettled(status: string | null | undefined): boolean {
  return status === "paid" || status === "void" || status === "uncollectible";
}

export function toInvoiceDto(inv: Stripe.Invoice): InvoiceDto {
  return {
    id: inv.id ?? "",
    number: inv.number,
    created: new Date(inv.created * 1000).toISOString(),
    amountPaid: inv.amount_paid,
    amountDue: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    hostedUrl: inv.hosted_invoice_url ?? null,
    pdfUrl: inv.invoice_pdf ?? null,
  };
}

// ─── billing details ───────────────────────────────────────────────────────

export interface BillingDetailsDto {
  name: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}

/**
 * The name and address Stripe prints on the invoice PDF.
 *
 * These come off the Customer, not off the card: a payment method's
 * billing_details are what the issuer checks, and Stripe never copies them
 * onto the invoice. An invoice with no customer address is not a valid VAT
 * invoice, which is why this is collected and editable rather than incidental.
 */
export function toBillingDetails(customer: Stripe.Customer | Stripe.DeletedCustomer): BillingDetailsDto {
  if (customer.deleted === true) return { name: null, address: null };
  const a = customer.address;
  return {
    name: customer.name ?? null,
    address: a
      ? {
          line1: a.line1 ?? null,
          line2: a.line2 ?? null,
          city: a.city ?? null,
          state: a.state ?? null,
          postalCode: a.postal_code ?? null,
          country: a.country ?? null,
        }
      : null,
  };
}

/** An address Stripe will accept and that reads as a real address on a PDF. */
export function hasUsableAddress(details: BillingDetailsDto): boolean {
  return Boolean(details.address?.line1 && details.address.country);
}

// ─── scheduled plan changes ────────────────────────────────────────────────

export interface ScheduledChangeDto {
  plan: PlanKey | null;
  planName: string | null;
  /** ISO date the new plan takes over — the end of the period already paid for. */
  effectiveAt: string | null;
}

/**
 * A downgrade waiting for the current period to run out.
 *
 * Downgrades don't take effect immediately: the customer has already paid for
 * this period at the higher tier, so dropping their quota the moment they click
 * would take away access they own. Stripe models that as a subscription
 * schedule whose second phase starts when the current one ends — this reads
 * that phase back out.
 *
 * Requires the subscription to have been fetched with `expand: ["schedule"]`
 * (or `data.schedule` on a list); an unexpanded schedule is just an id string
 * and there are no phases to read.
 */
export function scheduledPlanChange(
  sub: Stripe.Subscription | null,
  planName: (p: PlanKey) => string
): ScheduledChangeDto | null {
  const schedule = sub?.schedule;
  if (!schedule || typeof schedule === "string") return null;
  if (schedule.status !== "active" && schedule.status !== "not_started") return null;

  const currentPriceId = (() => {
    const item = sub?.items?.data?.[0];
    return typeof item?.price === "string" ? item.price : item?.price?.id;
  })();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const upcoming = schedule.phases.find((p) => p.start_date > nowSeconds);
  if (!upcoming) return null;

  const priceId = (() => {
    const first = upcoming.items?.[0]?.price;
    return typeof first === "string" ? first : (first?.id ?? null);
  })();

  // A phase that bills the same price isn't a pending change — it's just how
  // the schedule represents continuing as-is, and surfacing it would tell the
  // customer their plan is about to change when nothing is going to happen.
  if (!priceId || priceId === currentPriceId) return null;

  const plan = planFromPriceId(priceId);
  return {
    plan,
    planName: plan ? planName(plan) : null,
    effectiveAt: new Date(upcoming.start_date * 1000).toISOString(),
  };
}

/** Ranks plans by price so "is this a downgrade" is asked in exactly one place. */
export function isDowngrade(from: PlanKey | null, to: PlanKey, prices: Record<PlanKey, number>): boolean {
  if (!from) return false;
  return prices[to] < prices[from];
}

// ─── schedule phases ───────────────────────────────────────────────────────

/**
 * The phase a schedule is running *right now*.
 *
 * Not `phases[length - 1]`. On a schedule that already carries a pending
 * downgrade the last phase is that pending change, and treating it as current
 * makes the next edit try to move the live phase's start date — which Stripe
 * rejects outright, leaving the customer unable to change their mind about a
 * downgrade they already scheduled.
 */
export function currentSchedulePhase<T extends { start_date: number; end_date?: number | null }>(
  phases: T[],
  nowSeconds: number
): T | undefined {
  return (
    phases.find((p) => p.start_date <= nowSeconds && (!p.end_date || p.end_date > nowSeconds)) ?? phases[0]
  );
}

/**
 * How long one billing cycle of this price lasts, as a schedule phase duration.
 *
 * Read off the price rather than assumed: hardcoding a month silently
 * mis-schedules the first annual plan anyone adds.
 */
export function phaseDurationFromPrice(price: Stripe.Price | null | undefined): {
  interval: "day" | "week" | "month" | "year";
  interval_count: number;
} {
  const recurring = price?.recurring;
  return {
    interval: (recurring?.interval ?? "month") as "day" | "week" | "month" | "year",
    interval_count: recurring?.interval_count ?? 1,
  };
}
