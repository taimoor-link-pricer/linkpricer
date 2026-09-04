import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.STRIPE_PRICE_STARTER = "price_starter";
process.env.STRIPE_PRICE_GROWTH = "price_growth";
process.env.STRIPE_PRICE_SCALE = "price_scale";

const calls: string[] = [];

/** Just enough of the schedule-update body for the phase assertions below. */
type SchedulePhases = {
  phases: { items: { price: string }[]; start_date?: number; end_date?: number | null }[];
};

const stripeMock = {
  subscriptions: {
    list: vi.fn(),
    update: vi.fn(async () => {
      calls.push("subscriptions.update");
      return { items: { data: [{ price: { id: "price_scale" } }] }, status: "active" };
    }),
  },
  subscriptionSchedules: {
    create: vi.fn(async () => ({ id: "sched_1", phases: [] })),
    retrieve: vi.fn(async () => ({ id: "sched_1", phases: [] })),
    update: vi.fn<(id: string, params: SchedulePhases) => Promise<unknown>>(async () => ({ id: "sched_1" })),
    release: vi.fn(async () => {
      calls.push("subscriptionSchedules.release");
      return { id: "sched_1", status: "released" };
    }),
  },
  invoices: { createPreview: vi.fn() },
};

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  stripe: stripeMock,
}));
// `batch` is part of the surface this route uses now — the two writes that
// follow a successful plan change go through one transaction, so a mock
// without it turns a passing route into a 500 that looks like a real failure.
vi.mock("@/lib/db", () => ({
  db: {
    execute: vi.fn(async () => ({ rows: [] })),
    batch: vi.fn(async (queries: unknown[]) => queries.map(() => ({ rows: [] }))),
  },
}));
vi.mock("@/lib/billing-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing-session")>()),
  billingContext: vi.fn(async () => ({ userId: "u1", email: "a@b.c", customerId: "cus_1" })),
}));

const { POST } = await import("./route");

/** A live Growth subscription that already has a downgrade scheduled. */
function growthWithPendingDowngrade() {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: {},
    schedule: { id: "sched_1", status: "active", phases: [
      { start_date: now - 3600, end_date: now + 3600, items: [{ price: "price_growth" }] },
      { start_date: now + 3600, items: [{ price: "price_starter" }] },
    ] },
    items: { data: [{ id: "si_1", current_period_end: now + 3600, price: { id: "price_growth", currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] },
  };
}

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/developers/billing/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never);

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  stripeMock.subscriptions.list.mockResolvedValue({ data: [growthWithPendingDowngrade()] });
  // A real retrieve returns the schedule with its phases; the bare default
  // would hand the route an empty phase list it rightly refuses to work with.
  stripeMock.subscriptionSchedules.retrieve.mockResolvedValue(
    growthWithPendingDowngrade().schedule as never
  );
});

// Regression: release() ran BEFORE the quote validations, so a request that was
// then rejected still destroyed the customer's pending downgrade on its way out
// — a failed call with a permanent side effect.
describe("an upgrade that fails validation must not touch the pending downgrade", () => {
  it("does not release the schedule when the proration date is missing", async () => {
    const res = await post({ plan: "scale" });
    expect(res.status).toBe(400);
    expect(stripeMock.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  it("does not release the schedule when the quote has expired", async () => {
    const stale = Math.floor(Date.now() / 1000) - 60 * 60; // an hour old, TTL is 15m
    const res = await post({ plan: "scale", prorationDate: stale });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "quote_expired" });
    expect(stripeMock.subscriptionSchedules.release).not.toHaveBeenCalled();
  });

  it("does not release the schedule when the plan is unknown", async () => {
    const res = await post({ plan: "enterprise", prorationDate: Math.floor(Date.now() / 1000) });
    expect(res.status).toBe(400);
    expect(stripeMock.subscriptionSchedules.release).not.toHaveBeenCalled();
  });
});

describe("a valid upgrade over a pending downgrade", () => {
  it("releases the schedule BEFORE updating the subscription", async () => {
    const res = await post({ plan: "scale", prorationDate: Math.floor(Date.now() / 1000) });
    expect(res.status).toBe(200);
    // Order matters: updating underneath a live schedule is reverted at the
    // next phase boundary, so the release has to land first.
    expect(calls).toEqual(["subscriptionSchedules.release", "subscriptions.update"]);
  });
});

describe("downgrade preview", () => {
  it("quotes nothing due now and writes nothing to Stripe", async () => {
    const res = await post({ plan: "starter", preview: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ scheduled: true, dueNow: 0, isUpgrade: false });
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
    expect(stripeMock.subscriptionSchedules.update).not.toHaveBeenCalled();
    expect(stripeMock.invoices.createPreview).not.toHaveBeenCalled();
  });
});

describe("downgrade apply", () => {
  it("schedules the change and leaves the customer on their current plan", async () => {
    const res = await post({ plan: "starter" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ scheduled: true, plan: "growth", scheduledPlan: "starter" });
    // Quota must not move now — they keep what they paid for until renewal.
    expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
  });

  it("builds phase 0 from the RUNNING phase, never the pending one", async () => {
    const now = Math.floor(Date.now() / 1000);
    await post({ plan: "starter" });
    const params = stripeMock.subscriptionSchedules.update.mock.calls[0]![1];
    expect(params.phases[0]!.items[0]!.price).toBe("price_growth");
    expect(params.phases[0]!.start_date).toBe(now - 3600);
    expect(params.phases[1]!.items[0]!.price).toBe("price_starter");
  });
});

describe("a schedule with no usable phase", () => {
  it("refuses with a clear error instead of building a broken schedule", async () => {
    stripeMock.subscriptionSchedules.retrieve.mockResolvedValue({ id: "sched_1", phases: [] } as never);
    const res = await post({ plan: "starter" });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "schedule_failed" });
    expect(stripeMock.subscriptionSchedules.update).not.toHaveBeenCalled();
  });
});
