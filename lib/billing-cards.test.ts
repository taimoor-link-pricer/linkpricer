import { describe, expect, it, vi, beforeEach } from "vitest";

const stripeMock = {
  paymentMethods: { retrieve: vi.fn(), list: vi.fn() },
  customers: { retrieve: vi.fn(), update: vi.fn(async () => ({})) },
  subscriptions: { list: vi.fn(), update: vi.fn(async () => ({})) },
  invoices: { list: vi.fn(), pay: vi.fn() },
};

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  stripe: stripeMock,
}));

const { assertOwnedCard, adoptSavedCard } = await import("@/lib/billing-cards");
const { BillingError } = await import("@/lib/billing-session");

const CARD = (id: string, expMonth = 12, expYear = 2099) => ({
  id, customer: "cus_1", card: { exp_month: expMonth, exp_year: expYear, brand: "visa", last4: "4242" },
});
const status = async (fn: () => Promise<unknown>) => {
  try { await fn(); return 200; } catch (e) { return e instanceof BillingError ? e.status : 500; }
};

beforeEach(() => {
  vi.clearAllMocks();
  stripeMock.customers.retrieve.mockResolvedValue({ deleted: undefined, invoice_settings: {} });
  stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
  stripeMock.paymentMethods.list.mockResolvedValue({ data: [] });
  stripeMock.invoices.list.mockResolvedValue({ data: [] });
});

// Regression: Stripe's "no such PaymentMethod" 400 for a nonexistent id versus
// our 404 for someone else's made the pair an oracle for which ids are real.
describe("assertOwnedCard", () => {
  it("answers 404 for a nonexistent card, same as for someone else's", async () => {
    stripeMock.paymentMethods.retrieve.mockRejectedValue(Object.assign(new Error("No such PaymentMethod"), { type: "StripeInvalidRequestError" }));
    expect(await status(() => assertOwnedCard("pm_missing", "cus_1"))).toBe(404);
  });

  it("answers 404 for a card belonging to another customer", async () => {
    stripeMock.paymentMethods.retrieve.mockResolvedValue({ ...CARD("pm_x"), customer: "cus_other" });
    expect(await status(() => assertOwnedCard("pm_x", "cus_1"))).toBe(404);
  });

  it("rejects a malformed id before calling Stripe at all", async () => {
    expect(await status(() => assertOwnedCard("not-a-pm", "cus_1"))).toBe(400);
    expect(stripeMock.paymentMethods.retrieve).not.toHaveBeenCalled();
  });

  it("404s when the caller has no Stripe customer yet", async () => {
    expect(await status(() => assertOwnedCard("pm_1", null))).toBe(404);
  });
});

describe("adoptSavedCard promotion policy", () => {
  it("promotes the first card when nothing is default yet", async () => {
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_new")] });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.madeDefault).toBe(true);
    expect(stripeMock.customers.update).toHaveBeenCalled();
  });

  it("leaves a deliberately chosen default alone when a second card is saved", async () => {
    stripeMock.customers.retrieve.mockResolvedValue({
      deleted: undefined, invoice_settings: { default_payment_method: "pm_chosen" },
    });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_chosen"), CARD("pm_new")] });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.madeDefault).toBe(false);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it("takes over when the existing default has expired", async () => {
    stripeMock.customers.retrieve.mockResolvedValue({
      deleted: undefined, invoice_settings: { default_payment_method: "pm_old" },
    });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_old", 1, 2020), CARD("pm_new")] });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.madeDefault).toBe(true);
  });

  it("takes over when the recorded default is no longer attached", async () => {
    stripeMock.customers.retrieve.mockResolvedValue({
      deleted: undefined, invoice_settings: { default_payment_method: "pm_ghost" },
    });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_new")] });
    expect((await adoptSavedCard("cus_1", "pm_new")).madeDefault).toBe(true);
  });
});

describe("adoptSavedCard dunning recovery", () => {
  const pastDue = {
    id: "sub_1", status: "past_due", cancel_at_period_end: false,
    default_payment_method: "pm_dead",
    items: { data: [{ id: "si_1", price: { id: "price_growth" } }] },
  };

  beforeEach(() => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [pastDue] });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_dead"), CARD("pm_new")] });
    stripeMock.invoices.list.mockResolvedValue({ data: [{ id: "in_1", hosted_invoice_url: "https://pay" }] });
  });

  it("promotes the new card and settles the open invoice immediately", async () => {
    stripeMock.invoices.pay.mockResolvedValue({ status: "paid" });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.madeDefault).toBe(true);
    expect(stripeMock.invoices.pay).toHaveBeenCalledWith("in_1", { payment_method: "pm_new", off_session: false });
    expect(r.recovery).toMatchObject({ attempted: true, paid: true });
  });

  it("treats a decline as a partial success — the card is still saved", async () => {
    stripeMock.invoices.pay.mockRejectedValue(Object.assign(new Error("Your card was declined."), { type: "StripeCardError" }));
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.madeDefault).toBe(true);
    expect(r.recovery).toMatchObject({ attempted: true, paid: false, message: "Your card was declined." });
    expect(r.recovery?.invoiceUrl).toBe("https://pay");
  });

  it("hands back the hosted invoice when 3DS leaves the invoice open", async () => {
    stripeMock.invoices.pay.mockResolvedValue({ status: "open", hosted_invoice_url: "https://pay" });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(r.recovery).toMatchObject({ paid: false, invoiceUrl: "https://pay" });
  });

  it("does not attempt payment on a healthy subscription", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...pastDue, status: "active" }] });
    const r = await adoptSavedCard("cus_1", "pm_new");
    expect(stripeMock.invoices.pay).not.toHaveBeenCalled();
    expect(r.recovery).toBeNull();
  });

  it("rethrows a non-Stripe failure instead of reporting a bogus decline", async () => {
    stripeMock.invoices.pay.mockRejectedValue(new TypeError("boom"));
    await expect(adoptSavedCard("cus_1", "pm_new")).rejects.toThrow("boom");
  });
});
