import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * The €25 minimum fee only works if there is exactly ONE place that knows how
 * the fee is calculated. Before this, the 15% was written out by hand in eight
 * places — the orders API, the Analyze price column, the cart, the order
 * detail page, the public API and two docs pages — which is precisely why a
 * $5 order could be charged a 75-cent fee while every surface looked right.
 *
 * So this test greps the app for fee arithmetic outside lib/pricing/fee.ts.
 * It is a drift guard, not a style rule: if it fails, the fix is almost always
 * to call `managedFeeCents()` / `withFeeUsd()` instead of multiplying by hand.
 */

const ROOT = path.resolve(__dirname, "../..");
const SCAN_DIRS = ["app", "components", "lib"];

// Money-shaped fee arithmetic. Deliberately narrow: it looks for a multiply by
// the fee multiplier, which is what hand-rolled fee math always looks like.
const FEE_MATH = /(\*\s*0?\.15\b)|(\*\s*1\.15\b)|(\b1\.15\s*\*)|(\b0\.15\s*\*)/;

// Matches on these lines are not fee math. Each entry says why.
const ALLOWED: Array<{ file: string; contains: string; why: string }> = [
  {
    file: "app/dashboard/orders/[id]/page.tsx",
    contains: "pctFee",
    why: "Recognizes the plain 15% fee on orders placed BEFORE the minimum existed, so their fee line is still labelled 'Management fee' rather than 'Fees & adjustments'. It reads historical data; it never prices anything.",
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

describe("the fee is defined in exactly one place", () => {
  it("has no hand-rolled fee arithmetic outside lib/pricing/fee.ts", () => {
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(dir)) {
        const rel = path.relative(ROOT, file);
        if (rel === path.join("lib", "pricing", "fee.ts")) continue;

        readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          if (!FEE_MATH.test(line)) return;
          // CSS transitions and animation delays use the same numbers.
          if (/animation|transition|Delay|cubic-bezier|box-shadow|rgba/i.test(line)) return;
          if (ALLOWED.some((a) => rel === a.file && line.includes(a.contains))) return;
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        });
      }
    }

    expect(
      offenders,
      `Fee arithmetic found outside lib/pricing/fee.ts:\n\n${offenders.join("\n")}\n\n` +
        `The managed fee is max(15%, €25) — a bare multiply by 0.15 or 1.15 silently drops the €25 ` +
        `minimum, which is how a $5 placement once billed a 75-cent fee. Call managedFeeCents() for a ` +
        `fee in cents, or withFeeUsd() for a customer-facing price, both from lib/pricing/fee.ts. ` +
        `If this really isn't fee math, add it to ALLOWED in this file with a reason.`
    ).toEqual([]);
  });

  it("keeps the allowlist honest — every entry still points at real code", () => {
    // An allowlist entry that no longer matches anything is stale and would
    // quietly permit a future line in that same file.
    for (const entry of ALLOWED) {
      const full = path.join(ROOT, entry.file);
      const hit = readFileSync(full, "utf8")
        .split("\n")
        .some((line) => FEE_MATH.test(line) && line.includes(entry.contains));
      expect(hit, `stale allowlist entry: ${entry.file} no longer has fee math containing "${entry.contains}"`).toBe(true);
    }
  });
});
