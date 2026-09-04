import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { BillingError } from "@/lib/billing-session";
import {
  effectiveDefaultPm,
  isCardExpired,
  needsPayment,
  pickGoverningSubscription,
  pmId,
} from "@/lib/billing";

/**
 * Confirms a payment method belongs to the caller's Stripe customer.
 *
 * Payment method ids are opaque but they are not secrets — they travel through
 * the browser. Without this check, POSTing someone else's `pm_...` would let a
 * caller detach a stranger's card or point their own subscription at it. Every
 * route that touches a pm resolves it through here first.
 */
export async function assertOwnedCard(
  id: string,
  customerId: string | null
): Promise<Stripe.PaymentMethod> {
  if (!customerId) throw new BillingError(404, { error: "not_found", message: "Card not found." });
  if (!/^pm_[A-Za-z0-9_]+$/.test(id)) {
    throw new BillingError(400, { error: "invalid_id", message: "Malformed payment method id." });
  }

  // A missing payment method and someone else's payment method have to be
  // indistinguishable. Letting Stripe's "No such PaymentMethod" 400 through for
  // one and returning our 404 for the other turns the pair into an oracle for
  // deciding whether an id is real — impractical against ids this random, but
  // free to close.
  let pm: Stripe.PaymentMethod;
  try {
    pm = await stripe.paymentMethods.retrieve(id);
  } catch {
    throw new BillingError(404, { error: "not_found", message: "Card not found." });
  }
  if (pmId(pm.customer) !== customerId) {
    // Deliberately 404, not 403 — a 403 would confirm the id exists and belongs
    // to somebody.
    throw new BillingError(404, { error: "not_found", message: "Card not found." });
  }
  return pm;
}

/**
 * Point both the customer and the live subscription at this card.
 *
 * The customer-level default only applies where a subscription has none of its
 * own, and Checkout stamps a default onto the subscription it creates — so
 * without the second write the change appears to succeed while the next
 * renewal still charges the old card.
 */
export async function setDefaultCard(
  customerId: string,
  id: string,
  sub: Stripe.Subscription | null
): Promise<void> {
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: id },
  });
  if (sub) {
    await stripe.subscriptions.update(sub.id, { default_payment_method: id });
  }
}

export interface AdoptResult {
  /** This card is now the one Stripe will charge. */
  madeDefault: boolean;
  /** Set when the subscription was stalled on a payment and we tried to settle it. */
  recovery: {
    attempted: boolean;
    paid: boolean;
    message: string | null;
    /** Stripe-hosted page where the customer can finish a payment we couldn't complete. */
    invoiceUrl: string | null;
  } | null;
  subscriptionStatus: Stripe.Subscription.Status | null;
}

/**
 * Everything that should follow a card being saved.
 *
 * Saving a card via SetupIntent is not self-completing: Stripe attaches the
 * payment method to the customer but never promotes it, so a card added to
 * rescue a failing subscription would sit there doing nothing while the
 * automatic retries kept hitting the dead card. That is the whole reason
 * someone adds a card mid-dunning, so adopt it and settle the open invoice
 * rather than leaving both steps to a button the customer has to find.
 *
 * Promotion is conditional, not automatic: someone who deliberately made one
 * card the default and then saves a second one for later should keep the
 * default they chose.
 */
export async function adoptSavedCard(customerId: string, id: string): Promise<AdoptResult> {
  const [customer, subs, pms] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }),
    stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 20 }),
  ]);

  const sub = pickGoverningSubscription(subs.data);
  const current = effectiveDefaultPm(customer, sub);
  const currentPm = current ? pms.data.find((pm) => pm.id === current) : undefined;

  const shouldPromote =
    // Nothing is set — this is their first card, or Checkout never stamped one.
    !current ||
    // Already the default; nothing to do, but report it as such so the UI can
    // say "this is the card we'll charge" either way.
    current === id ||
    // The recorded default was detached and Stripe is pointing at a ghost.
    !currentPm ||
    // The default can no longer be charged.
    isCardExpired(currentPm) ||
    // The default just failed — that's why they're here.
    needsPayment(sub);

  if (shouldPromote && current !== id) {
    await setDefaultCard(customerId, id, sub);
  }

  const result: AdoptResult = {
    madeDefault: shouldPromote,
    recovery: null,
    subscriptionStatus: sub?.status ?? null,
  };

  if (!needsPayment(sub) || !sub) return result;

  // Waiting for Stripe's next scheduled retry can take days, and the API stays
  // paused for all of it. The customer is standing right here with a working
  // card, so settle it now.
  const open = await stripe.invoices.list({
    customer: customerId,
    subscription: sub.id,
    status: "open",
    limit: 1,
  });
  const invoice = open.data[0];
  if (!invoice?.id) return result;

  try {
    // off_session: false — the customer is present, so an issuer that wants a
    // challenge can get one instead of hard-declining the way it would for an
    // unattended renewal.
    const paid = await stripe.invoices.pay(invoice.id, {
      payment_method: id,
      off_session: false,
    });

    // Deliberately checking the invoice's own status rather than reaching into
    // the payment intent: 3DS can leave the charge in flight with the invoice
    // still open, and the hosted invoice page completes that far better than
    // rebuilding the challenge here.
    result.recovery =
      paid.status === "paid"
        ? { attempted: true, paid: true, message: null, invoiceUrl: null }
        : {
            attempted: true,
            paid: false,
            message: "Your bank needs to verify this payment before we can restore access.",
            invoiceUrl: paid.hosted_invoice_url ?? null,
          };
  } catch (err) {
    // The card was saved and promoted successfully — only the retry failed, so
    // this is a partial success, not a failed request. Surface the decline
    // reason and leave the card in place.
    const stripeErr = err as { type?: string; message?: string };
    if (typeof stripeErr?.type === "string" && stripeErr.type.startsWith("Stripe")) {
      result.recovery = {
        attempted: true,
        paid: false,
        message: stripeErr.message ?? "That card was declined.",
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      };
    } else {
      throw err;
    }
  }

  return result;
}
