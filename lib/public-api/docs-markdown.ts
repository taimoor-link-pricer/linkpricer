import {
  ERROR_CODES, RESULT_ERROR_CODES, REQUEST_EXAMPLE, BATCH_RESPONSE_EXAMPLE, CURL_EXAMPLE, JS_EXAMPLE,
  PYTHON_EXAMPLE, RESPONSE_EXAMPLE, ERROR_EXAMPLE, NICHE_CODES, BATCH_FIELDS, RESULT_FIELDS,
} from "./docs-content";

// /developers/docs as one plain-markdown document. Integrators hand the docs
// URL to an AI assistant, and a flat text file with every code sample visible
// (the HTML page hides two of the three behind tabs) is what those read best.
// Tables and samples come from docs-content.ts, shared with the page.

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

export function buildDocsMarkdown(): string {
  return `# Linkpricer API reference

> Machine-readable copy of https://www.linkpricer.ai/developers/docs

## Overview

The Linkpricer API gives programmatic access to domain pricing data aggregated from 50+ link-building marketplaces. For every domain and every niche you get two sets of prices side by side: what the marketplaces charge (\`marketplace\` — the low, the mean and the high of the real market) and what Linkpricer charges to place it for you (\`linkpricer\` — the same spread, fee included). Marketplace names are never exposed.

There is one endpoint. Send it anywhere from 1 to 200 domains and get a result for each, in the order you sent them. All responses are JSON. Authentication uses an API key passed in a request header.

- Base URL: \`https://www.linkpricer.ai/api\`
- Endpoint: \`POST /v1/public/domains/pricing\`
- Full URL: \`https://www.linkpricer.ai/api/v1/public/domains/pricing\`

## Authentication

Every request must include your API key in the \`x-api-key\` header.

${fence("http", "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx")}

API keys are prefixed with \`lp_live_\`. Keep your key secret — do not expose it in client-side code or public repositories. The API is server-to-server only.

## Endpoint

\`POST /api/v1/public/domains/pricing\`

Prices up to **200 domains in one request** in about a second. To price a single domain, send a list of one. Each domain found comes back with its full pricing body: every niche's marketplace and Linkpricer prices, plus domain rating, traffic, referring domains and country.

## Request

### Headers

${table(["Header", "Required", "Description"], [
  ["`x-api-key`", "Yes", "Your Linkpricer API key."],
  ["`Content-Type`", "Yes", "`application/json`"],
])}

### Body

${table(["Field", "Type", "Required", "Description"], [
  ["`domains`", "string[]", "Yes", "1 to 200 entries. Pasted URLs are fine: the protocol, a leading `www.` and any path, query or fragment are stripped, so `https://www.example.com/blog?x=1` is looked up as `example.com`. Duplicates are allowed; each gets its own result but is looked up and charged once. The 200 limit counts entries as sent, before duplicates are removed."],
  ["`niche`", "string", "No", `Restrict every result to a single niche's pricing instead of all niches. One of ${NICHE_CODES.map((n) => "`" + n + "`").join(", ")}. Omitted, null or blank means every niche.`],
])}

Niche synonyms are accepted: \`general\` and \`base\` → \`standard\`, \`igaming\` → \`gambling\`, \`loans\` → \`loan\`, \`forex\` → \`trading_forex\`, \`insertion\` → \`link_insertion\`.

A niche only appears in a result when at least one source actually prices that niche for that domain. An offer with no price set for a niche is left out of it entirely rather than falling back to its base rate — so a \`gambling\` figure is always a real gambling price, never a standard one relabelled.

${fence("http", REQUEST_EXAMPLE)}

## Response

HTTP \`200\` whenever at least one entry was a valid domain — even if some were not found or malformed. \`results[i]\` always answers \`domains[i]\`, in the order you sent them.

${fence("json", BATCH_RESPONSE_EXAMPLE)}

${fieldTable(BATCH_FIELDS)}

## Domain result

Every \`results[i].data\` with status \`ok\` is the pricing body for that domain:

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

## Metering

**One lookup per distinct domain in our catalog.** That includes a domain that has no offers for the niche you filtered to: it comes back with status \`ok\` and \`data.found: false\`, and its \`available_niches\` is still worth having. Domains not in our catalog, malformed entries and duplicates cost nothing, and a request rejected outright (400, 413, 422) costs nothing. On a \`500\` nothing is charged.

A request must fit your remaining monthly quota as a whole: its distinct valid domains are reserved when the request arrives, and the ones we do not have are handed back when it completes. If they do not all fit, the request is refused with \`429 quota_exceeded\`, the message says how many lookups remain, and nothing is charged. The per-minute limit counts requests, so one request is one against it however many domains it holds.

Responses carry \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` (the monthly quota, after this request), \`X-RateLimit-Limit-Minute\` and \`X-RateLimit-Remaining-Minute\` for the burst limit, and \`X-Lookups-Charged\`.

## Errors

A request that is refused as a whole returns this shape, with nothing charged:

${fence("json", ERROR_EXAMPLE)}

${table(["Status", "Error", "Description"], ERROR_CODES.map((e) => [e.code, "`" + e.name + "`", e.desc]))}

### Per-domain errors

Inside a \`200\` response, a domain that could not be priced carries its own \`results[].error\`; the rest of the request is unaffected.

${table(["Error", "Description"], RESULT_ERROR_CODES.map((e) => ["`" + e.name + "`", e.desc]))}

## Rate limits

Each key has a monthly lookup quota and a per-minute request limit; both are reported in every response (\`usage\` and the \`X-RateLimit-*\` headers). Those are the only two limits — there is no daily cap. Both return \`429\` with a \`Retry-After\` header giving the seconds until that specific limit clears: about a minute for a burst (\`rate_limit_exceeded\`), or the time remaining until the 1st for a spent quota (\`quota_exceeded\`). The \`error\` field tells the two apart.

${table(["Plan", "Monthly quota", "Per-minute limit"], [
  ["Starter", "1,000 lookups", "10 req/min"],
  ["Growth", "2,500 lookups", "20 req/min"],
  ["Scale", "10,000 lookups", "60 req/min"],
])}

Monthly quotas reset on the 1st of each calendar month (UTC). A lookup is one distinct domain in a request that is in our catalog.

## Code examples

### cURL

${fence("bash", CURL_EXAMPLE)}

### JavaScript

${fence("javascript", JS_EXAMPLE)}

### Python

${fence("python", PYTHON_EXAMPLE)}
`;
}
