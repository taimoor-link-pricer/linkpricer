/**
 * Display-only masking for the developer API plan prices.
 *
 * Marketing does not want the real subscription figures on screen while the
 * API is being demoed to testers and prospective customers. This module
 * rewrites the *strings we print* and nothing else: the plan definitions in
 * lib/stripe.ts, everything sent to Stripe, and every amount actually charged
 * are untouched. Flipping the flag can never change what a customer pays.
 *
 * Masked by default, so a deploy that never sets the env var still hides the
 * prices. Set NEXT_PUBLIC_HIDE_API_PRICES=false to show the real ones again.
 * The var is read at build time (it is inlined into the client bundle), so
 * changing it needs a redeploy, not just an env edit.
 */

export const API_PRICES_HIDDEN = process.env.NEXT_PUBLIC_HIDE_API_PRICES !== "false";

export type ApiPlanKey = "starter" | "growth" | "scale";

/**
 * One stable placeholder per tier. They differ from each other on purpose —
 * a reader can still see that the plans are three different prices in
 * ascending order, they just can't see what those prices are.
 */
const PLAN_DISPLAY: Record<ApiPlanKey, { real: string; masked: string }> = {
  starter: { real: "$10", masked: "$XX" },
  growth: { real: "$20", masked: "$YY" },
  scale: { real: "$50", masked: "$ZZ" },
};

/** The headline price of a plan, e.g. `$XX` — or `$XX/mo` with `period`. */
export function planPrice(plan: ApiPlanKey, opts?: { period?: string }): string {
  const d = PLAN_DISPLAY[plan];
  return (API_PRICES_HIDDEN ? d.masked : d.real) + (opts?.period ?? "");
}

/**
 * Redacts an already-formatted money string, keeping its shape so the column
 * it sits in still lines up: `$10.00` → `$••.••`, `$1,234.56` → `$•,•••.••`.
 *
 * Use this for amounts we didn't format ourselves from a plan key (invoice
 * totals, subscription amounts read back from Stripe). Do NOT use it on an
 * amount the customer is being asked to authorise — see the note on the
 * proration quote in app/developers/billing/page.tsx.
 */
export function maskMoney(formatted: string): string {
  return API_PRICES_HIDDEN ? formatted.replace(/\d/g, "•") : formatted;
}
