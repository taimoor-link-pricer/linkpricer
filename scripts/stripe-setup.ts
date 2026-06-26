/**
 * One-time setup: creates Stripe products + recurring prices for all 3 API plans.
 * Run once: npx tsx --env-file=.env scripts/stripe-setup.ts
 * Paste the output price IDs into .env as STRIPE_PRICE_STARTER / _GROWTH / _SCALE
 */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

const PLANS = [
  { key: "starter", name: "Starter", amount: 1000, quota: "1,000 queries/mo"  },
  { key: "growth",  name: "Growth",  amount: 2000, quota: "2,500 queries/mo"  },
  { key: "scale",   name: "Scale",   amount: 5000, quota: "10,000 queries/mo" },
];

async function main() {
  console.log("Creating Stripe products and prices for Linkpricer API...\n");

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: `Linkpricer API — ${plan.name}`,
      description: `${plan.quota}. Domain pricing data via the Linkpricer REST API.`,
      metadata: { plan: plan.key },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amount,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: plan.key },
    });

    console.log(`${plan.name.toUpperCase()}`);
    console.log(`  Product: ${product.id}`);
    console.log(`  Price:   ${price.id}  ← add to .env as STRIPE_PRICE_${plan.key.toUpperCase()}`);
    console.log();
  }

  console.log("Done. Paste the Price IDs above into your .env file.");
}

main().catch((err) => { console.error(err); process.exit(1); });
