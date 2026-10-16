/**
 * The tools the LinkPricer MCP server publishes.
 *
 * Each tool is a public API endpoint offered to an AI client, and none of them
 * queries the catalogue itself: get_link_prices hands the call to the pricing
 * handler, search_sites to the search handler. So the key check, the
 * per-domain quota claim, the refunds and the request log are the API's own —
 * a lookup costs the same and returns the same body whichever door it came
 * through.
 */

import { NextRequest, NextResponse } from "next/server";
import { handleBatchPricingRequest } from "@/lib/public-api/batch-handler";
import { handleSearchRequest } from "@/lib/public-api/search-handler";
import { NICHE_IDS } from "@/lib/public-api/pricing";
import { SEARCH_SORTS } from "@/lib/public-api/search";
import type { ToolDefinition, ToolResult } from "@/lib/mcp/protocol";

/**
 * Lower than the API's 200. The reply lands in the model's context window,
 * where a 200-domain body would crowd out the conversation it is answering;
 * a caller with a longer list makes several calls.
 */
export const MCP_MAX_DOMAINS = 25;

/**
 * search_sites returns at most this many sites, and this many when the model
 * does not say. Lower than the API's 50 for the same context-window reason,
 * and the default is small because a search is charged per site returned: a
 * model that leaves limit out should not spend 50 lookups on one question.
 */
export const MCP_MAX_SEARCH_RESULTS = 25;
export const MCP_DEFAULT_SEARCH_RESULTS = 10;

const NICHE_SCHEMA = {
  type: "string",
  enum: NICHE_IDS,
  description:
    "Which price to use. standard is ordinary content; gambling, adult, cbd, loan, dating, crypto and " +
    "trading_forex are priced separately by publishers; link_insertion is a link added to an existing article.",
};

const range = (what: string, max?: number) => ({
  type: "integer",
  minimum: 0,
  ...(max != null ? { maximum: max } : {}),
  description: what,
});

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "get_link_prices",
    title: "Get link prices",
    description:
      "Look up what a guest post or link placement costs on specific websites. " +
      "For each domain returns, per niche, the lowest, average and highest price across link-building " +
      "marketplaces (marketplace: what the sources charge) and LinkPricer's own fee-inclusive price " +
      "(linkpricer: what a customer pays, with a recommended price from trusted sources), plus the number " +
      "of offers, when the prices were last updated, and the site's Domain Rating, organic traffic, " +
      "referring domains and main country. All prices are USD. A domain LinkPricer has no priced offers for comes " +
      "back as not_found. Each domain answered with a price uses one lookup from the user's monthly quota; " +
      "not_found domains, and domains not priced for the niche asked, are free.",
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
        niche: { ...NICHE_SCHEMA, description: NICHE_SCHEMA.description + " Omit to get every niche the site is priced for." },
      },
      required: ["domains"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "search_sites",
    title: "Search sites",
    description:
      "Find websites to buy a guest post or link on, by Domain Rating, organic traffic, referring domains, " +
      "price, country, language, TLD or topic. Returns matching sites with the same prices and metrics as " +
      "get_link_prices. Never returns blog-hosting subdomains, hosting and storage domains, social, profile and " +
      "user-document platforms, or university and government sites, which are not real editorial placements. " +
      "Set a niche, at least one filter, or both. " +
      "Each site returned uses one lookup from the user's monthly " +
      `quota, so ask for only as many as needed (default ${MCP_DEFAULT_SEARCH_RESULTS}, max ${MCP_MAX_SEARCH_RESULTS}). ` +
      "For prices on sites the user already named, use get_link_prices instead.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Every filter set must match. Optional when a niche is set.",
          properties: {
            min_dr: range("Lowest Ahrefs Domain Rating, 0-100.", 100),
            max_dr: range("Highest Ahrefs Domain Rating, 0-100.", 100),
            min_traffic: range("Lowest monthly organic traffic."),
            max_traffic: range("Highest monthly organic traffic."),
            min_ref_domains: range("Lowest number of referring domains."),
            max_ref_domains: range("Highest number of referring domains."),
            min_price: { type: "number", exclusiveMinimum: 0, description: "Lowest LinkPricer price in USD, for the chosen niche." },
            max_price: { type: "number", exclusiveMinimum: 0, description: "Highest LinkPricer price in USD, for the chosen niche (budget)." },
            country: {
              type: "array",
              items: { type: "string" },
              description: "Main traffic country as ISO 3166-1 alpha-2 codes, e.g. [\"US\", \"GB\"]. Any one matches.",
            },
            language: { type: "string", description: "Site language as one ISO 639-1 code, e.g. en, de, es." },
            tld: { type: "array", items: { type: "string" }, description: "Domain endings without the dot, e.g. [\"de\", \"co.uk\"]. Any one matches." },
            category: {
              type: "array",
              items: { type: "string" },
              description: "Topic words matched against the site's category, e.g. [\"technology\", \"finance\"]. Any one matches.",
            },
          },
          additionalProperties: false,
        },
        niche: { ...NICHE_SCHEMA, description: NICHE_SCHEMA.description + " Price filters and price sorting use this niche's price." },
        sort: { type: "string", enum: SEARCH_SORTS, description: "Sort by dr (default), traffic, ref_domains or price." },
        order: { type: "string", enum: ["asc", "desc"], description: "Defaults to cheapest first for price, highest first otherwise." },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MCP_MAX_SEARCH_RESULTS,
          description: `How many sites to return, default ${MCP_DEFAULT_SEARCH_RESULTS}.`,
        },
      },
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

