import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// USD is always 1 and never stored — every other currency's rate means
// "1 unit of this currency = `rate` USD" (same direction the old hardcoded
// CURRENCY_TO_USD map used: amount * rate = usdAmount).
const DEFAULT_RATES: Record<string, number> = { EUR: 1 / 0.92, GBP: 1 / 0.79 };

let cache: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateRatesCache() {
  cache = null;
}

export async function ensureCurrencyRatesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS currency_rates (
      currency TEXT PRIMARY KEY,
      usd_rate NUMERIC NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    )
  `);
  // Table pre-dates the updated_by column on any env where it was created earlier.
  await db.execute(sql`ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS updated_by TEXT`);
}

// Admin-configured rates, falling back to the old hardcoded defaults for any
// currency the admin hasn't set yet, so nothing breaks with an empty table.
export async function getUsdRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.rates;

  const rates: Record<string, number> = { USD: 1, ...DEFAULT_RATES };
  try {
    // Deliberately NOT calling ensureCurrencyRatesTable() here. This is a hot
    // read path — every Analyze call and every public-API call goes through
    // it — and the ensure did a CREATE TABLE IF NOT EXISTS plus an ALTER TABLE
    // ADD COLUMN IF NOT EXISTS before the actual SELECT: three sequential
    // round trips instead of one, measured at ~790ms against Neon, paid again
    // on every cold serverless instance and every 5-minute cache expiry.
    //
    // DDL belongs with the writers. /api/admin/currency-rates still ensures
    // the table on read and write, so an environment that has never had an
    // admin visit that page simply falls back to DEFAULT_RATES here (the
    // catch below) instead of paying for schema management on every request.
    const rows = await db.execute(sql`SELECT currency, usd_rate FROM currency_rates`);
    for (const r of rows.rows) {
      rates[(r.currency as string).toUpperCase()] = Number(r.usd_rate);
    }
  } catch (err) {
    console.error("[getUsdRates] falling back to defaults", err);
  }

  cache = { rates, fetchedAt: Date.now() };
  return rates;
}

export function toUsd(
  amount: number | null | undefined,
  currency: string | null | undefined,
  rates: Record<string, number>
): number | null {
  if (amount == null) return null;
  const rate = rates[(currency ?? "USD").trim().toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}
