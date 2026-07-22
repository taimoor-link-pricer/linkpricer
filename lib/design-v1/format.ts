// Formatting / sorting / currency helpers ported from data/helpers.jsx and
// v1-interactive/v1-app.jsx in the Karolis design handoff.

import type { Currency, Domain, SortState } from "./types";

export const fmt = {
  num(n: number | null | undefined): string {
    if (n == null) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(n);
  },
  price(n: number | null | undefined, sym = "$"): string {
    if (n == null) return "—";
    return sym + n.toLocaleString("en-US");
  },
  range(min: number | null | undefined, max: number | null | undefined, sym = "$"): string {
    if (min == null) return "—";
    if (max == null || min === max) return fmt.price(min, sym);
    return `${fmt.price(min, sym)} – ${fmt.price(max, sym)}`;
  },
  withFee(n: number | null | undefined): number | null {
    return n == null ? null : Math.round(n * 1.15);
  },
};

export function gradeColor(g: string | null | undefined): { fg: string; bg: string } {
  if (!g) return { fg: "var(--lp-grade-c)", bg: "var(--lp-grade-c-bg)" };
  if (g.startsWith("A")) return { fg: "var(--lp-grade-a)", bg: "var(--lp-grade-a-bg)" };
  if (g === "B+" || g === "B") return { fg: "var(--lp-grade-b)", bg: "var(--lp-grade-b-bg)" };
  if (g === "B-") return { fg: "var(--lp-grade-bm)", bg: "var(--lp-grade-bm-bg)" };
  return { fg: "var(--lp-grade-c)", bg: "var(--lp-grade-c-bg)" };
}

export function flag(cc: string | null | undefined): string {
  if (!cc) return "—";
  const A = 0x1f1e6;
  const codes = cc.toUpperCase().split("").map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codes);
}

export const matchPillColor = (m: number | null | undefined): "green" | "blue" | "amber" | "ink" => {
  if (m == null) return "ink";
  return m >= 80 ? "green" : m >= 55 ? "blue" : m >= 40 ? "amber" : "ink";
};

// Sample input text shown as a placeholder in the paste textarea
export const sampleInput =
  "forbes.com\nbetimate.com\noneangrygamer.net\ntechcrunch.com 1100\nhealthline.com\npitchfork.com\nobscure-blog-2017.example";

// Fallback only — overwritten by hydrateRates() with the admin-configured
// values from /api/currency-rates (lib/currency.ts) as soon as any page
// that shows prices mounts. Kept as a mutable object (not reassigned) so
// every module that imported RATES sees the update in place.
export const RATES: Record<Currency, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };
export const SYMS: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£" };

let hydrated = false;
let hydrating: Promise<void> | null = null;

// Admin rates are stored as "1 unit of currency = X USD" (toUsd = amount * rate).
// RATES here is the inverse direction "1 USD = Y of currency" (conv = usd * RATES[cur]),
// so Y = 1 / X.
export function hydrateRates(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = fetch("/api/currency-rates")
    .then((res) => res.json())
    .then((data: { rates: Record<string, number> }) => {
      for (const cur of ["EUR", "GBP"] as const) {
        const adminRate = data.rates?.[cur];
        if (adminRate && adminRate > 0) RATES[cur] = 1 / adminRate;
      }
      hydrated = true;
    })
    .catch((err) => {
      console.error("[hydrateRates] keeping fallback rates", err);
    })
    .finally(() => {
      hydrating = null;
    });
  return hydrating;
}

export function conv(usd: number, cur: Currency): number {
  return Math.round(usd * RATES[cur]);
}

export function priceFmt(n: number | null | undefined, cur: Currency): string {
  if (n == null) return "—";
  const v = conv(n, cur);
  return cur === "EUR" ? `€${v.toLocaleString()}` : cur === "GBP" ? `£${v.toLocaleString()}` : `$${v.toLocaleString()}`;
}

export function userPriceToUsd(value: number | null, currency: Currency): number | null {
  if (value == null) return null;
  return Math.round(value / RATES[currency]);
}

export function sortBy<T extends { notFound?: boolean }>(
  rows: T[],
  key: string,
  dir: SortState["dir"],
): T[] {
  if (!key) return rows;
  const m = dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    if (a.notFound) return 1;
    if (b.notFound) return -1;
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * m;
    return ((av as number) - (bv as number)) * m;
  });
}

// Parse the free-text "paste domains, one per line" textarea input.
// Each line may optionally end with a price in the active currency,
// e.g. "forbes.com 200".
export function parseInput(text: string): { domain: string; yourPrice: number | null }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [domain, ...rest] = l.split(/\s+/);
      const priceTok = rest.find((t) => /^\$?\d+(\.\d+)?$/.test(t));
      const yourPrice = priceTok ? parseFloat(priceTok.replace("$", "")) : null;
      return { domain: domain.toLowerCase(), yourPrice };
    });
}

// Match parsed domain lines against the sample dataset, converting any
// user-entered price (in the active currency) back to USD for comparison.
export function matchedDomains(
  parsed: { domain: string; yourPrice: number | null }[],
  currency: Currency,
  dataset: Domain[],
): Domain[] {
  return parsed.map((p) => {
    const found = dataset.find((d) => d.domain === p.domain);
    const yourPriceUsd = userPriceToUsd(p.yourPrice, currency);
    if (!found) return { domain: p.domain, notFound: true };
    return { ...found, yourPrice: yourPriceUsd };
  });
}
