/**
 * The MCP protocol surface, pinned: what a client gets back for each message
 * it is allowed to send, and that the messages needing no reply get none.
 */

import { describe, it, expect, vi } from "vitest";
import {
  handleMessage,
  INVALID_PARAMS,
  INVALID_REQUEST,
  INTERNAL_ERROR,
  METHOD_NOT_FOUND,
  PROTOCOL_VERSIONS,
  type McpHandlers,
  type ToolDefinition,
} from "@/lib/mcp/protocol";

const TOOL: ToolDefinition = {
  name: "get_link_prices",
  title: "Get link prices",
  description: "test",
  inputSchema: { type: "object" },
};

function handlers(callTool: McpHandlers["callTool"] = async () => ({ content: [{ type: "text", text: "ok" }] })) {
  return { tools: [TOOL], callTool };
}

const req = (method: string, params?: unknown, id: number | string = 1) => ({ jsonrpc: "2.0", id, method, params });

describe("initialize", () => {
  it("echoes a protocol version it supports", async () => {
    const r = await handleMessage(req("initialize", { protocolVersion: "2025-03-26" }), handlers());
    expect(r).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "linkpricer" } },
    });
  });

  it("answers an unknown version with its newest", async () => {
    const r = await handleMessage(req("initialize", { protocolVersion: "1999-01-01" }), handlers());
    expect((r!.result as { protocolVersion: string }).protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
  });
});

describe("tools", () => {
  it("lists the tools", async () => {
    const r = await handleMessage(req("tools/list"), handlers());
    expect(r!.result).toEqual({ tools: [TOOL] });
  });

  it("passes the arguments to the tool and returns its result", async () => {
    const callTool = vi.fn(async () => ({ content: [{ type: "text" as const, text: "priced" }] }));
    const r = await handleMessage(
      req("tools/call", { name: "get_link_prices", arguments: { domains: ["example.com"] } }, "abc"),
      handlers(callTool)
    );
    expect(callTool).toHaveBeenCalledWith("get_link_prices", { domains: ["example.com"] });
    expect(r).toEqual({ jsonrpc: "2.0", id: "abc", result: { content: [{ type: "text", text: "priced" }] } });
  });

  it("rejects a tool it does not publish without calling anything", async () => {
    const callTool = vi.fn();
    const r = await handleMessage(req("tools/call", { name: "drop_tables" }), handlers(callTool));
    expect(r!.error!.code).toBe(INVALID_PARAMS);
    expect(callTool).not.toHaveBeenCalled();
  });

  it("turns a thrown tool into an internal error, not a crash", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await handleMessage(
      req("tools/call", { name: "get_link_prices" }),
      handlers(async () => {
        throw new Error("db down");
      })
    );
    expect(r!.error!.code).toBe(INTERNAL_ERROR);
    expect(r!.error!.message).not.toContain("db down");
    spy.mockRestore();
  });
});

describe("messages that are not requests", () => {
  it("gives a notification no reply", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, handlers())).toBeNull();
  });

  it("gives a client response no reply", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", id: 7, result: {} }, handlers())).toBeNull();
  });

  it("answers ping", async () => {
    expect((await handleMessage(req("ping"), handlers()))!.result).toEqual({});
  });

  it("rejects an unknown method", async () => {
    expect((await handleMessage(req("resources/list"), handlers()))!.error!.code).toBe(METHOD_NOT_FOUND);
  });

  it("rejects anything that is not one JSON-RPC 2.0 message", async () => {
    for (const bad of [null, "hi", [req("ping")], { id: 1, method: "ping" }, { jsonrpc: "2.0", id: 1 }]) {
      const r = await handleMessage(bad, handlers());
      expect(r!.error!.code).toBe(INVALID_REQUEST);
      expect(r!.id).toBeNull();
    }
  });
});
