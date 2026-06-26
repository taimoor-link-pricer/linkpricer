import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
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
