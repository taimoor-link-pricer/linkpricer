import { NextRequest, NextResponse } from "next/server";
import { authorizationServerMetadata, CORS_HEADERS, oauthSecret } from "@/lib/mcp/oauth";

/**
 * RFC 8414 metadata: where an app registers, sends the user to sign in, and
 * gets tokens. 404 when OAuth is not configured on this deployment, so an app
 * does not start a sign-in that could never finish.
 */
export function GET(req: NextRequest) {
  if (!oauthSecret()) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(authorizationServerMetadata(req.nextUrl.origin), {
    headers: { "Cache-Control": "public, max-age=3600", ...CORS_HEADERS },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
