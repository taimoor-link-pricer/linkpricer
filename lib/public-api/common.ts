/**
 * Plumbing shared by every published version of the public pricing API:
 * domain normalisation, key hashing, the response envelope, rate-limit
 * headers and the offer-row mapper.
 *
 * Moved here verbatim from handler.ts when the batch endpoint (v2) was added,
 * so the two cannot drift: a fix to how a domain is normalised or how an
 * offer row is read lands in both by construction.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { domainToASCII, domainToUnicode } from "url";
import type { RawOffer } from "@/lib/public-api/pricing";

// ─── helpers ───────────────────────────────────────────────────────────────

export function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/**
 * Every spelling of one host that the catalogue might have stored it under.
 *
 * An internationalized domain has two equally valid wire forms — the unicode
 * one a person types ("lübeck.nu") and the punycode one most HTTP clients
 * silently convert it to ("xn--lbeck-kva.nu") — and `domains` contains BOTH as
 * separate rows, with separate offers. 1,042 sites are stored twice this way,
 * 987 of them with live offers, and on a 200-site sample 167 (83%) carried a
 * DIFFERENT cheapest price under the two spellings.
 *
 * So the price a customer got depended on which form their HTTP library
 * happened to send — the same defect as the case-variant duplicates this route
 * already pools over, in a second dimension. Matching every form and pooling
 * the offers makes the answer the same either way.
 *
 * Returns a de-duplicated list; for a plain ASCII domain that is just the one
 * value, so the common path is unchanged.
 */
export function domainForms(domain: string): string[] {
  const forms = new Set<string>([domain]);
  try {
    const ascii = domainToASCII(domain);
    if (ascii) forms.add(ascii.toLowerCase());
  } catch { /* not a convertible host — the literal is all we have */ }
  try {
    const unicode = domainToUnicode(domain);
    if (unicode) forms.add(unicode.toLowerCase());
  } catch { /* as above */ }
  return [...forms];
}

/** A country name, or null — never the scraper's "-"/""/"n/a" placeholders. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (!v || v === "-" || v === "--" || v.toLowerCase() === "n/a" || v.toLowerCase() === "unknown") return null;
  return v;
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Per-key, per-plan responses: never storable by a shared cache, and never
// reusable across callers. Applied to success and error alike so a 429 can't
// be replayed from a proxy after the limit has reset either.
export const NO_STORE = { "Cache-Control": "private, no-store" } as const;

// Standard rate-limit headers. Without them a client has no way to pace itself
// except by walking into a 429 — it cannot see how much of its monthly quota
// is left until the moment the quota is gone. The counters are already read by
// the auth statement, so surfacing them costs nothing.
export function rateLimitHeaders(
  monthLimit: number,
  monthUsed: number | null,
  minuteLimit: number,
  minuteUsed: number | null,
  resetEpoch: number
): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(monthLimit),
    "X-RateLimit-Reset": String(resetEpoch),
    "X-RateLimit-Limit-Minute": String(minuteLimit),
  };
  if (monthUsed != null) h["X-RateLimit-Remaining"] = String(Math.max(0, monthLimit - monthUsed));
  if (minuteUsed != null) h["X-RateLimit-Remaining-Minute"] = String(Math.max(0, minuteLimit - minuteUsed));
  return h;
}

export function jsonOk(body: unknown, extra?: Record<string, string>) {
  return NextResponse.json(body, { headers: { ...NO_STORE, ...extra } });
}

export function jsonError(code: string, message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json(
    { error: code, message, status },
    { status, headers: { ...NO_STORE, ...extra } }
  );
}

// The monthly quota resets on the 1st at 00:00 UTC, which is what
// /developers/docs promises — so Retry-After has to be the time to *that*
// instant, not a flat guess.
export function secondsUntilNextMonthUtc(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
  return Math.max(1, Math.round((next - now.getTime()) / 1000));
}

export function monthWindow(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Every price column either offer table can carry, read into RawOffer.prices.
// Kept as one list so the SELECT, the row mapper and lib/public-api/pricing's
// NICHES map cannot drift apart.
export const PRICE_COLUMNS = [
  "min_price",
  "max_price",
  "gambling_min_price",
  "gambling_max_price",
  "adult_min_price",
  "adult_max_price",
  "cbd_min_price",
  "cbd_max_price",
  "loan_min_price",
  "loan_max_price",
  "dating_min_price",
  "dating_max_price",
  "crypto_min_price",
  "crypto_max_price",
  "trading_forex_min_price",
  "trading_forex_max_price",
  "link_insertion_min_price",
  "link_insertion_max_price",
] as const;

export function toOffer(row: Record<string, unknown>): RawOffer {
  const prices: Record<string, number | null> = {};
  for (const col of PRICE_COLUMNS) {
    const v = row[col];
    prices[col] = v == null ? null : Number(v);
  }
  return {
    currency: (row.currency as string) ?? "USD",
    prices,
    trusted: row.trusted === true,
    // Carried per offer so v2 can report freshness per niche. v1 ignores it
    // and keeps using the domain-wide MAX computed in SQL.
    freshness: (row.freshness as string | null) ?? null,
  };
}

// A hostname is a narrow character set: letters (including non-ASCII, for
// internationalized domains), digits, dot and hyphen. Anything outside it
// cannot match a catalog row — and a NUL byte is not representable in
// Postgres text at all, so letting one through makes the driver throw.
const HOSTNAME_SAFE = /^[\p{L}\p{N}.-]+$/u;

/** Whether an already-normalized domain is worth looking up at all. */
export function isValidHostname(domain: string): boolean {
  return (
    !!domain &&
    domain.length >= 3 &&
    domain.length <= 253 &&
    domain.includes(".") &&
    HOSTNAME_SAFE.test(domain)
  );
}
