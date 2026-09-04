"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";

// The instance type handed to onDone — distinct from the module's own `Stripe`
// promise type used by loadStripe above.
type StripeJs = NonNullable<Awaited<ReturnType<typeof loadStripe>>>;

// loadStripe must be called once, outside render — calling it per render
// refetches Stripe.js and throws away the mounted iframe on every keystroke.
// It's lazy so a page that never opens the card form never loads Stripe.js.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = pk ? loadStripe(pk) : Promise.resolve(null);
  }
  return stripePromise;
}

function CardFields({
  onDone,
  onCancel,
  submitLabel,
}: {
  // The live Stripe instance is handed back alongside the payment method
  // because it is only obtainable inside this Elements provider. A caller that
  // needs to finish a 3DS challenge on a following payment (subscribing, as
  // opposed to merely saving a card) has no other way to reach it, and
  // mounting a second provider just to get one would tear down this iframe.
  // Returning a string from onDone renders it as the form's error.
  onDone: (paymentMethodId: string | null, stripe: StripeJs) => Promise<void | string> | void | string;
  onCancel: () => void;
  submitLabel?: { idle: string; busy: string };
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // The card fields live in a Stripe iframe. If that iframe fails to render we
  // get no exception and no visual cue — just an empty box above a Save button,
  // which is indistinguishable from a broken form. These two make the failure
  // observable instead of silent.
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);

  // Stripe renders a skeleton while the card iframe loads and gives no timeout
  // of its own, so a blocked or failed iframe sits there looking like it's
  // about to finish, forever. Say so instead, and point at the causes we can't
  // see from here (blocked third-party frames is by far the most common).
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setStalled(true), 12_000);
    return () => clearTimeout(t);
  }, [ready]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    // redirect: "if_required" keeps the common path on-page while still
    // allowing the redirect that some 3DS issuers demand — omitting it would
    // force a full navigation for every card, and hardcoding "never" would
    // hard-fail exactly the cards that need a challenge.
    const { error: err, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/developers/billing` },
      redirect: "if_required",
    });

    if (err) {
      setError(err.message ?? "Could not save this card.");
      setSubmitting(false);
      return;
    }
    if (setupIntent?.status === "succeeded") {
      // Hand the payment method back: saving the card is only half the job.
      // The caller has to tell the server to adopt it, and a SetupIntent is
      // the only place the new pm id is available without another round trip.
      const pm =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method?.id ?? null);
      // Stay in the submitting state — onDone is still working, and dropping
      // back to an idle button invites a second submission of a SetupIntent
      // that has already succeeded.
      const failure = await onDone(pm, stripe);
      if (failure) {
        setError(failure);
        setSubmitting(false);
      }
      return;
    }
    if (setupIntent?.status === "processing") {
      setError("Your bank is still processing this card. Refresh in a moment to see it.");
      setSubmitting(false);
      return;
    }
    setError("This card needs additional verification. Please try another card.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setReady(true)}
        onLoadError={(e) => {
          console.error("[AddCardForm] PaymentElement failed to load", e);
          setError(e?.error?.message ?? "The card form could not be loaded. Please refresh and try again.");
        }}
      />
      {!ready && !error && !stalled && <div className="bl-pe-loading">Loading card form…</div>}
      {!ready && !error && stalled && (
        <div className="bl-error">
          The card form isn&apos;t loading. This is usually a browser extension or privacy setting blocking
          js.stripe.com — try disabling ad/tracker blocking for this site, or use a different browser.
        </div>
      )}
      {error && <div className="bl-error">{error}</div>}
      <div className="bl-form-actions">
        <button type="button" className="bl-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="bl-btn bl-btn-primary" disabled={!stripe || !ready || submitting}>
          {submitting ? (submitLabel?.busy ?? "Saving…") : (submitLabel?.idle ?? "Save card")}
        </button>
      </div>
    </form>
  );
}

export default function AddCardForm({
  clientSecret,
  onDone,
  onCancel,
  submitLabel,
}: {
  clientSecret: string;
  onDone: (paymentMethodId: string | null, stripe: StripeJs) => Promise<void | string> | void | string;
  onCancel: () => void;
  submitLabel?: { idle: string; busy: string };
}) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          variables: {
            colorPrimary: "#0052cc",
            colorText: "#111827",
            colorDanger: "#dc2626",
            // A real font stack, not "inherit". Stripe's Appearance API expects
            // a font-family value it can pass into an iframe that inherits
            // nothing from this page — "inherit" resolves to the iframe's own
            // default and broke the element's layout, collapsing it to 2px.
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            borderRadius: "9px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      <CardFields onDone={onDone} onCancel={onCancel} submitLabel={submitLabel} />
    </Elements>
  );
}
