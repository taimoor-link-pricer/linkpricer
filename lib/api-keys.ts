import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-error";

export function generateApiKey(): { plain: string; hash: string } {
  const plain = "lp_live_" + randomBytes(20).toString("hex");
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

/**
 * Gives a user the key their plan entitles them to, exactly once.
 *
 * Both the inline subscribe route and the webhook call this, because with
 * hosted Checkout gone the only signals that a subscription started are
 * whichever of those two arrives first — and either can be first. Issuing
 * unconditionally in both places would rotate the key a second time and throw
 * away the plaintext the customer was in the middle of copying.
 *
 * So: a user who already has an active key keeps it and only has its limits
 * resized. A user who has none gets one issued, with the one-time plaintext
 * reveal attached. `api_keys_one_active_per_user` backstops the race if both
 * callers land in the same instant — the insert loses, and the caller simply
 * reports that a key already exists rather than failing the subscription.
 */
export async function issueOrResizeKey(opts: {
  userId: string;
  planName: string;
  monthlyLimit: number;
  dailyLimit: number;
  perMinuteLimit: number;
}): Promise<{ issued: boolean }> {
  const { userId, planName, monthlyLimit, dailyLimit, perMinuteLimit } = opts;

  const resized = await db.execute(sql`
    UPDATE api_keys
    SET monthly_limit = ${monthlyLimit}, daily_limit = ${dailyLimit}, per_minute_limit = ${perMinuteLimit},
        -- A paid subscription now governs this key. An expiry left over from
        -- an admin-granted trial would otherwise cut off a paying customer on
        -- the trial's end date. An admin block (blocked_at) is NOT lifted.
        expires_at = NULL
    WHERE user_id = ${userId} AND is_active = true
    RETURNING id
  `);
  if (resized.rows.length > 0) return { issued: false };

  const { plain, hash } = generateApiKey();
  try {
    await db.execute(sql`
      INSERT INTO api_keys (user_id, key_hash, name, monthly_limit, daily_limit, per_minute_limit, is_active, plain_key_temp)
      VALUES (${userId}, ${hash}, ${"Linkpricer API — " + planName}, ${monthlyLimit}, ${dailyLimit}, ${perMinuteLimit}, true, ${plain})
    `);
  } catch (err) {
    // The other caller won the race and issued the key between our UPDATE and
    // this INSERT. That is a success, not a failure — the customer has a key.
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) return { issued: false };
    throw err;
  }
  return { issued: true };
}

export type KeyStatus = "active" | "blocked" | "expired" | "revoked";

/**
 * The one definition of whether a key works, for display. The public API
 * enforces the same three conditions in SQL (lib/public-api/batch-handler.ts);
 * blocked outranks expired so an admin sees the action they took.
 */
export function keyStatus(
  k: { isActive: boolean; blockedAt: string | Date | null; expiresAt: string | Date | null },
  now: Date = new Date()
): KeyStatus {
  if (!k.isActive) return "revoked";
  if (k.blockedAt) return "blocked";
  if (k.expiresAt && new Date(k.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

const MAX_MONTHLY_LIMIT = 10_000_000;
const MAX_PER_MINUTE_LIMIT = 600;

export interface AdminKeyFields {
  name?: string;
  monthlyLimit?: number;
  perMinuteLimit?: number;
  /** ISO timestamp, or null for "never expires". */
  expiresAt?: string | null;
}

/**
 * Validates the admin-editable fields of a key. Only fields present in
 * `input` are checked and returned, so the same function serves create (which
 * then requires what it needs) and a partial edit.
 */
export function parseAdminKeyFields(
  input: Record<string, unknown>,
  now: Date = new Date()
): { ok: true; fields: AdminKeyFields } | { ok: false; error: string } {
  const fields: AdminKeyFields = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) return { ok: false, error: "Name can't be empty." };
    if (input.name.trim().length > 120) return { ok: false, error: "Name is too long (120 characters max)." };
    fields.name = input.name.trim();
  }

  const int = (v: unknown, label: string, max: number): number | string => {
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return `${label} must be a whole number of at least 1.`;
    if (v > max) return `${label} can't be more than ${max.toLocaleString("en-US")}.`;
    return v;
  };
  if (input.monthlyLimit !== undefined) {
    const r = int(input.monthlyLimit, "Monthly limit", MAX_MONTHLY_LIMIT);
    if (typeof r === "string") return { ok: false, error: r };
    fields.monthlyLimit = r;
  }
  if (input.perMinuteLimit !== undefined) {
    const r = int(input.perMinuteLimit, "Per-minute limit", MAX_PER_MINUTE_LIMIT);
    if (typeof r === "string") return { ok: false, error: r };
    fields.perMinuteLimit = r;
  }

  if (input.expiresAt !== undefined) {
    if (input.expiresAt === null || input.expiresAt === "") {
      fields.expiresAt = null;
    } else {
      const d = typeof input.expiresAt === "string" ? new Date(input.expiresAt) : null;
      if (!d || Number.isNaN(d.getTime())) return { ok: false, error: "Expiry is not a valid date." };
      // A past expiry is a block by another name, and almost always a typo'd
      // year. Blocking has its own button.
      if (d.getTime() <= now.getTime()) return { ok: false, error: "Expiry must be in the future. To stop a key now, block it." };
      fields.expiresAt = d.toISOString();
    }
  }

  return { ok: true, fields };
}
