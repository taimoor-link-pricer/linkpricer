import { describe, it, expect } from "vitest";
import {
  FALLBACK_EUR_USD,
  FALLBACK_EUR_USD_DISPLAY,
  FEE_PERCENT,
  MIN_FEE_EUR,
  managedFeeCents,
  minFeeCents,
  withFeeUsd,
} from "./fee";

// The admin-configured rate in currency_rates as of 2026-09-18.
const RATES = { USD: 1, EUR: 1.14, GBP: 1.34 };
const FLOOR = minFeeCents(RATES);

describe("the €25 minimum fee", () => {
  it("is charged instead of the percentage on a small order", () => {
    // The order that prompted this rule: a $5 placement, no content written
    // by us, managed. It billed $5.75 total — a 75-cent fee — on 2026-09-15.
    const subtotalCents = 500;
    expect(managedFeeCents(subtotalCents, FLOOR)).toBe(FLOOR);
    expect(subtotalCents + managedFeeCents(subtotalCents, FLOOR)).toBeGreaterThan(3300);
    // Never again the old number.
    expect(managedFeeCents(subtotalCents, FLOOR)).not.toBe(75);
  });

  it("leaves a normal order on the percentage, unchanged", () => {
    // €25 is only a floor. Above the crossover the fee is what it always was,
    // so this change must be invisible on the orders that make up most of the
    // book.
    for (const subtotal of [20000, 25300, 50000, 128000]) {
      expect(managedFeeCents(subtotal, FLOOR)).toBe(Math.round(subtotal * 0.15));
    }
  });

  it("is never the smaller of the two — the percentage keeps growing past it", () => {
    // Karolis's framing: the fee is €30, €40 or more on a real order, and €25
    // only when the order is smaller than that.
    const big = managedFeeCents(100000, FLOOR);
    expect(big).toBe(15000);
    expect(big).toBeGreaterThan(FLOOR);
  });

  it("crosses over exactly where 15% meets the minimum", () => {
    const crossover = Math.round(FLOOR / (FEE_PERCENT / 100));
    expect(managedFeeCents(crossover, FLOOR)).toBe(FLOOR);
    expect(managedFeeCents(crossover + 100, FLOOR)).toBe(Math.round((crossover + 100) * 0.15));
    // At today's rate that is a $190 placement.
    expect(crossover / 100).toBeCloseTo(190, 0);
  });

  it("applies per order, not per cart", () => {
    // Each cart line becomes its own row in `orders` and is handled, chased
    // and published separately, so three cheap placements carry three
    // minimums. This is the assumption checkout's cartCentsTotals mirrors; if
    // the business ever wants one minimum per cart, this is the test that
    // should fail first.
    const threeCheapLines = [500, 500, 500].reduce((sum, c) => sum + managedFeeCents(c, FLOOR), 0);
    expect(threeCheapLines).toBe(FLOOR * 3);
  });
});

describe("converting the minimum out of EUR", () => {
  it("uses the admin EUR rate, so €25 stays €25 as the rate moves", () => {
    expect(minFeeCents({ EUR: 1.14 })).toBe(2850);
    expect(minFeeCents({ EUR: 1.2 })).toBe(3000);
    expect(minFeeCents({ EUR: 1.05 })).toBe(2625);
  });

  it("falls back rather than throwing when the rate is unusable", () => {
    // This sits on the order-placement path. Refusing to price an order
    // because currency_rates is unreachable would be a worse failure than
    // pricing it off a slightly stale rate.
    const fallback = Math.round(MIN_FEE_EUR * FALLBACK_EUR_USD * 100);
    const unusable: Array<Record<string, number> | null | undefined> = [
      null, undefined, {}, { EUR: 0 }, { EUR: -1 }, { EUR: NaN },
    ];
    for (const rates of unusable) {
      expect(minFeeCents(rates)).toBe(fallback);
    }
  });

  it("fails low on the server, so a rate outage never overcharges", () => {
    expect(minFeeCents(null)).toBeLessThan(minFeeCents(RATES));
  });

  it("fails high for a displayed price, so a quote is never under the charge", () => {
    // The asymmetry that keeps client and server honest during a rates
    // outage: what we SHOW may come out a little above what we then charge,
    // never below it. lib/design-v1/format.ts seeds FEE_FLOOR with this.
    const displayFallback = minFeeCents({ EUR: FALLBACK_EUR_USD_DISPLAY });
    const serverFallback = minFeeCents(null);
    expect(displayFallback).toBeGreaterThan(serverFallback);
    expect(displayFallback).toBeGreaterThan(minFeeCents(RATES));
    // A displayed price built on it is never cheaper than the real charge.
    for (const p of [1, 5, 50, 150]) {
      expect(withFeeUsd(p, displayFallback)).toBeGreaterThanOrEqual(withFeeUsd(p, minFeeCents(RATES)));
    }
  });

  it("is the same figure whatever currency the marketplace quoted", () => {
    // Every price reaching the fee has already been converted to USD (see
    // resolveOffer / aggregatePricing), so the floor is one USD number and a
    // GBP-quoted offer gets exactly the same fee as a USD-quoted one at the
    // same converted price. A £100 offer is $134 and prices identically to a
    // $134 offer.
    const gbpOfferUsd = 100 * RATES.GBP;
    expect(withFeeUsd(gbpOfferUsd, FLOOR)).toBe(withFeeUsd(134, FLOOR));
    // And a cheap SEK offer (SEK 50 ≈ $4.75) lands on the minimum like any
    // other cheap placement rather than on a fraction of a dollar.
    expect(withFeeUsd(4.75, FLOOR) - 4.75).toBeGreaterThan(25);
  });
});

describe("withFeeUsd", () => {
  it("is the price plus the fee, in whole dollars", () => {
    expect(withFeeUsd(500, FLOOR)).toBe(575);
    expect(withFeeUsd(20, FLOOR)).toBe(Math.round(20 + 28.5));
  });

  it("never prices below the source price", () => {
    for (const p of [0.01, 0.5, 1, 1.21, 3.4]) expect(withFeeUsd(p, FLOOR)).toBeGreaterThan(p);
  });

  it("is monotonic, so the cheapest offer stays the cheapest after the fee", () => {
    // aggregatePricing relies on this: it takes the min/max of raw prices and
    // marks those up, rather than marking up every offer to find the extremes.
    let prev = 0;
    for (const p of [1, 5, 50, 100, 189, 190, 191, 500, 1000]) {
      const priced = withFeeUsd(p, FLOOR);
      expect(priced).toBeGreaterThanOrEqual(prev);
      prev = priced;
    }
  });
});
