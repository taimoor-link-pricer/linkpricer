/**
 * Who is calling the MCP server, and which API key their lookups are charged to.
 *
 * Two ways in, one result. A developer tool sends its LinkPricer API key
 * (Authorization: Bearer lp_live_…, or x-api-key) and is charged to that key.
 * An app that connected through OAuth sends an lpmcp_ access token, which
 * names a user; the call is charged to that user's active API key, looked up
 * fresh every time, so regenerating a key does not disconnect anything and
 * blocking one disconnects everything.
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { hashKey } from "@/lib/public-api/common";
import { MCP_PATH, oauthSecret, readAccessToken, TOKEN_PREFIX } from "@/lib/mcp/oauth";

export type Caller =
  /** keyHash is null for an OAuth user who has no API key yet. */
  | { kind: "ok"; keyHash: string | null; via: "api_key" | "oauth" }
  /** No credentials and OAuth is available: the app should sign the user in. */
  | { kind: "challenge" }
  /** An lpmcp_ token that is forged, expired or for another server: the app should refresh or sign in again. */
  | { kind: "invalid_token" }
  /** No credentials and OAuth is not configured here: let the tools explain how to get a key. */
  | { kind: "anonymous" };

export async function activeKeyHashFor(userId: string): Promise<string | null> {
  const r = await db.execute(sql`
    SELECT key_hash FROM api_keys
    WHERE user_id = ${userId} AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = r.rows[0] as { key_hash: string } | undefined;
  return row?.key_hash ?? null;
}

export async function resolveCaller(headers: Headers, origin: string): Promise<Caller> {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
  const secret = oauthSecret();

  if (bearer?.startsWith(TOKEN_PREFIX)) {
    const userId = secret ? readAccessToken(secret, bearer, origin + MCP_PATH) : null;
    if (!userId) return { kind: "invalid_token" };
    return { kind: "ok", keyHash: await activeKeyHashFor(userId), via: "oauth" };
  }

  const rawKey = bearer || headers.get("x-api-key");
  if (rawKey) return { kind: "ok", keyHash: hashKey(rawKey), via: "api_key" };

  return secret ? { kind: "challenge" } : { kind: "anonymous" };
}
