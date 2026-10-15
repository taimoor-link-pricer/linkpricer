// Reads headers and a request body on every call, so this is request-time
// work by construction — declared explicitly.
export const dynamic = "force-dynamic";
// A tool call is one pricing batch or one search; same room as those routes give it.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { NO_STORE } from "@/lib/public-api/common";
import { MAX_BODY_BYTES } from "@/lib/public-api/batch";
import { handleMessage, rpcError, INTERNAL_ERROR, INVALID_REQUEST, PARSE_ERROR } from "@/lib/mcp/protocol";
import { callTool, TOOLS } from "@/lib/mcp/tools";
import { resolveCaller } from "@/lib/mcp/auth";
import { CORS_HEADERS } from "@/lib/mcp/oauth";

/**
 * The LinkPricer MCP server: lets an AI client (Claude, ChatGPT, Cursor) look
 * up link prices and search sites as tools. Streamable HTTP transport,
 * stateless — one JSON-RPC message per POST, one JSON reply, no session and
 * no event stream, which is what lets it run as an ordinary serverless route.
 *
 * Two ways to authenticate (lib/mcp/auth.ts): a LinkPricer API key, for
 * developer tools, or an OAuth access token, for apps where the user signs in
 * with their LinkPricer account. A request with neither gets 401 and a
 * pointer to the OAuth metadata, which is how an app knows to start sign-in.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  // Authenticate before reading the body: an app that has not signed in yet
  // should be told how to, whatever it sent.
  let caller;
  try {
    caller = await resolveCaller(req.headers, origin);
  } catch (err) {
    // An OAuth caller's key is looked up in the database; that failing is ours, not theirs.
    console.error("[/api/mcp] caller lookup failed", err);
    return rpc(rpcError(null, INTERNAL_ERROR, "An internal error occurred. Please retry."), 500);
  }
  if (caller.kind === "challenge" || caller.kind === "invalid_token") {
    const metadata = `${origin}/.well-known/oauth-protected-resource/api/mcp`;
    const challenge =
      caller.kind === "invalid_token"
        ? `Bearer error="invalid_token", error_description="The access token is invalid or expired.", resource_metadata="${metadata}"`
        : `Bearer resource_metadata="${metadata}"`;
    return NextResponse.json(
      rpcError(null, INVALID_REQUEST, "Sign in to LinkPricer to use this server, or send your API key as Authorization: Bearer <key>."),
      { status: 401, headers: { "WWW-Authenticate": challenge, ...NO_STORE, ...CORS_HEADERS } }
    );
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return rpc(rpcError(null, PARSE_ERROR, "Could not read the request body."), 400);
  }
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    return rpc(rpcError(null, INVALID_REQUEST, `Request body exceeds ${MAX_BODY_BYTES} bytes.`), 413);
  }
  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return rpc(rpcError(null, PARSE_ERROR, "Request body is not valid JSON."), 400);
  }

  const ctx =
    caller.kind === "ok"
      ? { keyHash: caller.keyHash, via: caller.via, origin }
      : { keyHash: null, via: "anonymous" as const, origin };

  const reply = await handleMessage(msg, {
    tools: TOOLS,
    callTool: (name, args) => callTool(name, args, ctx),
  });

  // Notifications get no body, only an acknowledgement.
  if (!reply) return new NextResponse(null, { status: 202, headers: { ...NO_STORE, ...CORS_HEADERS } });
  return rpc(reply, reply.id === null && reply.error ? 400 : 200);
}

function rpc(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...CORS_HEADERS } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET would open a server-to-client event stream and DELETE would end a
// session; this server has neither, and 405 is how the transport says so.
function methodNotAllowed() {
  return NextResponse.json(
    rpcError(null, INVALID_REQUEST, "Use POST with a JSON-RPC 2.0 message."),
    { status: 405, headers: { Allow: "POST", ...NO_STORE, ...CORS_HEADERS } }
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
