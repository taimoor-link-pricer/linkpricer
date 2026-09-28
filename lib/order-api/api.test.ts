/**
 * The order API end to end through its real route handlers, with the database,
 * Firestore, notifications and the catalog replaced by in-memory fakes. Covers
 * what the robot's acceptance checklist depends on: auth, validation,
 * idempotency (including a reference reused for a different order), the price
 * check, test/live isolation, follow-up failures, rate limits and logging.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

const LIVE_KEY = "lp_order_live_" + "a".repeat(48);
const TEST_KEY = "lp_order_test_" + "b".repeat(48);
const OTHER_KEY = "lp_order_live_" + "c".repeat(48);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const USER = "user-karolis";
const LISTING = "M-11111111-1111-1111-1111-111111111111";

const state = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  sandbox: new Map<string, Record<string, unknown>>(),
  events: [] as Record<string, unknown>[],
  price: "240.00",
  listingExists: true,
  failEvent: false,
  failInsert: false,
  notified: 0,
  lastWhereId: null as string | null,
}));

vi.mock("@/lib/db", () => {
  const select = () => ({
    from: (table: { __name?: string }) => ({
      where: () => ({
        limit: async () => {
          if (table.__name === "users") return [{ id: "user-karolis", email: "butkus@linkpricer.com", companyId: null }];
          return state.lastWhereId && state.orders.has(state.lastWhereId) ? [state.orders.get(state.lastWhereId)] : [];
        },
      }),
    }),
  });
  return {
    db: {
      select,
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (state.failInsert) throw new Error("db down");
              if (state.orders.has(v.id as string)) return [];
              const row = { ...v, createdAt: "2026-09-28 08:52:39.240372+00", liveUrl: null };
              state.orders.set(v.id as string, row);
              return [row];
            },
          }),
        }),
      }),
    },
  };
});
// eq(orders.id, x) — remember which id the next select is for.
vi.mock("drizzle-orm", async (orig) => {
  const real = await orig<typeof import("drizzle-orm")>();
  return { ...real, eq: (_col: unknown, v: unknown) => (state.lastWhereId = String(v)) };
});
vi.mock("@/lib/db/schema", () => ({ orders: { __name: "orders", id: "id" }, users: { __name: "users", id: "id" } }));
vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: state.sandbox.has(id), data: () => ({ ...state.sandbox.get(id) }) }),
        create: async (d: Record<string, unknown>) => {
          if (state.sandbox.has(id)) throw Object.assign(new Error("exists"), { code: 6 });
          state.sandbox.set(id, d);
        },
      }),
    }),
  },
}));
vi.mock("@/lib/currency", () => ({ getUsdRates: async () => ({ USD: 1, EUR: 1.087 }) }));
vi.mock("@/lib/orders/events", () => ({
  ORDER_EVENT_TYPES: { statusChanged: "order_status_changed" },
  recordOrderEvent: async (_db: unknown, e: Record<string, unknown>) => {
    if (state.failEvent) throw new Error("events table down");
    state.events.push(e);
  },
  getOrderEvents: async () => [],
}));
vi.mock("@/lib/orders/firestore-mirror", () => ({ mirrorOrderToFirestore: () => {} }));
vi.mock("@/lib/orders/notify", () => ({ notifyNewOrders: async () => void state.notified++ }));
vi.mock("@/lib/notifications/orders", () => ({ notifyOrdersPlaced: async () => {} }));
vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => void fn() };
});
vi.mock("./listings", async (orig) => {
  const real = await orig<typeof import("./listings")>();
  return {
    ...real,
    findListing: async (id: string, niche: string) =>
      state.listingExists && id === LISTING && niche === "igaming"
        ? { listing: { listing_id: LISTING, vendor_id: "adsy.com", price: state.price, currency: "USD", turnaround_days: 5 }, marketplacePriceUsd: 200, domain: "example.com" }
        : null,
    getListings: async () => [],
  };
});

process.env.ORDER_API_KEYS = JSON.stringify([
  { name: "robot live", hash: sha(LIVE_KEY), userId: USER, mode: "live" },
  { name: "robot sandbox", hash: sha(TEST_KEY), userId: USER, mode: "test" },
  { name: "someone else", hash: sha(OTHER_KEY), userId: "user-other", mode: "live" },
]);

const { POST, GET: GET_BY_REF } = await import("@/app/api/v1/orders/route");
const { GET: GET_BY_ID } = await import("@/app/api/v1/orders/[orderId]/route");
const { GET: LISTINGS } = await import("@/app/api/v1/listings/route");

let refCounter = 0;
const body = (over: Record<string, unknown> = {}) => ({
  client_reference: `ORD-${++refCounter}-1`,
  listing_id: LISTING,
  niche: "igaming",
  expected_price: "240.00",
  currency: "USD",
  target_url: "https://client.com/page",
  anchor: "best casinos",
  article: { mode: "buyer_doc", url: "https://docs.google.com/document/d/abc" },
  ...over,
});
function post(key: string | null, payload: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("https://x.test/api/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );
}
const get = (url: string, key = LIVE_KEY) => new NextRequest(url, { headers: { authorization: `Bearer ${key}` } });
const byId = (id: string, key = LIVE_KEY) => GET_BY_ID(get(`https://x.test/api/v1/orders/${id}`, key), { params: Promise.resolve({ orderId: id }) });

let logs: string[];
let testMinute = 0;
beforeEach(() => {
  state.orders.clear();
  state.sandbox.clear();
  state.events.length = 0;
  state.price = "240.00";
  state.listingExists = true;
  state.failEvent = false;
  state.failInsert = false;
  state.notified = 0;
  logs = [];
  vi.spyOn(console, "log").mockImplementation((l) => void logs.push(String(l)));
  vi.spyOn(console, "error").mockImplementation((l) => void logs.push(String(l)));
  vi.useFakeTimers({ toFake: ["Date"] });
  // A new minute per test, so rate-limit windows never leak between tests.
  vi.setSystemTime(new Date(Date.UTC(2026, 8, 28, 0, ++testMinute)));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("authentication", () => {
  it("refuses a missing, wrong, or malformed key", async () => {
    for (const key of [null, "lp_order_live_nope"]) {
      const res = await post(key, body());
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("unauthorized");
    }
    const basic = await POST(new NextRequest("https://x.test/api/v1/orders", { method: "POST", headers: { authorization: "Basic abc" }, body: "{}" }));
    expect(basic.status).toBe(401);
  });

  it("refuses every key when ORDER_API_KEYS is missing or broken", async () => {
    const saved = process.env.ORDER_API_KEYS;
    for (const v of [undefined, "not json", "{}"]) {
      if (v === undefined) delete process.env.ORDER_API_KEYS;
      else process.env.ORDER_API_KEYS = v;
      expect((await post(LIVE_KEY, body())).status).toBe(401);
    }
    process.env.ORDER_API_KEYS = saved;
  });

  it("accepts the key in either header", async () => {
    const res = await LISTINGS(new NextRequest("https://x.test/api/v1/listings?domain=example.com", { headers: { "x-api-key": LIVE_KEY } }));
    expect(res.status).toBe(200);
  });
});

describe("validation", () => {
  it.each([
    ["not JSON", "{nope"],
    ["empty body", {}],
    ["price as a number", body({ expected_price: 240 })],
    ["price with 3 decimals", body({ expected_price: "240.001" })],
    ["non-USD", body({ currency: "EUR" })],
    ["javascript: target", body({ target_url: "javascript:alert(1)" })],
    ["over-long target", body({ target_url: "https://client.com/" + "a".repeat(2100) })],
    ["blank anchor", body({ anchor: "   " })],
    ["unknown niche", body({ niche: "casino" })],
    ["malformed listing id", body({ listing_id: "L-88213" })],
    ["reference with spaces", body({ client_reference: "ORD 1" })],
    ["brief missing", body({ article: { mode: "vendor_writes" } })],
    ["unknown article mode", body({ article: { mode: "ai_writes" } })],
  ])("rejects %s with invalid_request and places nothing", async (_n, payload) => {
    const res = await post(LIVE_KEY, payload);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
    expect(state.orders.size).toBe(0);
  });
});

describe("placing an order", () => {
  it("places it once, with the listing price, and notifies the team", async () => {
    const res = await post(LIVE_KEY, body());
    expect(res.status).toBe(201);
    const o = await res.json();
    expect(o).toMatchObject({ status: "placed", price: "240.00", currency: "USD", test: false, created_at: "2026-09-28T08:52:39.240Z" });
    expect(state.orders.size).toBe(1);
    const row = [...state.orders.values()][0];
    expect(row).toMatchObject({ totalAmount: "240.00", selectedPrice: "200.00", contentPrice: "0.00", orderType: "managed", email: "butkus@linkpricer.com" });
    expect(state.events).toHaveLength(1);
    expect(state.notified).toBe(1);
  });

  it("stores a site-written article as site_writes, never 'We Write'", async () => {
    await post(LIVE_KEY, body({ article: { mode: "vendor_writes", brief: "About odds" } }));
    const row = [...state.orders.values()][0];
    expect(row.contentOption).toBe("site_writes");
    expect(row.requirements).toContain("About odds");
  });

  it("returns the same order for a retry — even after the price moved — and places nothing new", async () => {
    const b = body();
    const first = await (await post(LIVE_KEY, b)).json();
    state.price = "999.00";
    const again = await post(LIVE_KEY, { ...b, expected_price: "1.00" });
    expect(again.status).toBe(200);
    expect((await again.json()).order_id).toBe(first.order_id);
    expect(state.orders.size).toBe(1);
    expect(state.notified).toBe(1);
  });

  it("refuses a reference reused for a DIFFERENT order, naming the existing one", async () => {
    const b = body();
    const first = await (await post(LIVE_KEY, b)).json();
    const clash = await post(LIVE_KEY, { ...b, target_url: "https://client.com/other" });
    expect(clash.status).toBe(409);
    const err = (await clash.json()).error;
    expect(err).toMatchObject({ code: "duplicate_reference", order_id: first.order_id });
    expect(state.orders.size).toBe(1);
  });

  it("refuses a stale expected_price with the current price, placing nothing", async () => {
    const res = await post(LIVE_KEY, body({ expected_price: "239.99" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatchObject({ code: "price_changed", current_price: "240.00" });
    expect(state.orders.size).toBe(0);
  });

  it("accepts an equal price written differently", async () => {
    expect((await post(LIVE_KEY, body({ expected_price: "240" }))).status).toBe(201);
  });

  it("refuses a gone listing, or a niche the listing does not sell", async () => {
    state.listingExists = false;
    expect((await (await post(LIVE_KEY, body())).json()).error.code).toBe("listing_unavailable");
    state.listingExists = true;
    expect((await (await post(LIVE_KEY, body({ niche: "adult" }))).json()).error.code).toBe("listing_unavailable");
    expect(state.orders.size).toBe(0);
  });

  it("still answers 201 when the follow-up history write fails after the order is saved", async () => {
    state.failEvent = true;
    const res = await post(LIVE_KEY, body());
    expect(res.status).toBe(201);
    expect(state.orders.size).toBe(1);
    expect(logs.some((l) => l.includes('"followup_failed":"status_event"'))).toBe(true);
  });

  it("answers a retryable server_error with a request id when the database is down", async () => {
    state.failInsert = true;
    const res = await post(LIVE_KEY, body());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("server_error");
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("test mode", () => {
  it("never writes a real order, and keeps its own idempotency", async () => {
    const b = body();
    const first = await post(TEST_KEY, b);
    expect(first.status).toBe(201);
    expect((await first.json()).test).toBe(true);
    expect((await post(TEST_KEY, b)).status).toBe(200);
    expect((await post(TEST_KEY, { ...b, anchor: "other" })).status).toBe(409);
    expect(state.orders.size).toBe(0);
    expect(state.sandbox.size).toBe(1);
    expect(state.notified).toBe(0);
  });

  it("applies to a live key sent with X-Test-Mode: true", async () => {
    const res = await post(LIVE_KEY, body(), { "x-test-mode": "true" });
    expect((await res.json()).test).toBe(true);
    expect(state.orders.size).toBe(0);
  });

  it("keeps test and live orders apart even under the same reference", async () => {
    const b = body();
    const test = await (await post(TEST_KEY, b)).json();
    const live = await (await post(LIVE_KEY, b)).json();
    expect(live.order_id).not.toBe(test.order_id);
    expect((await byId(test.order_id, LIVE_KEY)).status).toBe(404);
  });
});

describe("order status", () => {
  it("finds an order by id and by reference, and only for its own account", async () => {
    const b = body();
    const placed = await (await post(LIVE_KEY, b)).json();
    expect((await byId(placed.order_id)).status).toBe(200);
    expect((await byId(placed.order_id.toUpperCase())).status).toBe(200);
    expect((await byId(placed.order_id, OTHER_KEY)).status).toBe(404);
    const ref = await GET_BY_REF(get(`https://x.test/api/v1/orders?client_reference=${b.client_reference}`));
    expect((await ref.json()).orders.map((o: { order_id: string }) => o.order_id)).toEqual([placed.order_id]);
    const none = await GET_BY_REF(get("https://x.test/api/v1/orders?client_reference=NEVER-1"));
    expect((await none.json()).orders).toEqual([]);
  });

  it("404s an unknown or garbage id, 400s a missing reference", async () => {
    expect((await byId("00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await byId("../../etc")).status).toBe(404);
    expect((await GET_BY_REF(get("https://x.test/api/v1/orders"))).status).toBe(400);
  });
});

describe("rate limits", () => {
  it("allows 10 order calls a minute, then 429 with Retry-After, per key", async () => {
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await post(OTHER_KEY, {})).status);
    expect(codes.slice(0, 10).every((c) => c === 400)).toBe(true);
    const limited = await post(OTHER_KEY, {});
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another key is unaffected.
    expect((await post(TEST_KEY, {})).status).toBe(400);
  });
});

describe("logging", () => {
  it("writes one structured line per request, without the key or the body", async () => {
    const b = body({ article: { mode: "vendor_writes", brief: "SECRET BRIEF" } });
    await post(LIVE_KEY, b);
    const lines = logs.filter((l) => l.startsWith('{"event":"order_api"'));
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]);
    expect(line).toMatchObject({ method: "POST", status: 201, key: "robot live", mode: "live", outcome: "placed", client_reference: b.client_reference });
    expect(lines[0]).not.toContain(LIVE_KEY);
    expect(lines[0]).not.toContain("SECRET BRIEF");
  });

  it("records the error code on refusals", async () => {
    await post(LIVE_KEY, body({ expected_price: "1.00" }));
    const line = JSON.parse(logs.find((l) => l.startsWith('{"event":"order_api"'))!);
    expect(line).toMatchObject({ status: 409, error_code: "price_changed", outcome: "price_changed", current_price: "240.00" });
  });
});
