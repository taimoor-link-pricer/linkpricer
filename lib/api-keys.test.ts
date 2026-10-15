import { describe, it, expect } from "vitest";
import { keyStatus, parseAdminKeyFields } from "@/lib/api-keys";

const NOW = new Date("2026-10-09T12:00:00Z");

describe("keyStatus", () => {
  const base = { isActive: true, blockedAt: null, expiresAt: null };
  it("is active with no block and no expiry", () => {
    expect(keyStatus(base, NOW)).toBe("active");
  });
  it("is active until the expiry instant, expired from it", () => {
    expect(keyStatus({ ...base, expiresAt: "2026-10-09T12:00:01Z" }, NOW)).toBe("active");
    expect(keyStatus({ ...base, expiresAt: "2026-10-09T12:00:00Z" }, NOW)).toBe("expired");
    expect(keyStatus({ ...base, expiresAt: "2026-01-01T00:00:00Z" }, NOW)).toBe("expired");
  });
  it("reports blocked over expired, and revoked over both", () => {
    const both = { ...base, blockedAt: "2026-10-01T00:00:00Z", expiresAt: "2026-01-01T00:00:00Z" };
    expect(keyStatus(both, NOW)).toBe("blocked");
    expect(keyStatus({ ...both, isActive: false }, NOW)).toBe("revoked");
  });
});

describe("parseAdminKeyFields", () => {
  const parse = (input: Record<string, unknown>) => parseAdminKeyFields(input, NOW);

  it("returns only the fields that were sent", () => {
    expect(parse({})).toEqual({ ok: true, fields: {} });
    expect(parse({ monthlyLimit: 500 })).toEqual({ ok: true, fields: { monthlyLimit: 500 } });
  });
  it("normalises a full, valid input", () => {
    expect(parse({ name: "  Partner  ", monthlyLimit: 10000, perMinuteLimit: 60, expiresAt: "2027-01-07T23:59:59.000Z" })).toEqual({
      ok: true,
      fields: { name: "Partner", monthlyLimit: 10000, perMinuteLimit: 60, expiresAt: "2027-01-07T23:59:59.000Z" },
    });
  });
  it("treats null and empty expiry as never-expires", () => {
    expect(parse({ expiresAt: null })).toEqual({ ok: true, fields: { expiresAt: null } });
    expect(parse({ expiresAt: "" })).toEqual({ ok: true, fields: { expiresAt: null } });
  });
  it.each([
    [{ monthlyLimit: 0 }],
    [{ monthlyLimit: -5 }],
    [{ monthlyLimit: 1.5 }],
    [{ monthlyLimit: "1000" }],
    [{ monthlyLimit: NaN }],
    [{ monthlyLimit: 10_000_001 }],
    [{ perMinuteLimit: 0 }],
    [{ perMinuteLimit: 601 }],
    [{ name: "   " }],
    [{ name: "x".repeat(121) }],
    [{ expiresAt: "not a date" }],
    [{ expiresAt: 12345 }],
    [{ expiresAt: "2026-10-09T12:00:00Z" }],
    [{ expiresAt: "2020-01-01T00:00:00Z" }],
  ])("rejects %j", (input) => {
    expect(parse(input as Record<string, unknown>).ok).toBe(false);
  });
});
