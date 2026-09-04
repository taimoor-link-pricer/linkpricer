import { describe, expect, it, vi, beforeEach } from "vitest";

/** Just enough of the customer-update body for the assertions below. */
type CustomerUpdate = { name?: string; address?: Record<string, string> };

const stripeMock = {
  customers: {
    update: vi.fn<(id: string, params: CustomerUpdate) => Promise<unknown>>(async () => ({
      deleted: undefined,
      name: null,
      address: { line1: "A", line2: null, city: null, state: null, postal_code: null, country: "LT" },
    })),
  },
};

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  stripe: stripeMock,
}));
vi.mock("@/lib/billing-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing-session")>()),
  billingContextWithCustomer: vi.fn(async () => ({ userId: "u1", email: "a@b.c", customerId: "cus_1" })),
}));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/developers/billing/details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never);

const valid = { line1: "Test St 1", country: "LT" };

beforeEach(() => vi.clearAllMocks());

// Regression: `name: name || undefined` meant "leave unchanged", so a customer
// who put the wrong company name on their invoices could never remove it.
describe("clearing fields", () => {
  it("sends an empty name so it can actually be cleared", async () => {
    const res = await post({ ...valid, name: "" });
    expect(res.status).toBe(200);
    expect(stripeMock.customers.update.mock.calls[0]![1]).toMatchObject({ name: "" });
  });

  it("sends empty address lines rather than omitting them", async () => {
    await post({ ...valid, name: "X", line2: "", city: "" });
    const params = stripeMock.customers.update.mock.calls[0]![1];
    expect(params.address).toMatchObject({ line2: "", city: "" });
  });
});

// Regression: the country was sliced to two characters BEFORE validation, so
// "LITHUANIA" was silently stored as "LI" — Liechtenstein — with a 200.
describe("country validation", () => {
  it("rejects a full country name instead of truncating it to another country", async () => {
    const res = await post({ line1: "X", country: "LITHUANIA" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_country" });
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it("rejects a well-formed code that is not a real country", async () => {
    const res = await post({ line1: "X", country: "ZZ" });
    expect(res.status).toBe(400);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it("accepts a lowercase code and normalises it", async () => {
    const res = await post({ line1: "X", country: "lt" });
    expect(res.status).toBe(200);
    expect(stripeMock.customers.update.mock.calls[0]![1].address).toMatchObject({ country: "LT" });
  });
});

describe("required fields", () => {
  it("requires a street line", async () => {
    const res = await post({ country: "LT" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_line1" });
  });

  it("rejects an empty body without calling Stripe", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(stripeMock.customers.update).not.toHaveBeenCalled();
  });

  it("truncates over-long input rather than rejecting it", async () => {
    await post({ ...valid, name: "x".repeat(500) });
    expect(stripeMock.customers.update.mock.calls[0]![1].name).toHaveLength(150);
  });
});
