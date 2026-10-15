import {
  COMMON_ERROR_CODES, PRICING_ERROR_CODES, SEARCH_ERROR_CODES, RESULT_ERROR_CODES, REQUEST_EXAMPLE,
  BATCH_RESPONSE_EXAMPLE, CURL_EXAMPLE, JS_EXAMPLE, PYTHON_EXAMPLE, RESPONSE_EXAMPLE, ERROR_EXAMPLE, NICHE_CODES,
  BATCH_FIELDS, RESULT_FIELDS, SEARCH_FILTERS, SEARCH_REQUEST_EXAMPLE, SEARCH_RESPONSE_EXAMPLE,
  SEARCH_RESPONSE_FIELDS, SEARCH_CURL_EXAMPLE, SEARCH_JS_EXAMPLE, SEARCH_PYTHON_EXAMPLE,
} from "./docs-content";

// /developers/docs as one plain-markdown document. Integrators hand the docs
// URL to an AI assistant, and a flat text file with every code sample visible
// (the HTML page hides two of the three behind tabs) is what those read best.
// Tables and samples come from docs-content.ts, shared with the page, and the
// sections follow the page: Getting started, Pricing API, Search API,
// Reference.

const fence = (lang: string, code: string) => "```" + lang + "\n" + code + "\n```";
const cell = (s: string) => s.replace(/\|/g, "\\|");
const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
const fieldTable = (rows: [string, string, string][]) =>
  table(["Field", "Type", "Description"], rows.map(([f, t, d]) => ["`" + f + "`", t, d]));
const errorTable = (rows: { code: string; name: string; desc: string }[]) =>
  table(["Status", "Error", "Description"], rows.map((e) => [e.code, "`" + e.name + "`", e.desc]));
const examples = (curl: string, js: string, python: string) =>
  `#### cURL\n\n${fence("bash", curl)}\n\n#### JavaScript\n\n${fence("javascript", js)}\n\n#### Python\n\n${fence("python", python)}`;

const HEADERS_TABLE = table(["Header", "Required", "Description"], [
  ["`x-api-key`", "Yes", "Your Linkpricer API key."],
  ["`Content-Type`", "Yes", "`application/json`"],
]);

