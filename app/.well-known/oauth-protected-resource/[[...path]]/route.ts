import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, protectedResourceMetadata } from "@/lib/mcp/oauth";

/**
 * RFC 9728 metadata for the MCP endpoint. An app that gets a 401 from
 * /api/mcp reads this to find out where to sign the user in. Served at both
 * /.well-known/oauth-protected-resource/api/mcp (the path-specific form apps
 * try first) and the bare well-known URL.
 */
export function GET(req: NextRequest) {
  return NextResponse.json(protectedResourceMetadata(req.nextUrl.origin), {
    headers: { "Cache-Control": "public, max-age=3600", ...CORS_HEADERS },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
