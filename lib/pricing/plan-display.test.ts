import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * The flag is read once at module load (Next inlines it into the bundle), so
 * each mode has to be imported fresh rather than toggled in place.
 */
async function load(flag: string | undefined) {
  vi.resetModules();
  const prev = process.env.NEXT_PUBLIC_HIDE_API_PRICES;
  if (flag === undefined) delete process.env.NEXT_PUBLIC_HIDE_API_PRICES;
  else process.env.NEXT_PUBLIC_HIDE_API_PRICES = flag;
  const mod = await import("./plan-display");
  process.env.NEXT_PUBLIC_HIDE_API_PRICES = prev;
  return mod;
}

afterEach(() => vi.resetModules());

describe("plan price masking", () => {
  it("hides prices when the env var is unset — the safe default", async () => {
    const { API_PRICES_HIDDEN, planPrice } = await load(undefined);
    expect(API_PRICES_HIDDEN).toBe(true);
    expect(planPrice("starter")).toBe("$XX");
    expect(planPrice("growth")).toBe("$YY");
    expect(planPrice("scale", { period: "/mo" })).toBe("$ZZ/mo");
  });

  it("only the exact string 'false' reveals the real prices", async () => {
    const off = await load("false");
    expect(off.API_PRICES_HIDDEN).toBe(false);
    expect(off.planPrice("starter", { period: "/mo" })).toBe("$10/mo");
    expect(off.planPrice("growth", { period: "/mo" })).toBe("$20/mo");
    expect(off.planPrice("scale", { period: "/mo" })).toBe("$50/mo");

    // A typo must fail closed, not leak the price.
    for (const typo of ["False", "0", "no", "", "true"]) {
      const on = await load(typo);
      expect(on.API_PRICES_HIDDEN, `flag=${JSON.stringify(typo)}`).toBe(true);
      expect(on.planPrice("starter")).toBe("$XX");
    }
  });

  it("no real plan figure survives anywhere in a masked string", async () => {
    const { planPrice } = await load(undefined);
    for (const p of ["starter", "growth", "scale"] as const) {
      expect(planPrice(p, { period: "/mo" })).not.toMatch(/\d/);
    }
  });

  it("redacts money strings without changing their shape", async () => {
    const { maskMoney } = await load(undefined);
    expect(maskMoney("$10.00")).toBe("$••.••");
    expect(maskMoney("$1,234.56")).toBe("$•,•••.••");
    expect(maskMoney("€25.00")).toBe("€••.••");
    expect(maskMoney("—")).toBe("—");
  });

  it("leaves money strings alone when prices are shown", async () => {
    const { maskMoney } = await load("false");
    expect(maskMoney("$1,234.56")).toBe("$1,234.56");
  });
});
