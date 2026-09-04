"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import AddCardForm from "./AddCardForm";
import { countryName, countryOptions } from "@/lib/countries";

type PlanKey = "starter" | "growth" | "scale";

const PLAN_ORDER: PlanKey[] = ["starter", "growth", "scale"];
const PLAN_META: Record<PlanKey, { label: string; price: string; queries: string; rate: string }> = {
  starter: { label: "Starter", price: "$10/mo", queries: "1,000 queries/mo", rate: "10 req/min" },
  growth: { label: "Growth", price: "$20/mo", queries: "2,500 queries/mo", rate: "20 req/min" },
  scale: { label: "Scale", price: "$50/mo", queries: "10,000 queries/mo", rate: "60 req/min" },
};

interface Card {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  isExpired: boolean;
  removable: boolean;
  removeBlockedReason: string | null;
}
interface Subscription {
  id: string;
  plan: PlanKey | null;
  planName: string | null;
  status: string;
  amount: number | null;
  currency: string;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledChange: { plan: PlanKey | null; planName: string | null; effectiveAt: string | null } | null;
}
interface Invoice {
  id: string;
  number: string | null;
  created: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}
interface BillingAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}
interface BillingDetails {
  name: string | null;
  address: BillingAddress | null;
}
interface BillingData {
  customerId: string | null;
  subscription: Subscription | null;
  cards: Card[];
  invoices: Invoice[];
  invoicesHasMore: boolean;
  billingDetails: BillingDetails;
}
interface Quote {
  prorationDate: number | null;
  /** True for a downgrade: nothing is charged now, it takes effect at renewal. */
  scheduled?: boolean;
  effectiveAt?: string | null;
  toPlan: PlanKey;
  fromPlan: PlanKey | null;
  currency: string;
  credit: number;
  charge: number;
  dueNow: number;
  creditedToBalance: number;
  balanceApplied: number;
  balanceRemaining: number;
  isUpgrade: boolean;
  nextRenewal: string | null;
  nextRenewalAmount: number;
  lines: { description: string | null; amount: number }[];
}

interface Banner {
  tone: "ok" | "bad" | "warn";
  text: string;
  /** Somewhere the customer has to go to finish what we couldn't finish for them. */
  href?: string;
  hrefLabel?: string;
}
/** What the server did with a card once it was saved. */
interface AdoptResult {
  madeDefault: boolean;
  recovery: { attempted: boolean; paid: boolean; message: string | null; invoiceUrl: string | null } | null;
  subscriptionStatus: string | null;
}

function money(minor: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    minor / 100
  );
}
function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
/**
 * What to show in the Amount column.
 *
 * `amountPaid` is zero on anything that hasn't been collected, so showing it
 * unconditionally tells a customer with an overdue invoice that they owe
 * nothing — the exact opposite of what that row exists to communicate.
 */
function invoiceAmount(inv: Invoice) {
  return isSettled(inv.status) ? inv.amountPaid : inv.amountDue;
}
function isSettled(status: string | null) {
  return status === "paid" || status === "void" || status === "uncollectible";
}
function formatAddress(d: BillingDetails): string[] {
  const a = d.address;
  if (!a) return [];
  const region = [a.postalCode, a.city, a.state].filter(Boolean).join(" ");
  return [d.name, a.line1, a.line2, region, countryName(a.country)].filter(
    (line): line is string => Boolean(line && line.trim())
  );
}
function brandLabel(b: string) {
  return b === "amex" ? "Amex" : b.charAt(0).toUpperCase() + b.slice(1);
}

const STATUS_COPY: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  active: { label: "Active", tone: "ok" },
  trialing: { label: "Trialing", tone: "ok" },
  past_due: { label: "Past due", tone: "bad" },
  unpaid: { label: "Unpaid", tone: "bad" },
  incomplete: { label: "Incomplete", tone: "warn" },
};

