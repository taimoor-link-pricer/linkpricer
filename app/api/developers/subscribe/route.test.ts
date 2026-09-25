import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.STRIPE_PRICE_STARTER = "price_starter";
process.env.STRIPE_PRICE_GROWTH = "price_growth";
process.env.STRIPE_PRICE_SCALE = "price_scale";

const calls: string[] = [];

type CustomerUpdate = {
  invoice_settings?: { default_payment_method?: string };
  name?: string;
  address?: Record<string, string>;
};

const ADDRESS = {
  line1: "Gedimino pr. 1",
  line2: null,
  city: "Vilnius",
  state: null,
  postal_code: "01103",
  country: "LT",
};

const stripeMock = {
  subscriptions: {
    list: vi.fn(async () => ({ data: [] })),
    create: vi.fn(async () => {
      calls.push("subscriptions.create");
      return { id: "sub_1", status: "incomplete", latest_invoice: { confirmation_secret: { client_secret: "pi_secret" } } };
    }),
  },
  customers: {
    update: vi.fn<(id: string, params: CustomerUpdate) => Promise<unknown>>(async () => {
      calls.push("customers.update");
      return {};
    }),
  },
  paymentMethods: { retrieve: vi.fn() },
};

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  stripe: stripeMock,
}));
vi.mock("@/lib/db", () => ({ db: { execute: vi.fn(async () => ({ rows: [] })) } }));
vi.mock("@/lib/billing-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing-session")>()),
  billingContextWithCustomer: vi.fn(async () => ({ userId: "u1", email: "a@b.c", customerId: "cus_1" })),
}));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/developers/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never);

const card = (billing_details: unknown, customer = "cus_1") => ({ id: "pm_1", customer, billing_details });

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("POST /api/developers/subscribe — billing address", () => {
  it("copies the card's billing name and address onto the Customer before subscribing", async () => {
    stripeMock.paymentMethods.retrieve.mockResolvedValue(card({ name: "Jonas Jonaitis", address: ADDRESS }));

    const res = await post({ plan: "starter", paymentMethodId: "pm_1" });
    expect(res.status).toBe(200);

    const [id, params] = stripeMock.customers.update.mock.calls[0];
    expect(id).toBe("cus_1");
    expect(params.invoice_settings?.default_payment_method).toBe("pm_1");
    expect(params.name).toBe("Jonas Jonaitis");
    // Nulls become empty strings so a stale line2/state from an older address is cleared.
    expect(params.address).toEqual({
      line1: "Gedimino pr. 1", line2: "", city: "Vilnius", state: "", postal_code: "01103", country: "LT",
    });
    // Order matters: the first invoice is finalized inside subscriptions.create.
    expect(calls).toEqual(["customers.update", "subscriptions.create"]);
  });

  it("leaves an existing Customer address alone when the card carries none", async () => {
    stripeMock.paymentMethods.retrieve.mockResolvedValue(card({ name: null, address: { country: "LT", line1: null } }));

    await post({ plan: "starter", paymentMethodId: "pm_1" });

    const [, params] = stripeMock.customers.update.mock.calls[0];
    expect(params).toEqual({ invoice_settings: { default_payment_method: "pm_1" } });
  });

  it("refuses a payment method that belongs to another customer, and subscribes nothing", async () => {
    stripeMock.paymentMethods.retrieve.mockResolvedValue(card({ name: "X", address: ADDRESS }, "cus_other"));

    const res = await post({ plan: "starter", paymentMethodId: "pm_1" });
    expect(res.status).toBe(404);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.create).not.toHaveBeenCalled();
  });
});
