// Reads headers and a request body on every call, so this is request-time
// work by construction — declared explicitly.
export const dynamic = "force-dynamic";
// A tool call is one pricing batch; same room as the pricing route gives it.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { NO_STORE } from "@/lib/public-api/common";
import { MAX_BODY_BYTES } from "@/lib/public-api/batch";
import { handleMessage, rpcError, INVALID_REQUEST, PARSE_ERROR } from "@/lib/mcp/protocol";
import { callTool, TOOLS } from "@/lib/mcp/tools";

/**
 * The LinkPricer MCP server: lets an AI client (Claude, ChatGPT, Cursor) look
 * up link prices as a tool. Streamable HTTP transport, stateless — one
 * JSON-RPC message per POST, one JSON reply, no session and no event stream,
 * which is what lets it run as an ordinary serverless route.
 *
 * The caller's LinkPricer API key arrives as `Authorization: Bearer <key>` (or
 * x-api-key, as on the REST API). It is only checked when a tool is called:
 * connecting and listing tools is open, so a client with no key connects
 * cleanly and is told how to get one the first time it asks for a price,
 * instead of failing to connect with no explanation.
 */
export async function POST(req: NextRequest) {
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

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const apiKey = bearer || req.headers.get("x-api-key") || null;
  const origin = req.nextUrl.origin;

  const reply = await handleMessage(msg, {
    tools: TOOLS,
    callTool: (name, args) => callTool(name, args, { apiKey, origin }),
  });

  // Notifications get no body, only an acknowledgement.
  if (!reply) return new NextResponse(null, { status: 202, headers: NO_STORE });
  return rpc(reply, reply.id === null && reply.error ? 400 : 200);
}

function rpc(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// GET would open a server-to-client event stream and DELETE would end a
// session; this server has neither, and 405 is how the transport says so.
function methodNotAllowed() {
  return NextResponse.json(
    rpcError(null, INVALID_REQUEST, "Use POST with a JSON-RPC 2.0 message."),
    { status: 405, headers: { Allow: "POST", ...NO_STORE } }
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
