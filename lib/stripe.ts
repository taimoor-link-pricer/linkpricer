import Stripe from "stripe";

function getStripeInstance(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-06-24.dahlia",
  });
}

// Lazy proxy — defers Stripe SDK initialization to request time, not build time.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  starter: {
    name: "Starter",
    priceUsd: 49,
    monthlyQuota: 10_000,
    perMinuteLimit: 60,
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
  },
  growth: {
    name: "Growth",
    priceUsd: 199,
    monthlyQuota: 100_000,
    perMinuteLimit: 300,
    priceId: process.env.STRIPE_PRICE_GROWTH ?? "",
  },
  scale: {
    name: "Scale",
    priceUsd: 799,
    monthlyQuota: 500_000,
    perMinuteLimit: 1_000,
    priceId: process.env.STRIPE_PRICE_SCALE ?? "",
  },
} as const;

export type PlanKey = keyof typeof PLANS;
