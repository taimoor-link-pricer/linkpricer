import { describe, expect, it, vi, afterEach } from "vitest";
import type Stripe from "stripe";
import {
  currentSchedulePhase,
  phaseDurationFromPrice,
  scheduledPlanChange,
  isDowngrade,
  isCardExpired,
  pickGoverningSubscription,
  isRenewing,
  needsPayment,
  effectiveDefaultPm,
  isInvoiceSettled,
  hasUsableAddress,
  toBillingDetails,
} from "@/lib/billing";

// Prices are read from env at call time by design (see priceIdForPlan), so the
// plan-mapping tests set them rather than importing constants.
process.env.STRIPE_PRICE_STARTER = "price_starter";
process.env.STRIPE_PRICE_GROWTH = "price_growth";
process.env.STRIPE_PRICE_SCALE = "price_scale";

const HOUR = 3600;
const NOW = 1_800_000_000;

afterEach(() => vi.useRealTimers());

// ─── currentSchedulePhase ────────────────────────────────────────────────
// Regression: taking phases[length-1] as "current" made a pending downgrade
// impossible to change — Stripe rejects moving the live phase's start date.
describe("currentSchedulePhase", () => {
  it("returns the only phase of a freshly created schedule", () => {
    const phases = [{ start_date: NOW - HOUR, end_date: NOW + HOUR }];
    expect(currentSchedulePhase(phases, NOW)).toBe(phases[0]);
  });

  it("returns the RUNNING phase, not the pending one, when a change is queued", () => {
    const running = { start_date: NOW - HOUR, end_date: NOW + HOUR };
    const pending = { start_date: NOW + HOUR, end_date: NOW + 2 * HOUR };
    expect(currentSchedulePhase([running, pending], NOW)).toBe(running);
  });

  it("treats a final open-ended phase as current once it has started", () => {
    const past = { start_date: NOW - 2 * HOUR, end_date: NOW - HOUR };
    const openEnded = { start_date: NOW - HOUR, end_date: null };
    expect(currentSchedulePhase([past, openEnded], NOW)).toBe(openEnded);
  });

  it("falls back to the first phase when nothing brackets now", () => {
    const future = { start_date: NOW + HOUR, end_date: NOW + 2 * HOUR };
    expect(currentSchedulePhase([future], NOW)).toBe(future);
  });

  it("returns undefined for an empty schedule rather than throwing", () => {
    expect(currentSchedulePhase([], NOW)).toBeUndefined();
  });
});

// ─── phaseDurationFromPrice ──────────────────────────────────────────────
// Regression: a hardcoded month silently mis-schedules any non-monthly plan.
describe("phaseDurationFromPrice", () => {
  it("uses the price's own interval", () => {
    const yearly = { recurring: { interval: "year", interval_count: 1 } } as Stripe.Price;
    expect(phaseDurationFromPrice(yearly)).toEqual({ interval: "year", interval_count: 1 });
  });

  it("carries a multi-interval count through", () => {
    const quarterly = { recurring: { interval: "month", interval_count: 3 } } as Stripe.Price;
    expect(phaseDurationFromPrice(quarterly)).toEqual({ interval: "month", interval_count: 3 });
  });

  it("defaults to one month when the price has no recurring block", () => {
    expect(phaseDurationFromPrice(null)).toEqual({ interval: "month", interval_count: 1 });
  });
});

// ─── scheduledPlanChange ─────────────────────────────────────────────────
function subWithSchedule(currentPrice: string, schedule: unknown): Stripe.Subscription {
  return {
    items: { data: [{ price: { id: currentPrice } }] },
    schedule,
  } as unknown as Stripe.Subscription;
}
const planName = (p: string) => p.toUpperCase();

