/**
 * Auth, errors and rate limits for the order API (/api/v1/listings,
 * /api/v1/orders) — the API the lp-outreach robot uses to buy placements.
 *
 * Deliberately separate from the public pricing API's key system. Those keys
 * are self-serve, one per paying developer, and the api_keys table enforces
 * one active key per user — which rules out the two things this API needs: a
 * test key and a live key on the same account, and two live keys valid at once
 * during a rotation. Ordering is also not something a pricing subscriber
 * should ever be able to reach.
 *
 * So keys are issued by hand (scripts/order-api-key.mjs) and listed in the
 * ORDER_API_KEYS env var as SHA-256 hashes — the plaintext is never stored:
 *
 *   ORDER_API_KEYS='[{"name":"lp-outreach live","hash":"<sha256>","userId":"<uid>","mode":"live"}]'
 *
 * Rotation = add the new entry, deploy, retire the old entry a day later.
 */

import { NextRequest, NextResponse } from "next/server";
import { hashKey } from "@/lib/public-api/common";

export type OrderApiMode = "live" | "test";

export interface OrderApiKey {
  name: string;
  hash: string;
  userId: string;
  mode: OrderApiMode;
}

export interface OrderApiCaller {
  key: OrderApiKey;
  /** True for a test key, or a live key sent with X-Test-Mode: true. */
  test: boolean;
}

/** The stable error codes the robot branches on. Never rename one. */
export type OrderApiErrorCode =
  | "not_found"
  | "invalid_request"
  | "duplicate_reference"
  | "price_changed"
  | "listing_unavailable"
  | "rate_limited"
  | "unauthorized"
  | "server_error";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function apiOk(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, "X-API-Version": "1", ...extra } });
}

export function apiError(
  code: OrderApiErrorCode,
  message: string,
  status: number,
  opts?: { details?: Record<string, unknown>; headers?: Record<string, string> }
) {
  return NextResponse.json(
    { error: { code, message, ...(opts?.details ?? {}) } },
    { status, headers: { ...NO_STORE, "X-API-Version": "1", ...(opts?.headers ?? {}) } }
  );
}

function loadKeys(): OrderApiKey[] {
  const raw = process.env.ORDER_API_KEYS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is OrderApiKey =>
        !!k &&
        typeof k.hash === "string" &&
        typeof k.userId === "string" &&
        (k.mode === "live" || k.mode === "test")
    );
  } catch {
    console.error("[order-api] ORDER_API_KEYS is not valid JSON — every request will be refused");
    return [];
  }
}

/** The key sent as `Authorization: Bearer <key>` (or `x-api-key`, as the pricing API takes it). */
function presentedKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(\S+)\s*$/i);
    if (m) return m[1];
  }
  return req.headers.get("x-api-key");
}

/** The caller, or the 401 response to send back. */
export function authenticate(req: NextRequest): OrderApiCaller | NextResponse {
  const plain = presentedKey(req);
  if (!plain) {
    return apiError("unauthorized", "Send your API key as `Authorization: Bearer <key>`.", 401);
  }
  const hash = hashKey(plain);
  const key = loadKeys().find((k) => k.hash === hash);
  if (!key) return apiError("unauthorized", "API key is invalid or has been retired.", 401);

  const headerTest = (req.headers.get("x-test-mode") ?? "").trim().toLowerCase() === "true";
  return { key, test: key.mode === "test" || headerTest };
}

// ─── rate limiting ──────────────────────────────────────────────────────────
//
// A fixed one-minute window per key and endpoint class, held in memory. That is
// per server instance, so on a multi-instance deploy the effective ceiling is a
// multiple of these numbers — acceptable for one internal caller whose own spec
// asks for far less, and it keeps a runaway loop from hammering the catalog.

const LIMITS = { read: 60, order: 10 } as const;
const windows = new Map<string, { minute: number; count: number }>();

/** null when allowed, otherwise the 429 to send back. */
export function rateLimit(caller: OrderApiCaller, kind: keyof typeof LIMITS): NextResponse | null {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const id = `${caller.key.hash}:${kind}`;
  const w = windows.get(id);
  if (!w || w.minute !== minute) {
    windows.set(id, { minute, count: 1 });
    return null;
  }
  if (w.count >= LIMITS[kind]) {
    const retryAfter = Math.max(1, Math.ceil(((minute + 1) * 60000 - now) / 1000));
    return apiError("rate_limited", `Limit is ${LIMITS[kind]} requests per minute for this endpoint.`, 429, {
      headers: { "Retry-After": String(retryAfter) },
    });
  }
  w.count++;
  return null;
}
