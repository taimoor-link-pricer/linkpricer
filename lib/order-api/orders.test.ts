import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: {} }));

import { apiStatus, orderIdFor, placeOrderSchema } from "./orders";

describe("orderIdFor", () => {
  it("is stable for one reference and differs across references, accounts and modes", () => {
    const a = orderIdFor("u1", "ORD-1-1", false);
    expect(orderIdFor("u1", "ORD-1-1", false)).toBe(a);
    expect(orderIdFor("u1", "ORD-1-2", false)).not.toBe(a);
    expect(orderIdFor("u2", "ORD-1-1", false)).not.toBe(a);
    expect(orderIdFor("u1", "ORD-1-1", true)).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("apiStatus", () => {
  it("maps our statuses onto the fixed vocabulary", () => {
    expect(apiStatus("confirming_with_marketplace")).toBe("placed");
    expect(apiStatus("waiting_for_publication")).toBe("in_progress");
    expect(apiStatus("price_increase_requested")).toBe("in_progress");
    expect(apiStatus("published")).toBe("published");
    expect(apiStatus("complete")).toBe("completed");
    expect(apiStatus("cancelled")).toBe("cancelled");
    expect(apiStatus("refunded")).toBe("refunded");
    expect(apiStatus("Writing")).toBe("in_progress");
  });
});

describe("placeOrderSchema", () => {
  const base = {
    client_reference: "ORD-0231-1",
    listing_id: "M-11111111-1111-1111-1111-111111111111",
    niche: "igaming",
    expected_price: "240.00",
    currency: "USD",
    target_url: "https://client.com/page",
    anchor: "best crypto casinos",
    article: { mode: "buyer_doc", url: "https://docs.google.com/document/d/x" },
  };

  it("accepts the spec's example body, in both article modes", () => {
    expect(placeOrderSchema.safeParse(base).success).toBe(true);
    expect(placeOrderSchema.safeParse({ ...base, article: { mode: "vendor_writes", brief: "About odds" } }).success).toBe(true);
  });

  it("rejects float money, other currencies, unsafe URLs and odd references", () => {
    expect(placeOrderSchema.safeParse({ ...base, expected_price: 240 }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, target_url: "javascript:alert(1)" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, client_reference: "has space" }).success).toBe(false);
  });
});