describe("scheduledPlanChange", () => {
  it("reports a pending downgrade with its effective date", () => {
    vi.useFakeTimers().setSystemTime(NOW * 1000);
    const sub = subWithSchedule("price_growth", {
      status: "active",
      phases: [
        { start_date: NOW - HOUR, end_date: NOW + HOUR, items: [{ price: "price_growth" }] },
        { start_date: NOW + HOUR, items: [{ price: "price_starter" }] },
      ],
    });
    expect(scheduledPlanChange(sub, planName as never)).toEqual({
      plan: "starter",
      planName: "STARTER",
      effectiveAt: new Date((NOW + HOUR) * 1000).toISOString(),
    });
  });

  it("is null when the upcoming phase bills the same price — that is not a change", () => {
    vi.useFakeTimers().setSystemTime(NOW * 1000);
    const sub = subWithSchedule("price_growth", {
      status: "active",
      phases: [
        { start_date: NOW - HOUR, end_date: NOW + HOUR, items: [{ price: "price_growth" }] },
        { start_date: NOW + HOUR, items: [{ price: "price_growth" }] },
      ],
    });
    expect(scheduledPlanChange(sub, planName as never)).toBeNull();
  });

  it("is null when the schedule was not expanded (just an id string)", () => {
    expect(scheduledPlanChange(subWithSchedule("price_growth", "sub_sched_123"), planName as never)).toBeNull();
  });

  it("is null for a released or completed schedule", () => {
    vi.useFakeTimers().setSystemTime(NOW * 1000);
    const sub = subWithSchedule("price_growth", {
      status: "released",
      phases: [{ start_date: NOW + HOUR, items: [{ price: "price_starter" }] }],
    });
    expect(scheduledPlanChange(sub, planName as never)).toBeNull();
  });

  it("is null when there is no schedule at all", () => {
    expect(scheduledPlanChange(subWithSchedule("price_growth", null), planName as never)).toBeNull();
  });
});

// ─── isDowngrade ─────────────────────────────────────────────────────────
describe("isDowngrade", () => {
  const prices = { starter: 10, growth: 20, scale: 50 } as never;
  it("classifies a cheaper plan as a downgrade", () => {
    expect(isDowngrade("scale" as never, "growth" as never, prices)).toBe(true);
  });
  it("classifies a dearer plan as not a downgrade", () => {
    expect(isDowngrade("starter" as never, "scale" as never, prices)).toBe(false);
  });
  it("treats a first subscription (no current plan) as not a downgrade", () => {
    expect(isDowngrade(null, "starter" as never, prices)).toBe(false);
  });
});

// ─── isCardExpired ───────────────────────────────────────────────────────
describe("isCardExpired", () => {
  const card = (exp_month: number, exp_year: number) =>
    ({ card: { exp_month, exp_year } }) as Stripe.PaymentMethod;

  it("is still valid through the whole of its expiry month", () => {
    expect(isCardExpired(card(6, 2026), new Date("2026-06-30T23:00:00Z"))).toBe(false);
  });
  it("is expired the month after", () => {
    expect(isCardExpired(card(6, 2026), new Date("2026-07-01T00:00:00Z"))).toBe(true);
  });
  it("is expired for an earlier year", () => {
    expect(isCardExpired(card(12, 2025), new Date("2026-01-01T00:00:00Z"))).toBe(true);
  });
  it("does not call a card with no expiry data expired", () => {
    expect(isCardExpired({ card: undefined } as Stripe.PaymentMethod, new Date())).toBe(false);
  });
});

// ─── subscription selection ──────────────────────────────────────────────
const sub = (status: string, extra: Record<string, unknown> = {}) =>
  ({ status, cancel_at_period_end: false, ...extra }) as unknown as Stripe.Subscription;

describe("pickGoverningSubscription", () => {
  it("prefers an entitling subscription over a broken one", () => {
    const active = sub("active");
    expect(pickGoverningSubscription([sub("canceled"), sub("past_due"), active])).toBe(active);
  });
  it("falls back to a troubled subscription so it can still be displayed", () => {
    const pastDue = sub("past_due");
    expect(pickGoverningSubscription([sub("canceled"), pastDue])).toBe(pastDue);
  });
  it("ignores canceled subscriptions entirely", () => {
    expect(pickGoverningSubscription([sub("canceled"), sub("incomplete_expired")])).toBeNull();
  });
});

describe("isRenewing / needsPayment", () => {
  it("counts an active subscription as renewing", () => {
    expect(isRenewing(sub("active"))).toBe(true);
  });
  it("does not count one already set to cancel — its last card can be removed", () => {
    expect(isRenewing(sub("active", { cancel_at_period_end: true }))).toBe(false);
  });
  it("still counts past_due as renewing, because it will retry", () => {
    expect(isRenewing(sub("past_due"))).toBe(true);
  });
  it("flags only past_due/unpaid as needing payment", () => {
    expect(needsPayment(sub("past_due"))).toBe(true);
    expect(needsPayment(sub("unpaid"))).toBe(true);
    expect(needsPayment(sub("active"))).toBe(false);
    expect(needsPayment(null)).toBe(false);
  });
});

