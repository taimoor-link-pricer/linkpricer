export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { CORS_HEADERS, exchangeToken, MCP_PATH, oauthSecret } from "@/lib/mcp/oauth";

const HEADERS = { "Cache-Control": "no-store", Pragma: "no-cache", ...CORS_HEADERS };

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: HEADERS });
}

/**
 * The OAuth token endpoint: swaps an authorization code (with its PKCE
 * verifier) or a refresh token for an access token to the MCP server. The
 * grant logic is lib/mcp/oauth.ts; this route reads the form, and refuses to
 * issue tokens for an account that no longer exists.
 */
export async function POST(req: NextRequest) {
  const secret = oauthSecret();
  if (!secret) return oauthError("temporarily_unavailable", "OAuth is not configured.", 503);

  // The spec says form-encoded; some clients send JSON, which costs nothing to accept.
  let params: Record<string, string | undefined>;
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      params = Object.fromEntries(Object.entries(j ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
    } else {
      params = Object.fromEntries(new URLSearchParams(await req.text()));
    }
  } catch {
    return oauthError("invalid_request", "Could not read the request body.");
  }

  const result = exchangeToken(secret, params, req.nextUrl.origin + MCP_PATH);
  if (!result.ok) return oauthError(result.error, result.description, result.error === "invalid_client" ? 401 : 400);

  const user = await db.execute(sql`SELECT 1 FROM users WHERE id = ${result.userId} LIMIT 1`);
  if (user.rows.length === 0) return oauthError("invalid_grant", "This LinkPricer account no longer exists.");

  return NextResponse.json(result.tokens, { headers: HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
