import { describe, it, expect } from "vitest";
import { isTestOrder } from "./notify";

function order(overrides: Partial<Parameters<typeof isTestOrder>[0]> = {}): Parameters<typeof isTestOrder>[0] {
  return {
    email: "buyer@company.com",
    articleTitle: "Latest SEO trends for 2026",
    targetUrl: "https://company.com/contest",
    anchorText: "A/B testing tools",
    requirements: null,
    articleUrl: null,
    originalFileName: null,
    additionalLinks: null,
    ...overrides,
  };
}

describe("isTestOrder", () => {
  it("treats an ordinary order as real, even with latest/contest/testing in it", () => {
    expect(isTestOrder(order())).toBe(false);
  });

  it("flags any email containing test", () => {
    expect(isTestOrder(order({ email: "taimourtest@gmail.com" }))).toBe(true);
    expect(isTestOrder(order({ email: "TEST+3@linkpricer.com" }))).toBe(true);
  });

  it("flags test as a token in any typed value", () => {
    expect(isTestOrder(order({ articleTitle: "test" }))).toBe(true);
    expect(isTestOrder(order({ anchorText: "Test anchor" }))).toBe(true);
    expect(isTestOrder(order({ targetUrl: "https://my-test-site.com" }))).toBe(true);
    expect(isTestOrder(order({ targetUrl: "https://company.com/test1" }))).toBe(true);
    expect(isTestOrder(order({ requirements: "this is a test order" }))).toBe(true);
    expect(isTestOrder(order({ articleUrl: "https://docs.google.com/tests" }))).toBe(true);
  });

  it("checks additional links", () => {
    expect(isTestOrder(order({ additionalLinks: [{ targetUrl: "https://a.com", anchorText: "test" }] }))).toBe(true);
    expect(isTestOrder(order({ additionalLinks: [{ targetUrl: "https://a.com", anchorText: "latest" }] }))).toBe(false);
  });
});