export function buildDocsMarkdown(): string {
  return `# Linkpricer API reference

> Machine-readable copy of https://www.linkpricer.ai/developers/docs

# Getting started

## Overview

The Linkpricer API gives programmatic access to domain pricing data aggregated from 50+ link-building marketplaces. For every domain and every niche you get two sets of prices side by side: what the marketplaces charge (\`marketplace\` — the low, the mean and the high of the real market) and what Linkpricer charges to place it for you (\`linkpricer\` — the same spread, fee included). Marketplace names are never exposed.

There are two APIs. Pick the one that matches what you start with:

${table(["API", "Endpoint", "Use it when"], [
  ["Pricing API", "`POST /api/v1/public/domains/pricing`", "You have the domains. Send 1 to 200 and get the prices and metrics for each one."],
  ["Search API", "`POST /api/v1/public/domains/search`", "You have a brief. Send filters such as DR, country, language and price, and get up to 50 matching domains with their prices."],
])}

Both use the same API key and the same monthly quota, and return the same Domain Result (see Reference) for each domain. All responses are JSON.

- Base URL: \`https://www.linkpricer.ai/api\`

## Authentication

Every request to either API must include your API key in the \`x-api-key\` header.

${fence("http", "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx")}

API keys are prefixed with \`lp_live_\`. Keep your key secret — do not expose it in client-side code or public repositories. The API is server-to-server only.

## Quota and rate limits

Each plan includes a monthly quota of lookups and a per-minute burst limit, shared by both APIs. Those are the only two limits — there is no daily cap. Quotas reset on the 1st of each calendar month, 00:00 UTC.

${table(["Plan", "Monthly quota", "Per-minute limit"], [
  ["Starter", "1,000 lookups", "10 req/min"],
  ["Growth", "2,500 lookups", "20 req/min"],
  ["Scale", "10,000 lookups", "60 req/min"],
])}

${table(["API", "One lookup is", "Not charged"], [
  ["Pricing", "One distinct domain you sent that is in our catalog — including one with no offers for the niche you filtered to (`data.found: false`).", "Domains not in our catalog, malformed entries, duplicates."],
  ["Search", "One domain returned.", "A search that matches nothing."],
])}

A request must fit your remaining quota as a whole. Pricing reserves its distinct valid domains when the request arrives; Search reserves its \`limit\`. What goes unused is handed back when the request completes. If the reservation does not fit, the request is refused with \`429 quota_exceeded\` and nothing is charged. A request rejected outright (400, 413, 422) or failing on our side (500) costs nothing.

The per-minute limit counts requests, not domains. Both limits return \`429\` with a \`Retry-After\` header: about a minute for a burst (\`rate_limit_exceeded\`), or the time until the 1st for a spent quota (\`quota_exceeded\`).

Every response carries \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (the monthly quota, after this request), \`X-RateLimit-Limit-Minute\` and \`X-RateLimit-Remaining-Minute\` for the burst limit, and \`X-Lookups-Charged\`.

## Common errors

A request refused as a whole returns this shape, from either API. Each API's own errors are listed in its section.

${fence("json", ERROR_EXAMPLE)}

${errorTable(COMMON_ERROR_CODES)}

# Pricing API

## Pricing: endpoint

\`POST /api/v1/public/domains/pricing\`

Use this when you already have the domains. It prices up to **200 domains in one request** in about a second. To price a single domain, send a list of one. Each domain found comes back with its full Domain Result: every niche's marketplace and Linkpricer prices, plus domain rating, traffic, referring domains and country.

## Pricing: request

### Headers

${HEADERS_TABLE}

### Body

${table(["Field", "Type", "Required", "Description"], [
  ["`domains`", "string[]", "Yes", "1 to 200 entries. Pasted URLs are fine: the protocol, a leading `www.` and any path, query or fragment are stripped, so `https://www.example.com/blog?x=1` is looked up as `example.com`. Duplicates are allowed; each gets its own result but is looked up and charged once. The 200 limit counts entries as sent, before duplicates are removed."],
  ["`niche`", "string", "No", `Restrict every result to a single niche's pricing instead of all niches. One of ${NICHE_CODES.map((n) => "`" + n + "`").join(", ")}. Omitted, null or blank means every niche.`],
])}

