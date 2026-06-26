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
    priceUsd: 10,
    monthlyQuota: 1_000,
    perMinuteLimit: 10,
    priceId: process.env.STRIPE_PRICE_STARTER ?? "",
  },
  growth: {
    name: "Growth",
    priceUsd: 20,
    monthlyQuota: 2_500,
    perMinuteLimit: 20,
    priceId: process.env.STRIPE_PRICE_GROWTH ?? "",
  },
  scale: {
    name: "Scale",
    priceUsd: 50,
    monthlyQuota: 10_000,
    perMinuteLimit: 60,
    priceId: process.env.STRIPE_PRICE_SCALE ?? "",
  },
} as const;

export type PlanKey = keyof typeof PLANS;
