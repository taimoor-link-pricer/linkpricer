import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { verifySession } from "@/lib/auth/verify-session";
import { stripe } from "@/lib/stripe";

export class BillingError extends Error {
  constructor(readonly status: number, readonly body: { error: string; message?: string }) {
    super(body.error);
  }
}

export interface BillingContext {
  userId: string;
  email: string;
  /** null when this user has never started a checkout — they have no Stripe customer yet. */
  customerId: string | null;
}

/**
 * Resolves the caller from the session cookie plus their Stripe customer id.
 *
 * Uses verifySession rather than adminAuth.verifySessionCookie directly, so a
 * transient failure reaching Google is not reported to the caller as "you are
 * signed out" — the existing developer routes call the admin SDK raw and are
 * the reason the dashboard carries a retry ladder for spurious 401s.
 */
export async function billingContext(req: NextRequest): Promise<BillingContext> {
  const cookie = req.cookies.get("session")?.value;
  if (!cookie) throw new BillingError(401, { error: "Unauthorized" });

  let userId: string;
  let email: string;
  try {
    const decoded = await verifySession(cookie);
    userId = decoded.uid;
    email = decoded.email ?? "";
  } catch {
    throw new BillingError(401, { error: "Unauthorized" });
  }

  const rows = await db.execute(sql`
    SELECT stripe_customer_id, email FROM users WHERE id = ${userId} LIMIT 1
  `);
  const row = rows.rows[0];
  if (!row) throw new BillingError(404, { error: "User not found" });

  return {
    userId,
    email: email || ((row.email as string) ?? ""),
    customerId: (row.stripe_customer_id as string) ?? null,
  };
}

/** Same as billingContext, but guarantees a Stripe customer exists, creating one if needed. */
export async function billingContextWithCustomer(req: NextRequest): Promise<BillingContext & { customerId: string }> {
  const ctx = await billingContext(req);
  if (ctx.customerId) return { ...ctx, customerId: ctx.customerId };

  if (!ctx.email) {
    throw new BillingError(400, { error: "no_email", message: "Your account has no email address on file." });
  }

  // Deterministic idempotency key so a double-click can't leave this user with
  // two Stripe customers, which would split their cards and subscriptions
  // across two records that nothing later reconciles.
  const customer = await stripe.customers.create(
    { email: ctx.email, metadata: { userId: ctx.userId } },
    { idempotencyKey: `customer:${ctx.userId}` }
  );

  // Only claim the row if it's still empty — a concurrent request may have won.
  const updated = await db.execute(sql`
    UPDATE users SET stripe_customer_id = ${customer.id}
    WHERE id = ${ctx.userId} AND stripe_customer_id IS NULL
    RETURNING stripe_customer_id
  `);
  if (updated.rows.length) return { ...ctx, customerId: customer.id };

  const reread = await db.execute(sql`
    SELECT stripe_customer_id FROM users WHERE id = ${ctx.userId} LIMIT 1
  `);
  return { ...ctx, customerId: (reread.rows[0]?.stripe_customer_id as string) ?? customer.id };
}

/** Wraps a handler so BillingError becomes its response and anything else is a scrubbed 500. */
export async function handle(
  label: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    const stripeErr = err as { type?: string; message?: string };

    // A concurrent request is already using this idempotency key — i.e. the
    // user double-clicked, and the first click is still in flight. Stripe's own
    // wording for this is a paragraph of API vocabulary; the honest, useful
    // thing to tell someone who clicked twice is that it's already happening.
    if (stripeErr?.type === "StripeIdempotencyError") {
      return NextResponse.json(
        { error: "in_progress", message: "This change is already being processed. Give it a moment." },
        { status: 409 }
      );
    }

    // Stripe's other messages are safe to surface and are far more actionable
    // than "something went wrong" (e.g. "Your card was declined."). Anything
    // else is logged and reported generically — raw errors can carry
    // connection strings and internal identifiers.
    if (typeof stripeErr?.type === "string" && stripeErr.type.startsWith("Stripe")) {
      console.error(`[${label}]`, err);
      return NextResponse.json(
        { error: "stripe_error", message: stripeErr.message ?? "Payment provider error." },
        { status: 400 }
      );
    }
    console.error(`[${label}]`, err);
    return NextResponse.json({ error: "internal_error", message: "An internal error occurred." }, { status: 500 });
  }
}

/** Per-user, per-route response headers for anything carrying billing data. */
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;
