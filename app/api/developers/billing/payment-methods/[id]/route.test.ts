import { describe, expect, it, vi, beforeEach } from "vitest";

const stripeMock = {
  paymentMethods: { retrieve: vi.fn(), list: vi.fn(), detach: vi.fn(async () => ({})) },
  customers: {
    retrieve: vi.fn(),
    update: vi.fn<(id: string, params: unknown) => Promise<unknown>>(async () => ({})),
  },
  subscriptions: { list: vi.fn(), update: vi.fn(async () => ({})) },
};

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  stripe: stripeMock,
}));
vi.mock("@/lib/billing-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing-session")>()),
  billingContext: vi.fn(async () => ({ userId: "u1", email: "a@b.c", customerId: "cus_1" })),
}));

const { DELETE, POST } = await import("./route");

const CARD = (id: string, expMonth = 12, expYear = 2099) => ({
  id, customer: "cus_1", card: { exp_month: expMonth, exp_year: expYear },
});
const ACTIVE = {
  id: "sub_1", status: "active", cancel_at_period_end: false,
  default_payment_method: "pm_1", items: { data: [{ id: "si_1" }] },
};

const call = (fn: typeof DELETE, id: string) =>
  fn(new Request("http://localhost", { method: "DELETE" }) as never, { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  stripeMock.paymentMethods.retrieve.mockImplementation(async (id: string) => CARD(id));
  stripeMock.customers.retrieve.mockResolvedValue({
    deleted: undefined, invoice_settings: { default_payment_method: "pm_1" },
  });
  stripeMock.subscriptions.list.mockResolvedValue({ data: [ACTIVE] });
});

describe("the last card on a renewing subscription", () => {
  it("cannot be removed — that would guarantee a failed renewal later", async () => {
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_1")] });
    const res = await call(DELETE, "pm_1");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "last_card" });
    expect(stripeMock.paymentMethods.detach).not.toHaveBeenCalled();
  });

  it("can be removed once the subscription is set to cancel", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ ...ACTIVE, cancel_at_period_end: true }] });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_1")] });
    const res = await call(DELETE, "pm_1");
    expect(res.status).toBe(200);
    expect(stripeMock.paymentMethods.detach).toHaveBeenCalledWith("pm_1");
  });

  it("can be removed when there is no subscription at all", async () => {
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_1")] });
    expect((await call(DELETE, "pm_1")).status).toBe(200);
  });
});

describe("replacing the default after a removal", () => {
  it("prefers a card that can actually be charged over an expired one", async () => {
    stripeMock.paymentMethods.list.mockResolvedValue({
      data: [CARD("pm_1"), CARD("pm_expired", 1, 2020), CARD("pm_good")],
    });
    await call(DELETE, "pm_1");
    expect(stripeMock.customers.update).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_good" },
    });
  });

  it("does not re-point anything when a non-default card is removed", async () => {
    stripeMock.paymentMethods.list.mockResolvedValue({ data: [CARD("pm_1"), CARD("pm_2")] });
    await call(DELETE, "pm_2");
    expect(stripeMock.paymentMethods.detach).toHaveBeenCalledWith("pm_2");
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });
});

describe("make default", () => {
  it("writes the customer AND the subscription, or the next renewal uses the old card", async () => {
    const res = await POST(new Request("http://localhost", { method: "POST" }) as never, {
      params: Promise.resolve({ id: "pm_2" }),
    });
    expect(res.status).toBe(200);
    expect(stripeMock.customers.update).toHaveBeenCalledWith("cus_1", {
      invoice_settings: { default_payment_method: "pm_2" },
    });
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith("sub_1", { default_payment_method: "pm_2" });
  });
});