// ─── effectiveDefaultPm ──────────────────────────────────────────────────
describe("effectiveDefaultPm", () => {
  const customer = (pm: unknown) =>
    ({ deleted: undefined, invoice_settings: { default_payment_method: pm } }) as unknown as Stripe.Customer;

  it("prefers the subscription's own default over the customer's", () => {
    expect(effectiveDefaultPm(customer("pm_customer"), sub("active", { default_payment_method: "pm_sub" })))
      .toBe("pm_sub");
  });
  it("falls back to the customer default when the subscription has none", () => {
    expect(effectiveDefaultPm(customer("pm_customer"), sub("active"))).toBe("pm_customer");
  });
  it("unwraps an expanded payment method object", () => {
    expect(effectiveDefaultPm(customer({ id: "pm_expanded" }), null)).toBe("pm_expanded");
  });
  it("returns null for a deleted customer instead of throwing", () => {
    expect(effectiveDefaultPm({ deleted: true } as Stripe.DeletedCustomer, null)).toBeNull();
  });
});

// ─── invoices & address ──────────────────────────────────────────────────
describe("isInvoiceSettled", () => {
  it("treats paid, void and uncollectible as settled", () => {
    expect(["paid", "void", "uncollectible"].every(isInvoiceSettled)).toBe(true);
  });
  it("treats open and draft as unsettled, so the Amount column shows what is owed", () => {
    expect(isInvoiceSettled("open")).toBe(false);
    expect(isInvoiceSettled("draft")).toBe(false);
    expect(isInvoiceSettled(null)).toBe(false);
  });
});

describe("billing details", () => {
  it("needs a street line and a country to be a usable invoice address", () => {
    expect(hasUsableAddress({ name: "X", address: { line1: "A St", country: "LT" } as never })).toBe(true);
    expect(hasUsableAddress({ name: "X", address: { line1: "A St", country: null } as never })).toBe(false);
    expect(hasUsableAddress({ name: "X", address: null })).toBe(false);
  });
  it("reads name and address off the customer, not the card", () => {
    const c = {
      deleted: undefined,
      name: "Linkpricer UAB",
      address: { line1: "Test St 1", line2: null, city: "Vilnius", state: null, postal_code: "LT-01108", country: "LT" },
    } as unknown as Stripe.Customer;
    expect(toBillingDetails(c)).toEqual({
      name: "Linkpricer UAB",
      address: { line1: "Test St 1", line2: null, city: "Vilnius", state: null, postalCode: "LT-01108", country: "LT" },
    });
  });
  it("returns empty details for a deleted customer", () => {
    expect(toBillingDetails({ deleted: true } as Stripe.DeletedCustomer)).toEqual({ name: null, address: null });
  });
});

// Regression: exp_month/exp_year are timezone-less, so comparing them against
// LOCAL time made a card's expiry depend on the server's timezone.
describe("isCardExpired is timezone-independent", () => {
  const card = { card: { exp_month: 6, exp_year: 2026 } } as Stripe.PaymentMethod;
  const original = process.env.TZ;
  afterEach(() => { process.env.TZ = original; });

  it("holds a June card valid at the last UTC instant of June, east of Greenwich", () => {
    process.env.TZ = "Pacific/Kiritimati"; // UTC+14, the worst case
    expect(isCardExpired(card, new Date("2026-06-30T23:59:59Z"))).toBe(false);
  });

  it("holds the same card valid west of Greenwich too", () => {
    process.env.TZ = "Pacific/Midway"; // UTC-11
    expect(isCardExpired(card, new Date("2026-06-30T23:59:59Z"))).toBe(false);
  });

  it("expires it at the first UTC instant of July regardless of timezone", () => {
    process.env.TZ = "Pacific/Midway";
    expect(isCardExpired(card, new Date("2026-07-01T00:00:00Z"))).toBe(true);
  });
});
