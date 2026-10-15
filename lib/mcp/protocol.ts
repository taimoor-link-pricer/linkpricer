/**
 * The MCP wire protocol for the LinkPricer server, as a pure function.
 *
 * MCP (Model Context Protocol) is JSON-RPC 2.0: an AI client sends one message
 * per HTTP POST and reads one JSON reply. This server only publishes tools, and
 * keeps no session between calls, so the whole protocol is four methods:
 * initialize, ping, tools/list and tools/call.
 *
 * Written by hand rather than on @modelcontextprotocol/sdk because that
 * package brings express, hono and an OAuth client into a route that needs
 * none of them. Kept free of the request and the database so the protocol can
 * be asserted on its own — lib/mcp/protocol.test.ts pins it.
 */

export const SERVER_INFO = { name: "linkpricer", title: "LinkPricer", version: "0.1.0" } as const;

/** Newest first. A client asking for one of these gets it back; any other gets the newest. */
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const INSTRUCTIONS =
  "LinkPricer compares guest post and link placement prices across link-building marketplaces. " +
  "Use get_link_prices whenever the user asks what a link, guest post or sponsored article on a website costs. " +
  "All prices are in USD.";

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface McpHandlers {
  tools: readonly ToolDefinition[];
  /** Runs a tool that exists in `tools`. Failures are returned as isError results, not thrown. */
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

// JSON-RPC 2.0 error codes.
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export function rpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Answers one JSON-RPC message. Returns null when the message needs no reply
 * — a notification, or a client's response to something we never asked.
 */
export async function handleMessage(msg: unknown, handlers: McpHandlers): Promise<JsonRpcResponse | null> {
  if (!isObject(msg) || msg.jsonrpc !== "2.0") {
    return rpcError(null, INVALID_REQUEST, "Expected a single JSON-RPC 2.0 message.");
  }

  const hasId = typeof msg.id === "string" || typeof msg.id === "number";
  if (typeof msg.method !== "string") {
    // A response from the client; we send no requests, so there is nothing to match it to.
    return hasId && ("result" in msg || "error" in msg)
      ? null
      : rpcError(null, INVALID_REQUEST, "Message has no method.");
  }
  // No id means a notification (notifications/initialized, notifications/cancelled, ...).
  if (!hasId) return null;

  const id = msg.id as string | number;
  const params = isObject(msg.params) ? msg.params : {};
  const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });

  switch (msg.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const version = (PROTOCOL_VERSIONS as readonly unknown[]).includes(asked)
        ? (asked as string)
        : PROTOCOL_VERSIONS[0];
      return ok({
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return ok({});

    case "tools/list":
      return ok({ tools: handlers.tools });

    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !handlers.tools.some((t) => t.name === name)) {
        return rpcError(id, INVALID_PARAMS, `Unknown tool: ${String(name)}`);
      }
      const args = isObject(params.arguments) ? params.arguments : {};
      try {
        return ok(await handlers.callTool(name, args));
      } catch (err) {
        console.error("[/api/mcp] tool threw", name, err);
        return rpcError(id, INTERNAL_ERROR, "The tool failed unexpectedly. Please retry.");
      }
    }

    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  }
}