export interface ToolContext {
  /** The API key to charge, as its hash; null when the caller has none. */
  keyHash: string | null;
  /** How the caller got here, which decides what "you have no key" should say. */
  via: "api_key" | "oauth" | "anonymous";
  /** The site this request arrived on, used to point a caller at the page that issues keys. */
  origin: string;
}

function noKeyMessage(ctx: ToolContext): string {
  return ctx.via === "oauth"
    ? `Your LinkPricer account has no API key yet, and lookups are charged to one. Create it at ${ctx.origin}/developers, ` +
        "then ask again: this connection will use it automatically."
    : `LinkPricer needs an API key to look up prices. Create one at ${ctx.origin}/developers, ` +
        "then add it to this connector as the header  Authorization: Bearer <your key>.";
}

/** Runs one public API handler as if called over HTTP, and turns its answer into a tool result. */
async function viaApi(
  handler: (req: NextRequest, keyHash?: string) => Promise<NextResponse>,
  path: string,
  body: unknown,
  ctx: ToolContext & { keyHash: string }
): Promise<ToolResult> {
  const res = await handler(
    new NextRequest(`${ctx.origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx.keyHash
  );
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 401 && ctx.via === "oauth") {
      return text(
        `${json?.message ?? "API key is invalid or inactive."} This connection uses the API key on your LinkPricer ` +
          `account; check it at ${ctx.origin}/developers.`,
        true
      );
    }
    const message = typeof json?.message === "string" ? json.message : `Request failed (${res.status}).`;
    return text(json?.results ? `${message}\n${JSON.stringify(json.results)}` : message, true);
  }
  return text(JSON.stringify(json));
}

export async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (name !== "get_link_prices" && name !== "search_sites") return text(`Unknown tool: ${name}`, true);
  if (!ctx.keyHash) return text(noKeyMessage(ctx), true);
  const keyed = { ...ctx, keyHash: ctx.keyHash };

  if (name === "get_link_prices") {
    const { domains, niche } = args;
    if (Array.isArray(domains) && domains.length > MCP_MAX_DOMAINS) {
      return text(
        `get_link_prices takes at most ${MCP_MAX_DOMAINS} domains per call; this one has ${domains.length}. ` +
          "Split the list into several calls.",
        true
      );
    }
    // Everything else about the arguments — shape, niche spelling, which
    // entries are real domains — is validated by the API handler, in its own words.
    return viaApi(handleBatchPricingRequest, "/api/v1/public/domains/pricing", { domains, niche }, keyed);
  }

  const { filters, niche, sort, order } = args;
  const limit = args.limit ?? MCP_DEFAULT_SEARCH_RESULTS;
  if (typeof limit === "number" && limit > MCP_MAX_SEARCH_RESULTS) {
    return text(`search_sites returns at most ${MCP_MAX_SEARCH_RESULTS} sites per call; ask for fewer or narrow the filters.`, true);
  }
  return viaApi(handleSearchRequest, "/api/v1/public/domains/search", { filters, niche, sort, order, limit }, keyed);
}