Niche synonyms are accepted: \`general\` and \`base\` → \`standard\`, \`igaming\` → \`gambling\`, \`loans\` → \`loan\`, \`forex\` → \`trading_forex\`, \`insertion\` → \`link_insertion\`.

A niche only appears in a result when at least one source actually prices that niche for that domain. An offer with no price set for a niche is left out of it entirely rather than falling back to its base rate — so a \`gambling\` figure is always a real gambling price, never a standard one relabelled.

${fence("http", REQUEST_EXAMPLE)}

## Pricing: response

HTTP \`200\` whenever at least one entry was a valid domain — even if some were not found or malformed. \`results[i]\` always answers \`domains[i]\`, in the order you sent them.

${fence("json", BATCH_RESPONSE_EXAMPLE)}

${fieldTable(BATCH_FIELDS)}

## Pricing: errors

On top of the common errors, the whole request is refused for these. None of them is charged.

${errorTable(PRICING_ERROR_CODES)}

### Per-domain errors

Inside a \`200\` response, a domain that could not be priced carries its own \`results[].error\`; the rest of the request is unaffected.

${table(["Error", "Description"], RESULT_ERROR_CODES.map((e) => ["`" + e.name + "`", e.desc]))}

## Pricing: code examples

${examples(CURL_EXAMPLE, JS_EXAMPLE, PYTHON_EXAMPLE)}

# Search API

## Search: endpoint

\`POST /api/v1/public/domains/search\`

Use this when you do not have a list of domains — only what you are looking for. Send filters and get back up to **50 matching domains**, each with the same Domain Result the Pricing API returns. Same API key and same monthly quota as the Pricing API. A search usually takes 2 to 6 seconds.

**Charged per domain returned.** A search reserves its \`limit\` (50 unless you set it) when it arrives and hands back whatever it did not use, so a search that returns 12 domains costs 12 lookups and one that returns none costs nothing. If fewer lookups remain than the limit, it is refused with \`429 quota_exceeded\` and the message tells you what \`limit\` would fit.

## Search: request

### Headers

${HEADERS_TABLE}

### Body

${table(["Field", "Type", "Required", "Description"], [
  ["`filters`", "object", "Yes", "At least one of the filters below. Every filter you set must match. A misspelled or unsupported filter is refused, never silently ignored."],
  ["`niche`", "string", "No", "Same values as the Pricing API. Only sites priced for this niche are returned, the price filter and price sort use this niche's price, and each result carries this niche only. Omitted means the `standard` price is used for filtering and sorting, and each result carries every niche the site is priced for."],
  ["`sort`", "string", "No", "`dr` (default), `traffic`, `ref_domains` or `price`."],
  ["`order`", "string", "No", "`asc` or `desc`. Defaults to cheapest first for `price` and highest first for the others. Sites with no value for the sort field always come last."],
  ["`limit`", "number", "No", "1 to 50. Default 50. Also the most lookups this request can cost."],
])}

### Filters

${table(["Filter", "Type", "Description"], SEARCH_FILTERS.map(([f, t, d]) => ["`" + f + "`", t, d]))}

**A filter only matches sites where we know the value.** We do not hold organic traffic or referring domains for every site, so setting \`min_traffic\`, \`max_traffic\` or a referring-domains filter leaves out every site with no figure on record — including with a \`max_\` filter. Domain Rating is known for most of the catalog. If a traffic filter returns fewer sites than you expected, try the search without it.

${fence("http", SEARCH_REQUEST_EXAMPLE)}

## Search: response

${fence("json", SEARCH_RESPONSE_EXAMPLE)}

${fieldTable(SEARCH_RESPONSE_FIELDS)}

A search that matches nothing is still a \`200\`, with an empty \`results\` array and nothing charged.

## Search: errors

On top of the common errors, the search is refused for these. None of them is charged.

${errorTable(SEARCH_ERROR_CODES)}

## Search: code examples

${examples(SEARCH_CURL_EXAMPLE, SEARCH_JS_EXAMPLE, SEARCH_PYTHON_EXAMPLE)}

# Reference

## Domain result

Both APIs return the same object for each domain, in \`results[].data\`: the Pricing API for every entry with status \`ok\`, the Search API for every result. A domain found by Search prices to exactly the same figures when you send it to Pricing.

${fence("json", RESPONSE_EXAMPLE)}

### Marketplace prices vs. your price

Every price sits in one of two objects, and which object it is in tells you what it means. Nothing else in the response is money.

${table(["Object", "Fee", "Means"], [
  ["`marketplace`", "excluded", "What the sources charge. The real market spread: `lowest`, `average`, `highest`."],
  ["`linkpricer`", "included", "What you pay us. Same spread plus `recommended` (our vetted source). `linkpricer.lowest` is the headline price."],
])}

The fee is the larger of two things: \`fee.percent\` (currently 15%) of the source price, or \`fee.minimum_usd\` (currently €25, converted). Below roughly $190 of source price the minimum is what applies and the effective markup is higher than 15% — a $20 source price becomes $49, not $23. Above that, the percentage is the larger number. Prices are rounded to whole dollars, except the averages.

The minimum is set in euros, so \`fee.minimum_usd\` moves with the exchange rate. Read the fee from the response rather than hardcoding either figure: every number under \`linkpricer\` is computed as \`price + max(price × fee.percent ÷ 100, fee.minimum_usd)\`.

\`linkpricer.average\` is the mean of your price at each source computed individually, *not* \`marketplace.average\` plus the fee. The two differ whenever any source falls below the crossover, because the minimum fee is not proportional.

### Response fields

${fieldTable(RESULT_FIELDS)}
`;
}
