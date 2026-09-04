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
    SET monthly_limit = ${monthlyLimit}, daily_limit = ${dailyLimit}, per_minute_limit = ${perMinuteLimit}
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
