/**
 * The tools the LinkPricer MCP server publishes.
 *
 * get_link_prices is the public pricing API (POST /api/v1/public/domains/pricing)
 * offered to an AI client. It does not query the catalogue itself: it hands the
 * call to handleBatchPricingRequest, so the key check, the per-domain quota
 * claim, the refund for domains we do not hold and the request log are the
 * API's own — a lookup costs the same and returns the same body whichever
 * door it came through.
 */

import { NextRequest } from "next/server";
import { handleBatchPricingRequest } from "@/lib/public-api/batch-handler";
import { NICHE_IDS } from "@/lib/public-api/pricing";
import type { ToolDefinition, ToolResult } from "@/lib/mcp/protocol";

/**
 * Lower than the API's 200. The reply lands in the model's context window,
 * where a 200-domain body would crowd out the conversation it is answering;
 * a caller with a longer list makes several calls.
 */
export const MCP_MAX_DOMAINS = 25;

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "get_link_prices",
    title: "Get link prices",
    description:
      "Look up what a guest post or link placement costs on one or more websites. " +
      "For each domain returns, per niche, the lowest, average and highest price across link-building " +
      "marketplaces (marketplace: what the sources charge) and LinkPricer's own fee-inclusive price " +
      "(linkpricer: what a customer pays, with a recommended price from trusted sources), plus the number " +
      "of offers, when the prices were last updated, and the site's Domain Rating, organic traffic, " +
      "referring domains and main country. All prices are USD. A domain LinkPricer has no offers for comes " +
      "back as not_found. Each domain found uses one lookup from the caller's monthly quota.",
    inputSchema: {
      type: "object",
      properties: {
        domains: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: MCP_MAX_DOMAINS,
          description: `Websites to price, as bare domains (example.com) or URLs. Up to ${MCP_MAX_DOMAINS} per call.`,
        },
        niche: {
          type: "string",
          enum: NICHE_IDS,
          description:
            "Only return prices for this niche. Omit to get every niche the site is priced for. " +
            "Use standard for ordinary content; gambling, adult, cbd, loan, dating, crypto and trading_forex " +
            "are priced separately by publishers; link_insertion is a link added to an existing article.",
        },
      },
      required: ["domains"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
];

function text(message: string, isError = false): ToolResult {
  return isError
    ? { content: [{ type: "text", text: message }], isError: true }
    : { content: [{ type: "text", text: message }] };
}

/**
 * `origin` is the site this request arrived on, used to point a caller without
 * a key at the page that issues one.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { apiKey: string | null; origin: string }
): Promise<ToolResult> {
  if (name !== "get_link_prices") return text(`Unknown tool: ${name}`, true);

  if (!ctx.apiKey) {
    return text(
      `LinkPricer needs an API key to look up prices. Create one at ${ctx.origin}/developers, ` +
        "then add it to this connector as the header  Authorization: Bearer <your key>.",
      true
    );
  }

  const { domains, niche } = args;
  if (Array.isArray(domains) && domains.length > MCP_MAX_DOMAINS) {
    return text(
      `get_link_prices takes at most ${MCP_MAX_DOMAINS} domains per call; this one has ${domains.length}. ` +
        "Split the list into several calls.",
      true
    );
  }

  // Everything else about the arguments — shape, niche spelling, which entries
  // are real domains — is validated by the API handler, in its own words.
  const res = await handleBatchPricingRequest(
    new NextRequest(`${ctx.origin}/api/v1/public/domains/pricing`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ctx.apiKey },
      body: JSON.stringify({ domains, niche }),
    })
  );
  const body = await res.json();

  if (!res.ok) {
    const message = typeof body?.message === "string" ? body.message : `Request failed (${res.status}).`;
    return text(body?.results ? `${message}\n${JSON.stringify(body.results)}` : message, true);
  }
  return text(JSON.stringify(body));
}