export default function BillingPage() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);

  const [addingCard, setAddingCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Card | null>(null);
  // Why a removal was refused, kept next to the button that was clicked. A
  // top-of-page banner is off-screen by the time you've scrolled to the cards,
  // so closing the dialog and posting the reason up there reads as the click
  // having done nothing at all.
  const [removeError, setRemoveError] = useState<{ code: string; message: string } | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState<PlanKey | null>(null);
  const [applying, setApplying] = useState(false);
  const [unscheduling, setUnscheduling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  // Invoices live outside `data` because they grow: paging appends to this
  // list, and folding pages back into `data` would make the next refresh of
  // the page silently discard everything the customer had loaded.
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesHasMore, setInvoicesHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editingAddress, setEditingAddress] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [form, setForm] = useState({
    name: "", line1: "", line2: "", city: "", state: "", postalCode: "", country: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/developers/billing");
    if (res.ok) {
      const j = (await res.json()) as BillingData;
      setData(j);
      // Reset rather than merge: a refresh follows an action that can change
      // an invoice's status, so the first page has to win over anything stale
      // already on screen.
      setInvoices(j.invoices ?? []);
      setInvoicesHasMore(Boolean(j.invoicesHasMore));
    }
    setLoading(false);
  }, []);

  async function loadMoreInvoices() {
    const last = invoices[invoices.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(
      `/api/developers/billing/invoices?starting_after=${encodeURIComponent(last.id)}`
    );
    if (res.ok) {
      const j = (await res.json()) as { invoices: Invoice[]; hasMore: boolean };
      // Guard against a double-click racing two identical pages onto the list.
      setInvoices((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...j.invoices.filter((i) => !seen.has(i.id))];
      });
      setInvoicesHasMore(j.hasMore);
    } else {
      setBanner({ tone: "bad", text: "Could not load older invoices." });
    }
    setLoadingMore(false);
  }

  function openAddressForm(details: BillingDetails) {
    const a = details.address;
    setForm({
      name: details.name ?? "",
      line1: a?.line1 ?? "",
      line2: a?.line2 ?? "",
      city: a?.city ?? "",
      state: a?.state ?? "",
      postalCode: a?.postalCode ?? "",
      country: a?.country ?? "",
    });
    setAddressError("");
    setEditingAddress(true);
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressBusy(true);
    setAddressError("");
    const res = await fetch("/api/developers/billing/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setEditingAddress(false);
      setBanner({ tone: "ok", text: "Billing details saved. They'll appear on your next invoice." });
      await load();
    } else {
      setAddressError(j.message ?? "Could not save your billing details.");
    }
    setAddressBusy(false);
  }

  /**
   * Second half of adding a card.
   *
   * confirmSetup only attaches the card to the Stripe customer — it doesn't
   * make it the card we'll charge, and it certainly doesn't retry the invoice
   * that sent a past-due customer here in the first place. The server decides
   * both (promoting is conditional, so a deliberately-chosen default survives),
   * and we report what it actually did rather than a flat "Card saved."
   */
  const finishCardSave = useCallback(
    async (payload: { paymentMethodId?: string; setupIntentId?: string }) => {
      const res = await fetch("/api/developers/billing/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as AdoptResult & { message?: string };
      await load();

      if (!res.ok) {
        // The card itself is saved — only the follow-up failed, so don't imply
        // they have to start over.
        setBanner({
          tone: "bad",
          text: j.message ?? "Card saved, but we couldn't make it your default. Use \u201cMake default\u201d below.",
        });
        return;
      }

      if (j.recovery?.attempted && !j.recovery.paid) {
        setBanner({
          tone: "bad",
          text: `Card saved, but the payment didn't go through. ${j.recovery.message ?? ""}`.trim(),
          href: j.recovery.invoiceUrl ?? undefined,
          hrefLabel: "Complete payment",
        });
        return;
      }
      if (j.recovery?.paid) {
        setBanner({ tone: "ok", text: "Payment received — your API access is back on." });
        return;
      }
      setBanner({
        tone: "ok",
        text: j.madeDefault ? "Card saved. We'll charge this card from now on." : "Card saved.",
      });
    },
    [load]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        } catch {
          /* load() will 401 and the signed-out view renders */
        }
      }
      setFirebaseUser(user);
      setAuthLoading(false);
      // Load billing data from inside this callback rather than a second
      // effect keyed on firebaseUser. onAuthStateChanged is an external
      // subscription, which is exactly where React expects state updates to
      // originate; driving the fetch from an effect body instead triggers a
      // cascading render (and trips react-hooks/set-state-in-effect).
      if (user) {
        await load();

        // 3DS can take the customer away to their bank and bring them back
        // here as a fresh page load, so confirmSetup's return value — and with
        // it the new payment method id — never reaches us. Stripe puts the
        // SetupIntent id in the URL for exactly this case; the server resolves
        // it to the saved card and finishes the job. Read it off the location
        // rather than useSearchParams, which would drag a Suspense boundary
        // into a page that is already fully client-rendered.
        const params = new URLSearchParams(window.location.search);
        const setupIntentId = params.get("setup_intent");
        if (setupIntentId && params.get("redirect_status") === "succeeded") {
          // Strip the params first: finishCardSave isn't idempotent from the
          // customer's point of view (it can charge an invoice), and leaving
          // them in place would re-run it on every refresh.
          window.history.replaceState(null, "", window.location.pathname);
          await finishCardSave({ setupIntentId });
        }
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, [load, finishCardSave]);

  async function startAddCard() {
    setBanner(null);
    const res = await fetch("/api/developers/billing/setup-intent", { method: "POST" });
    const j = await res.json();
    if (!res.ok) {
      setBanner({ tone: "bad", text: j.message ?? "Could not start card setup." });
      return;
    }
    setClientSecret(j.clientSecret);
    setAddingCard(true);
  }

  // Every mutating handler below wraps its fetch in try/finally.
  //
  // None of them used to. A fetch that rejects — the dev server restarting
  // mid-request, a dropped connection, a proxy timeout, anything that produces
  // no response at all — threw straight out of the handler, so the trailing
  // `setXBusy(false)` never ran. The button stayed on "Working…" for the rest
  // of the page's life with no error shown anywhere: the customer is told the
  // cancellation (or card removal, or plan change) is in progress, forever,
  // and only a reload gets them out. Observed live on the cancel button.
  async function makeDefault(card: Card) {
    setBusyCard(card.id);
    try {
      setBanner(null);
      const res = await fetch(`/api/developers/billing/payment-methods/${card.id}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setBanner({ tone: "ok", text: `•••• ${card.last4} is now your default card.` });
        await load();
      } else {
        setBanner({ tone: "bad", text: j.message ?? "Could not update the default card." });
      }
    
    } catch {
      setBanner({ tone: "bad", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusyCard(null);
    }
  }

  function askRemove(card: Card) {
    setRemoveError(null);
    setConfirmRemove(card);
  }

  async function removeCard(card: Card) {
    setBusyCard(card.id);
    setBanner(null);
    setRemoveError(null);
    let res: Response;
    let j: { error?: unknown; message?: string };
    try {
      res = await fetch(`/api/developers/billing/payment-methods/${card.id}`, { method: "DELETE" });
      j = await res.json().catch(() => ({}));
    } catch {
      setBusyCard(null);
      setRemoveError({ code: "", message: "Couldn't reach the server. The card was not removed." });
      return;
    }
    setBusyCard(null);

    if (res.ok) {
      setConfirmRemove(null);
      setBanner({ tone: "ok", text: `Removed card ending ${card.last4}.` });
      await load();
      return;
    }

    // Stay open on failure. The dialog asked a question, the answer is no, and
    // the reason belongs where the question was asked.
    setRemoveError({
      code: typeof j.error === "string" ? j.error : "",
      message: j.message ?? "Could not remove that card.",
    });
  }

  async function previewPlan(plan: PlanKey) {
    setQuoting(plan);
    setBanner(null);
    const res = await fetch("/api/developers/billing/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, preview: true }),
    });
    const j = await res.json();
    if (res.ok) setQuote(j);
    else setBanner({ tone: "bad", text: j.message ?? "Could not price that change." });
    setQuoting(null);
  }

  async function applyPlan() {
    if (!quote) return;
    setApplying(true);
    try {
      const res = await fetch("/api/developers/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: quote.toPlan, prorationDate: quote.prorationDate }),
      });
      const j = await res.json();
      if (res.ok) {
        setBanner(
          j.scheduled
            ? {
                tone: "ok",
                text: `You'll move to ${j.scheduledPlanName} on ${shortDate(j.effectiveAt)}. Nothing changes until then — you keep your current plan and limits for the period you've paid for.`,
              }
            : { tone: "ok", text: `You're on ${j.planName}. Your new limits are active immediately.` }
        );
        setQuote(null);
        await load();
      } else {
        setBanner({ tone: "bad", text: j.message ?? "Could not change your plan." });
      }
    
    } catch {
      setBanner({ tone: "bad", text: "Couldn't reach the server. Your plan was not changed — check your connection and try again." });
    } finally {
      setApplying(false);
    }
  }

  async function cancelScheduledChange() {
    setUnscheduling(true);
    try {
      setBanner(null);
      const res = await fetch("/api/developers/billing/change-plan", { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setBanner({ tone: "ok", text: `Plan change cancelled. You stay on ${j.planName ?? "your current plan"}.` });
        await load();
      } else {
        setBanner({ tone: "bad", text: j.message ?? "Could not cancel that plan change." });
      }
    
    } catch {
      setBanner({ tone: "bad", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setUnscheduling(false);
    }
  }

  async function setCancellation(resume: boolean) {
    setCancelBusy(true);
    try {
      const res = await fetch("/api/developers/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      const j = await res.json();
      if (res.ok) {
        setBanner({
          tone: "ok",
          text: resume
            ? "Your subscription will renew as normal."
            : `Subscription ends ${shortDate(j.accessUntil)}. Your key works until then.`,
        });
        await load();
      } else {
        setBanner({ tone: "bad", text: j.message ?? "Could not update your subscription." });
      }
    } catch {
      setBanner({ tone: "bad", text: "Couldn't reach the server. Your subscription was not changed — check your connection and try again." });
    } finally {
      setCancelBusy(false);
      setCancelOpen(false);
    }
  }

  if (authLoading || loading) return <div className="bl-center"><div className="bl-spinner" /><Styles /></div>;

  if (!firebaseUser) {
    return (
      <div className="bl-center">
        <div className="bl-empty-box">
          <h2>Billing</h2>
          <p>Sign in to manage your cards and subscription.</p>
          <Link href="/developers/dashboard" className="bl-btn bl-btn-primary">Sign in</Link>
        </div>
        <Styles />
      </div>
    );
  }

  const sub = data?.subscription ?? null;
  const status = sub ? (STATUS_COPY[sub.status] ?? { label: sub.status, tone: "warn" as const }) : null;
  const details: BillingDetails = data?.billingDetails ?? { name: null, address: null };
  const addressLines = formatAddress(details);

  return (
    <div className="bl-wrap">
      <Styles />

      <div className="bl-head">
        <h1>Billing</h1>
        <p>Manage your saved cards, plan, and invoices.</p>
      </div>

      {banner && (
        <div className={`bl-banner ${banner.tone}`}>
          <span>{banner.text}</span>
          {banner.href && (
            <a className="bl-btn bl-btn-sm" href={banner.href} target="_blank" rel="noopener noreferrer">
              {banner.hrefLabel ?? "Open"}
            </a>
          )}
        </div>
      )}

      {sub?.cancelAtPeriodEnd && (
        <div className="bl-banner warn">
          <span>
            Your subscription ends <strong>{shortDate(sub.currentPeriodEnd)}</strong>. Your API key keeps working
            until then.
          </span>
          <button className="bl-btn bl-btn-sm" disabled={cancelBusy} onClick={() => setCancellation(true)}>
            {cancelBusy ? "Working…" : "Resume subscription"}
          </button>
        </div>
      )}

      {sub?.scheduledChange && !sub.cancelAtPeriodEnd && (
        <div className="bl-banner warn">
          <span>
            Moving to <strong>{sub.scheduledChange.planName}</strong> on{" "}
            <strong>{shortDate(sub.scheduledChange.effectiveAt)}</strong>. You keep your current plan and limits
            until then.
          </span>
          <button className="bl-btn bl-btn-sm" disabled={unscheduling} onClick={cancelScheduledChange}>
            {unscheduling ? "Working…" : "Keep current plan"}
          </button>
        </div>
      )}

      {sub && (sub.status === "past_due" || sub.status === "unpaid") && (
        <div className="bl-banner bad">
          We couldn&apos;t charge your card, so API access is paused. Add a working card below and we&apos;ll retry
          the payment straight away — you don&apos;t have to wait for the next scheduled attempt.
        </div>
      )}

      {/* ─── Subscription ─────────────────────────────────────────────── */}
      <section className="bl-card">
        <div className="bl-card-label">Subscription</div>
        {sub ? (
          <>
            <div className="bl-sub-row">
              <div>
                <div className="bl-sub-plan">{sub.planName ?? "Unknown plan"}</div>
                <div className="bl-sub-meta">
                  {sub.amount != null && `${money(sub.amount, sub.currency)} / ${sub.interval ?? "month"}`}
                </div>
              </div>
              <span className={`bl-status ${status?.tone}`}>{status?.label}</span>
            </div>
            <div className="bl-kv">
              <span>{sub.cancelAtPeriodEnd ? "Access until" : "Next renewal"}</span>
              <strong>{shortDate(sub.currentPeriodEnd)}</strong>
            </div>
            {!sub.cancelAtPeriodEnd && (
              <button className="bl-link-danger" onClick={() => setCancelOpen(true)}>
                Cancel subscription
              </button>
            )}
          </>
        ) : (
          <div className="bl-empty">
            <p>No active subscription.</p>
            <Link href="/developers/dashboard" className="bl-btn bl-btn-primary">Choose a plan</Link>
          </div>
        )}
      </section>

      {/* ─── Payment methods ──────────────────────────────────────────── */}
      <section className="bl-card">
        <div className="bl-card-label">Payment methods</div>

        {data?.cards.length ? (
          <div className="bl-cards">
            {data.cards.map((c) => (
              <div key={c.id} className={`bl-pm${c.isDefault ? " default" : ""}`}>
                <div className="bl-pm-main">
                  <span className="bl-pm-brand">{brandLabel(c.brand)}</span>
                  <span className="bl-pm-num">•••• {c.last4}</span>
                  <span className={`bl-pm-exp${c.isExpired ? " expired" : ""}`}>
                    {c.isExpired ? "Expired" : `Expires ${String(c.expMonth).padStart(2, "0")}/${c.expYear}`}
                  </span>
                  {c.isDefault && <span className="bl-pm-badge">Default</span>}
                </div>
                <div className="bl-pm-actions">
                  {!c.isDefault && (
                    <button className="bl-btn bl-btn-sm" disabled={busyCard === c.id} onClick={() => makeDefault(c)}>
                      Make default
                    </button>
                  )}
                  {/* Disabled rather than hidden: a missing button reads as a
                      bug, whereas a dead one paired with the reason below reads
                      as a rule. */}
                  <button
                    className="bl-btn bl-btn-sm bl-btn-ghost"
                    disabled={busyCard === c.id || !c.removable}
                    title={c.removeBlockedReason ?? undefined}
                    onClick={() => askRemove(c)}
                  >
                    Remove
                  </button>
                </div>
                {/* Stated up front, not on refusal. Learning the rule only by
                    clicking Remove and being turned down makes a deliberate
                    constraint feel like a broken button. .bl-pm wraps, so this
                    takes its own line inside the same bordered row. */}
                {c.removeBlockedReason && <p className="bl-pm-note">{c.removeBlockedReason}</p>}
              </div>
            ))}
          </div>
        ) : (
          !addingCard && <p className="bl-muted">No cards saved yet.</p>
        )}

        {addingCard && clientSecret ? (
          <div className="bl-addcard">
            <AddCardForm
              clientSecret={clientSecret}
              onDone={async (paymentMethodId) => {
                setAddingCard(false);
                setClientSecret(null);
                if (paymentMethodId) {
                  await finishCardSave({ paymentMethodId });
                } else {
                  setBanner({ tone: "ok", text: "Card saved." });
                  await load();
                }
              }}
              onCancel={() => {
                setAddingCard(false);
                setClientSecret(null);
              }}
            />
          </div>
        ) : (
          <button className="bl-btn bl-btn-primary bl-add-btn" onClick={startAddCard}>
            + Add card
          </button>
        )}
      </section>

      {/* ─── Billing details ──────────────────────────────────────────── */}
      <section className="bl-card">
        <div className="bl-card-label">Billing details</div>
        <p className="bl-muted">
          Printed on your invoices. Stripe uses this address, not the one on your card.
        </p>

        {editingAddress ? (
          <form onSubmit={saveAddress}>
            <div className="bl-field">
              <label htmlFor="bl-name">Name or company</label>
              <input
                id="bl-name"
                className="bl-input"
                value={form.name}
                maxLength={150}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="organization"
              />
            </div>
            <div className="bl-field">
              <label htmlFor="bl-line1">Street address</label>
              <input
                id="bl-line1"
                className="bl-input"
                value={form.line1}
                maxLength={200}
                required
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
                autoComplete="address-line1"
              />
            </div>
            <div className="bl-field">
              <label htmlFor="bl-line2">Apartment, suite, etc. (optional)</label>
              <input
                id="bl-line2"
                className="bl-input"
                value={form.line2}
                maxLength={200}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
                autoComplete="address-line2"
              />
            </div>
            <div className="bl-field-row">
              <div className="bl-field">
                <label htmlFor="bl-city">City</label>
                <input
                  id="bl-city"
                  className="bl-input"
                  value={form.city}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  autoComplete="address-level2"
                />
              </div>
              <div className="bl-field">
                <label htmlFor="bl-state">State / region</label>
                <input
                  id="bl-state"
                  className="bl-input"
                  value={form.state}
                  maxLength={100}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  autoComplete="address-level1"
                />
              </div>
              <div className="bl-field">
                <label htmlFor="bl-zip">Postal code</label>
                <input
                  id="bl-zip"
                  className="bl-input"
                  value={form.postalCode}
                  maxLength={20}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  autoComplete="postal-code"
                />
              </div>
            </div>
            <div className="bl-field">
              <label htmlFor="bl-country">Country</label>
              <select
                id="bl-country"
                className="bl-input"
                value={form.country}
                required
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                autoComplete="country"
              >
                <option value="">Select a country</option>
                {countryOptions().map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            {addressError && <div className="bl-error">{addressError}</div>}
            <div className="bl-form-actions">
              <button
                type="button"
                className="bl-btn"
                disabled={addressBusy}
                onClick={() => setEditingAddress(false)}
              >
                Cancel
              </button>
              <button type="submit" className="bl-btn bl-btn-primary" disabled={addressBusy}>
                {addressBusy ? "Saving…" : "Save details"}
              </button>
            </div>
          </form>
        ) : addressLines.length ? (
          <div className="bl-address-row">
            <address className="bl-address">
              {addressLines.map((line, i) => <div key={i}>{line}</div>)}
            </address>
            <button className="bl-btn bl-btn-sm" onClick={() => openAddressForm(details)}>Edit</button>
          </div>
        ) : (
          <div className="bl-address-row">
            <p className="bl-muted bl-address-empty">
              No billing address on file — your invoices will go out without one.
            </p>
            <button className="bl-btn bl-btn-primary bl-btn-sm" onClick={() => openAddressForm(details)}>
              Add address
            </button>
          </div>
        )}
      </section>

      {/* ─── Plan switcher ────────────────────────────────────────────── */}
      {sub && (
        <section className="bl-card">
          <div className="bl-card-label">Change plan</div>
          <p className="bl-muted bl-plan-note">
            Upgrades apply immediately — we credit the unused time on your current plan and charge only the
            difference. Downgrades take effect at your next renewal, so you keep the plan you&apos;ve already
            paid for until then.
          </p>
          <div className="bl-plans">
            {PLAN_ORDER.map((p) => {
              const meta = PLAN_META[p];
              const isCurrent = sub.plan === p;
              return (
                <div key={p} className={`bl-plan${isCurrent ? " current" : ""}`}>
                  {isCurrent && <div className="bl-plan-badge">Current</div>}
                  <div className="bl-plan-name">{meta.label}</div>
                  <div className="bl-plan-price">{meta.price}</div>
                  <div className="bl-plan-sub">{meta.queries}</div>
                  <div className="bl-plan-sub">{meta.rate}</div>
                  <button
                    className="bl-btn bl-plan-btn"
                    disabled={isCurrent || quoting !== null || sub.cancelAtPeriodEnd}
                    onClick={() => previewPlan(p)}
                  >
                    {isCurrent ? "Current" : quoting === p ? "Pricing…" : "Switch"}
                  </button>
                </div>
              );
            })}
          </div>
          {sub.cancelAtPeriodEnd && (
            <p className="bl-muted">Resume your subscription before changing plans.</p>
          )}
        </section>
      )}

      {/* ─── Invoices ─────────────────────────────────────────────────── */}
      <section className="bl-card">
        <div className="bl-card-label">Invoices</div>
        {invoices.length ? (
          <table className="bl-table">
            <thead>
              <tr><th>Date</th><th>Invoice</th><th>Amount</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{shortDate(inv.created)}</td>
                  <td className="bl-mono">{inv.number ?? "—"}</td>
                  <td>{money(invoiceAmount(inv), inv.currency)}</td>
                  <td><span className={`bl-inv-status ${inv.status ?? ""}`}>{inv.status ?? "—"}</span></td>
                  <td className="bl-right bl-inv-actions">
                    {/* An unpaid invoice needs somewhere to pay it, not just a
                        PDF of what is owed. Stripe's hosted page handles the
                        card entry and any 3DS challenge. */}
                    {!isSettled(inv.status) && inv.hostedUrl && (
                      <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="bl-link bl-link-pay">
                        Pay
                      </a>
                    )}
                    {inv.pdfUrl && (
                      <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="bl-link">PDF</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="bl-muted">No invoices yet.</p>
        )}
        {invoicesHasMore && (
          <button className="bl-btn bl-more-btn" disabled={loadingMore} onClick={loadMoreInvoices}>
            {loadingMore ? "Loading…" : "Load older invoices"}
          </button>
        )}
      </section>

      {/* ─── Proration quote modal ────────────────────────────────────── */}
      {quote && (
        <div className="bl-overlay" onClick={() => !applying && setQuote(null)}>
          <div className="bl-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{quote.scheduled ? `Downgrade to ${PLAN_META[quote.toPlan].label}` : `Switch to ${PLAN_META[quote.toPlan].label}`}</h3>
            {/* A downgrade has no proration to show — quoting "Due now $0.00"
                under an empty line-item list reads like a broken calculation.
                State what actually happens and when instead. */}
            {quote.scheduled ? (
              <div className="bl-quote">
                <p className="bl-quote-sched">
                  You&apos;ll stay on <strong>{quote.fromPlan ? PLAN_META[quote.fromPlan].label : "your plan"}</strong>{" "}
                  with your current limits until <strong>{shortDate(quote.effectiveAt ?? null)}</strong>, the end of
                  the period you&apos;ve already paid for.
                </p>
                <div className="bl-quote-total">
                  <span>Due now</span>
                  <span>{money(0, quote.currency)}</span>
                </div>
                <p className="bl-quote-note">
                  Then {money(quote.nextRenewalAmount, quote.currency)}/month from{" "}
                  {shortDate(quote.effectiveAt ?? null)}. You can cancel this before it takes effect.
                </p>
              </div>
            ) : (
            <div className="bl-quote">
              {quote.lines.map((l, i) => (
                <div key={i} className="bl-quote-line">
                  <span>{l.description ?? "Adjustment"}</span>
                  <span className={l.amount < 0 ? "credit" : ""}>{money(l.amount, quote.currency)}</span>
                </div>
              ))}
              {quote.balanceApplied > 0 && (
                <div className="bl-quote-line">
                  <span>Account credit applied</span>
                  <span className="credit">-{money(quote.balanceApplied, quote.currency)}</span>
                </div>
              )}
              <div className="bl-quote-total">
                <span>{quote.dueNow > 0 ? "Charged now" : "Due now"}</span>
                <span>{money(quote.dueNow, quote.currency)}</span>
              </div>
              {quote.creditedToBalance > 0 && (
                <p className="bl-quote-note">
                  {money(quote.creditedToBalance, quote.currency)} credit will be applied to your next invoice.
                </p>
              )}
              {quote.balanceRemaining > 0 && (
                <p className="bl-quote-note">
                  {money(quote.balanceRemaining, quote.currency)} credit remains on your account.
                </p>
              )}
              <p className="bl-quote-note">
                Then {money(quote.nextRenewalAmount, quote.currency)}/month from {shortDate(quote.nextRenewal)}.
              </p>
            </div>
            )}
            <div className="bl-form-actions">
              <button className="bl-btn" disabled={applying} onClick={() => setQuote(null)}>Cancel</button>
              <button className="bl-btn bl-btn-primary" disabled={applying} onClick={applyPlan}>
                {applying
                  ? "Applying…"
                  : quote.scheduled
                    ? "Schedule downgrade"
                    : quote.dueNow > 0
                      ? `Pay ${money(quote.dueNow, quote.currency)}`
                      : "Confirm switch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel modal ─────────────────────────────────────────────── */}
      {cancelOpen && (
        <div className="bl-overlay" onClick={() => !cancelBusy && setCancelOpen(false)}>
          <div className="bl-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Cancel subscription?</h3>
            <p>
              Your API key keeps working until <strong>{shortDate(sub?.currentPeriodEnd ?? null)}</strong>, the end
              of the period you&apos;ve already paid for. After that it stops working and you won&apos;t be billed
              again. You can resume any time before then.
            </p>
            <div className="bl-form-actions">
              <button className="bl-btn" disabled={cancelBusy} onClick={() => setCancelOpen(false)}>
                Keep subscription
              </button>
              <button className="bl-btn bl-btn-danger" disabled={cancelBusy} onClick={() => setCancellation(false)}>
                {cancelBusy ? "Cancelling…" : "Cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Remove card confirm ──────────────────────────────────────── */}
      {confirmRemove && (
        <div className="bl-overlay" onClick={() => setConfirmRemove(null)}>
          <div className="bl-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{removeError ? "Can't remove this card" : "Remove card?"}</h3>
            <p>
              {removeError
                ? removeError.message
                : `${brandLabel(confirmRemove.brand)} ending ${confirmRemove.last4} will be removed from your account.`}
            </p>
            <div className="bl-form-actions">
              <button className="bl-btn" onClick={() => setConfirmRemove(null)}>
                {removeError ? "Close" : "Cancel"}
              </button>
              {removeError?.code === "last_card" ? (
                // The refusal names the fix — adding another card — so make the
                // button do it rather than making them find it again.
                <button
                  className="bl-btn bl-btn-primary"
                  onClick={() => {
                    setConfirmRemove(null);
                    setRemoveError(null);
                    startAddCard();
                  }}
                >
                  Add another card
                </button>
              ) : removeError ? null : (
                <button
                  className="bl-btn bl-btn-danger"
                  disabled={busyCard === confirmRemove.id}
                  onClick={() => removeCard(confirmRemove)}
                >
                  {busyCard === confirmRemove.id ? "Removing…" : "Remove card"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .bl-wrap { max-width: 960px; margin: 0 auto; padding: 40px 32px 80px; }
      .bl-center { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
      .bl-spinner { width: 28px; height: 28px; border: 3px solid #e5e7eb; border-top-color: #0052cc; border-radius: 50%; animation: bl-spin 0.7s linear infinite; }
      @keyframes bl-spin { to { transform: rotate(360deg); } }
      .bl-empty-box { text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 40px; }
      .bl-empty-box h2 { font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 6px; }
      .bl-empty-box p { font-size: 14px; color: #6b7280; margin: 0 0 20px; }

      .bl-head { margin-bottom: 28px; }
      .bl-head h1 { font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.4px; margin: 0 0 4px; }
      .bl-head p { font-size: 14px; color: #6b7280; margin: 0; }

      .bl-banner { border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .bl-banner.ok { background: #dcfce7; border: 1px solid #86efac; color: #166534; font-weight: 600; }
      .bl-banner.bad { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-weight: 600; }
      .bl-banner.warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-weight: 600; }

      .bl-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; margin-bottom: 20px; }
      .bl-card-label { font-size: 11px; font-weight: 700; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 18px; }

      .bl-sub-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      .bl-sub-plan { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.3px; }
      .bl-sub-meta { font-size: 13px; color: #6b7280; margin-top: 2px; }
      .bl-status { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; white-space: nowrap; }
      .bl-status.ok { background: #dcfce7; color: #166534; }
      .bl-status.warn { background: #fffbeb; color: #92400e; }
      .bl-status.bad { background: #fef2f2; color: #dc2626; }
      .bl-kv { display: flex; justify-content: space-between; font-size: 14px; color: #6b7280; padding: 12px 0; border-top: 1px solid #f3f4f6; }
      .bl-kv strong { color: #111827; font-weight: 600; }
      .bl-link-danger { background: none; border: none; color: #dc2626; font-size: 13px; font-weight: 600; cursor: pointer; padding: 12px 0 0; font-family: inherit; }
      .bl-link-danger:hover { text-decoration: underline; }

      .bl-cards { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
      .bl-pm { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; flex-wrap: wrap; }
      .bl-pm.default { border-color: #bfdbfe; background: #f8fbff; }
      .bl-pm-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .bl-pm-brand { font-size: 13px; font-weight: 700; color: #111827; }
      .bl-pm-num { font-size: 14px; color: #374151; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .bl-pm-exp { font-size: 12px; color: #9ca3af; }
      .bl-pm-exp.expired { color: #dc2626; font-weight: 700; }
      .bl-pm-badge { background: #e6f2ff; color: #0052cc; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
      .bl-pm-actions { display: flex; gap: 8px; }
      .bl-pm-note { flex-basis: 100%; margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: #9ca3af; }

      .bl-addcard { border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-top: 4px; }
      .bl-add-btn { display: inline-block; }

      .bl-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .bl-plan { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; position: relative; }
      .bl-plan.current { border-color: #0052cc; background: #f8fbff; }
      .bl-plan-badge { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #0052cc; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 10px; }
      .bl-plan-name { font-size: 14px; font-weight: 700; color: #111827; }
      .bl-plan-price { font-size: 22px; font-weight: 800; color: #111827; margin: 4px 0 6px; letter-spacing: -0.5px; }
      .bl-plan-sub { font-size: 12px; color: #6b7280; }
      .bl-plan-btn { width: 100%; margin-top: 14px; }
      .bl-plan-note { margin: -6px 0 18px; }

      .bl-table { width: 100%; border-collapse: collapse; font-size: 14px; }
      .bl-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; padding: 0 12px 10px 0; font-weight: 700; }
      .bl-table td { padding: 12px 12px 12px 0; border-top: 1px solid #f3f4f6; color: #374151; }
      .bl-right { text-align: right; }
      .bl-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #6b7280; }
      .bl-inv-status { font-size: 12px; font-weight: 600; text-transform: capitalize; color: #6b7280; }
      .bl-inv-status.paid { color: #166534; }
      .bl-inv-status.open { color: #92400e; }
      .bl-link { color: #0052cc; text-decoration: none; font-weight: 600; font-size: 13px; }
      .bl-link:hover { text-decoration: underline; }

      .bl-btn { padding: 8px 16px; border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; font-family: inherit; transition: background 0.15s, border-color 0.15s; }
      .bl-btn:hover:not(:disabled) { background: #f9fafb; }
      .bl-btn:disabled { opacity: 0.55; cursor: default; }
      .bl-btn-sm { padding: 6px 12px; font-size: 12px; }
      .bl-btn-primary { background: #0052cc; border-color: #0052cc; color: #fff; }
      .bl-btn-primary:hover:not(:disabled) { background: #003a99; }
      .bl-btn-danger { background: #dc2626; border-color: #dc2626; color: #fff; }
      .bl-btn-danger:hover:not(:disabled) { background: #b91c1c; }
      .bl-btn-ghost { border-color: transparent; color: #9ca3af; }
      .bl-btn-ghost:hover:not(:disabled) { color: #dc2626; background: #fef2f2; }

      .bl-muted { font-size: 13px; color: #9ca3af; margin: 0 0 16px; }
      .bl-empty { text-align: center; padding: 12px 0; }
      .bl-empty p { font-size: 14px; color: #6b7280; margin: 0 0 16px; }
      .bl-pe-loading { font-size: 13px; color: #9ca3af; padding: 10px 0; }
      .bl-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #dc2626; margin-top: 14px; }
      .bl-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

      .bl-field { margin-bottom: 14px; flex: 1; min-width: 0; }
      .bl-field label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
      .bl-input { width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 9px; font-size: 14px; font-family: inherit; color: #111827; background: #fff; box-sizing: border-box; }
      .bl-input:focus { outline: none; border-color: #0052cc; box-shadow: 0 0 0 3px rgba(0,82,204,0.12); }
      .bl-field-row { display: flex; gap: 12px; }
      .bl-address-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
      .bl-address { font-style: normal; font-size: 14px; color: #374151; line-height: 1.7; }
      .bl-address-empty { margin: 0; }
      .bl-inv-actions { display: flex; gap: 14px; justify-content: flex-end; }
      .bl-link-pay { color: #92400e; }
      .bl-more-btn { margin-top: 16px; width: 100%; }

      .bl-overlay { position: fixed; inset: 0; background: rgba(17,24,39,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
      .bl-modal { background: #fff; border-radius: 14px; padding: 28px; max-width: 440px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
      .bl-modal h3 { font-size: 18px; font-weight: 800; color: #111827; margin: 0 0 10px; }
      .bl-modal p { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; }

      .bl-quote { margin: 18px 0 4px; }
      .bl-quote-line { display: flex; justify-content: space-between; font-size: 14px; color: #374151; padding: 8px 0; }
      .bl-quote-line .credit { color: #166534; font-weight: 600; }
      .bl-quote-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #111827; padding: 12px 0; border-top: 2px solid #111827; margin-top: 4px; }
      .bl-quote-sched { font-size: 14px; color: #374151; line-height: 1.65; margin: 0 0 4px; }
      .bl-quote-note { font-size: 12px; color: #9ca3af; margin: 8px 0 0; }

      @media (max-width: 768px) {
        .bl-wrap { padding: 28px 16px 60px; }
        .bl-plans { grid-template-columns: 1fr; }
        .bl-pm { align-items: flex-start; }
        .bl-table th:nth-child(2), .bl-table td:nth-child(2) { display: none; }
        .bl-field-row { flex-direction: column; gap: 0; }
        .bl-address-row { flex-direction: column; }
      }
    `}</style>
  );
}
