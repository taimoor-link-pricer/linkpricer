/**
 * LinkPricer's managed fee — the one definition of it.
 *
 * The fee used to be a flat 15% of the order subtotal, which on a cheap
 * placement came to almost nothing: a $5 guest post earned a $0.75 fee, and
 * a real order for $5.75 total was placed on 2026-09-15. Handling an order
 * costs the same whether the placement is $5 or $500, so the percentage now
 * has a floor: whichever of the two is larger is charged.
 *
 *   fee = max(subtotal * 15%, MIN_FEE_EUR)
 *
 * Above roughly $190 of subtotal the percentage is the larger number and
 * nothing changes — the floor only bites on the small orders it exists for.
 *
 * This module is imported by both client and server code (the Analyze price
 * columns, the cart, the orders API and the public API all have to agree to
 * the cent, or a customer sees one number and is charged another), so it must
 * stay free of `@/lib/db` and anything else server-only.
 */

/** The headline markup, as a percentage of the subtotal. */
export const FEE_PERCENT = 15;

/**
 * The floor, in EUR, because that is the currency the business set it in
 * ("our minimum fee has to be €25" — Karolis, 2026-09-17).
 *
 * Every price in this app is carried in USD, so the floor is converted with
 * the admin-configured EUR rate at the point of use rather than hardcoded as
 * a dollar figure — a fixed $28.50 would silently drift away from €25 as the
 * rate moved.
 */
export const MIN_FEE_EUR = 25;

/**
 * Fallback EUR→USD rate for the SERVER, matching DEFAULT_RATES in
 * lib/currency.ts.
 *
 * Only reached when currency_rates is unreadable. It puts the floor slightly
 * below €25 rather than above it, so a rate outage never overcharges.
 */
export const FALLBACK_EUR_USD = 1 / 0.92;

/**
 * Fallback EUR→USD rate for a PRICE THE CUSTOMER IS SHOWN, deliberately at
 * the high end of the plausible range instead of the low end.
 *
 * The asymmetry is the point. The server's fallback decides what is actually
 * charged, so it errs low. A display fallback decides what the customer is
 * quoted *before* the server prices the order, so erring low there would quote
 * less than we then charge — the one direction that is unfair. Erring high
 * means that in the rare window where /api/currency-rates is unreachable the
 * quote is a dollar or so above the real charge, which can only ever come in
 * cheaper than advertised.
 *
 * Both converge the moment the real rate arrives: `hydrateRates()` replaces
 * this with the admin rate and display then matches the charge to the cent.
 */
export const FALLBACK_EUR_USD_DISPLAY = 1.25;

/**
 * The fee floor in USD cents, from the rate map `getUsdRates()` returns
 * ("1 EUR = `rates.EUR` USD").
 *
 * A missing, zero or non-finite rate falls back rather than throwing: this
 * sits on the order-placement path, and refusing to price an order because
 * the currency table is unreachable would be a worse failure than pricing it
 * off a slightly stale rate.
 */
export function minFeeCents(rates: Record<string, number> | null | undefined): number {
  const raw = rates?.EUR;
  const rate = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_EUR_USD;
  return Math.round(MIN_FEE_EUR * rate * 100);
}

/**
 * The managed fee for one order, in cents.
 *
 * Per order, not per cart: each row in `orders` is one placement that gets
 * handled, chased and published on its own, so a cart of three cheap
 * placements carries three floors. Direct orders never reach here — they
 * carry no fee at all, because the marketplace affiliate commission replaces
 * it (see the marketplace-redirect flow).
 */
export function managedFeeCents(subtotalCents: number, feeFloorCents: number): number {
  return Math.max(Math.round(subtotalCents * (FEE_PERCENT / 100)), feeFloorCents);
}

/**
 * What LinkPricer charges for a placement a marketplace sells at
 * `marketplacePrice` USD — the "Our price" column, the Buy button, and the
 * public API's our_price / lp_prices.
 *
 * Whole dollars, because every price surface displays whole dollars. The
 * `floor(p) + 1` term predates the fee floor and is now almost always
 * dominated by it; it stays because it still guarantees at least one whole
 * dollar of margin if the floor is ever configured down to zero.
 */
export function withFeeUsd(marketplacePrice: number, feeFloorCents: number): number {
  const fee = Math.max((marketplacePrice * FEE_PERCENT) / 100, feeFloorCents / 100);
  return Math.max(Math.round(marketplacePrice + fee), Math.floor(marketplacePrice) + 1);
}
