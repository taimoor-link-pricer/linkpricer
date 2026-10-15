export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, issueClientId, oauthSecret, parseRegistration } from "@/lib/mcp/oauth";

const HEADERS = { "Cache-Control": "no-store", ...CORS_HEADERS };

/**
 * RFC 7591 dynamic client registration — how Claude.ai, ChatGPT and other MCP
 * apps introduce themselves before the first sign-in. Nothing is stored: the
 * client id is a signed record of the app's name and redirect URIs
 * (lib/mcp/oauth.ts), checked whenever it comes back.
 */
export async function POST(req: NextRequest) {
  const secret = oauthSecret();
  if (!secret) {
    return NextResponse.json({ error: "temporarily_unavailable", error_description: "OAuth is not configured." }, { status: 503, headers: HEADERS });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON." }, { status: 400, headers: HEADERS });
  }
  const reg = parseRegistration(body);
  if (!reg.ok) {
    const error = reg.message.startsWith("Redirect URI") || reg.message.startsWith("redirect_uris") ? "invalid_redirect_uri" : "invalid_client_metadata";
    return NextResponse.json({ error, error_description: reg.message }, { status: 400, headers: HEADERS });
  }
  return NextResponse.json(
    {
      client_id: issueClientId(secret, reg.client),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: reg.client.name,
      redirect_uris: reg.client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201, headers: HEADERS }
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
