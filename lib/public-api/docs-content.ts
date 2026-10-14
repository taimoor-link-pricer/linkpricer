// Text shared by the developer docs page (app/developers/docs/page.tsx) and
// its plain-markdown copy (lib/public-api/docs-markdown.ts, served at
// /developers/docs.md), so the two cannot drift apart.

/** Errors either API can return; the request-specific ones are listed under each API. */
export const COMMON_ERROR_CODES = [
  { code: "400", name: "invalid_json", desc: "The body is not valid JSON." },
  { code: "401", name: "missing_api_key", desc: "No x-api-key header was sent." },
  { code: "401", name: "invalid_api_key", desc: "The key is unknown, expired or blocked, or its subscription is no longer active. The message says which." },
  { code: "405", name: "method_not_allowed", desc: "Anything other than POST." },
  { code: "413", name: "payload_too_large", desc: "The body is larger than 128 KB (Pricing) or 16 KB (Search)." },
  { code: "429", name: "rate_limit_exceeded", desc: "Per-minute burst limit hit. Retry-After is about 60 seconds." },
  { code: "429", name: "quota_exceeded", desc: "The request needs more lookups than remain this month; the message says how many remain. Retry-After counts down to the 1st, 00:00 UTC." },
  { code: "500", name: "internal_error", desc: "Error on our side. No lookups are charged. Retry with exponential backoff." },
];

export const PRICING_ERROR_CODES = [
  { code: "400", name: "invalid_request", desc: "The body is not an object with a domains array." },
  { code: "422", name: "empty_batch", desc: "domains is an empty array." },
  { code: "422", name: "too_many_domains", desc: "More than 200 entries. Split the list into several requests." },
  { code: "422", name: "invalid_niche", desc: "The niche value is not one we price." },
  { code: "422", name: "no_valid_domains", desc: "Every entry was malformed. The body carries a results array saying why for each one." },
];

export const SEARCH_ERROR_CODES = [
  { code: "400", name: "invalid_request", desc: "The body is not an object with a filters object." },
  { code: "422", name: "no_filters", desc: "filters is empty. Set at least one filter; niche on its own is not one." },
  { code: "422", name: "unknown_filter", desc: "A key inside filters is not a filter we support. The message lists the ones we do." },
  { code: "422", name: "unknown_field", desc: "A top-level field we do not recognise — usually a filter sent outside filters." },
  { code: "422", name: "invalid_filter", desc: "A filter has the wrong type or range, or a min is above its max. The message names it." },
  { code: "422", name: "invalid_country / invalid_language / invalid_tld / invalid_category", desc: "A value in that filter is not one we can match." },
  { code: "422", name: "invalid_niche", desc: "The niche value is not one we price." },
  { code: "422", name: "invalid_sort", desc: "sort or order is not an accepted value." },
  { code: "422", name: "invalid_limit", desc: "limit is not a whole number from 1 to 50." },
];

export const SEARCH_FILTERS: [string, string, string][] = [
  ["min_dr / max_dr", "number", "Ahrefs Domain Rating, 0–100, whole numbers."],
  ["min_traffic / max_traffic", "number", "Estimated monthly organic traffic."],
  ["min_ref_domains / max_ref_domains", "number", "Number of referring domains."],
  ["min_price / max_price", "number", "US dollars, compared against pricing.<niche>.linkpricer.lowest — the price you would pay, fee included. For the niche you asked for, or standard when you sent none."],
  ["country", "string | string[]", "Primary traffic country as ISO 3166-1 alpha-2 codes: \"US\", [\"DE\", \"AT\"]. A site matches if it is in any of them."],
  ["language", "string", "Site language as one ISO 639-1 code: \"en\", \"de\", \"es\"."],
  ["tld", "string | string[]", "Domain ending without the dot: \"de\", [\"com\", \"co.uk\"]. A site matches if it ends in any of them."],
  ["category", "string | string[]", "A word or short phrase matched against the site's category text: \"technology\", [\"health\", \"fitness\"]. Categories come from the sources as free text in several languages, so treat this as a keyword match, not a fixed taxonomy."],
];

export const SEARCH_REQUEST_EXAMPLE = `POST /api/v1/public/domains/search
x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "filters": {
    "min_dr": 40,
    "country": ["US", "GB"],
    "language": "en",
    "max_price": 250
  },
  "niche": "gambling",
  "sort": "price",
  "limit": 50
}`;

export const SEARCH_RESPONSE_EXAMPLE = `{
  "api_version": "1",
  "niche": "gambling",
  "filters": { "min_dr": 40, "max_price": 250, "country": ["US", "GB"], "language": "en" },
  "sort": { "by": "price", "order": "asc" },
  "summary": { "returned": 50, "limit": 50, "has_more": true },
  "usage": {
    "charged": 50,
    "monthly_limit": 10000,
    "monthly_remaining": 9362,
    "resets_at": "2026-11-01T00:00:00.000Z"
  },
  "results": [
    {
      "domain": "techblog.com",
      "data": { "domain": "techblog.com", "found": true, "currency": "USD", "pricing": { "gambling": { … } }, "metrics": { … }, … }
    },
    …
  ]
}`;

export const SEARCH_CURL_EXAMPLE = `curl -X POST "https://www.linkpricer.ai/api/v1/public/domains/search" \\
  -H "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"filters": {"min_dr": 40, "country": ["US"], "max_price": 250}, "sort": "price"}'`;

export const SEARCH_JS_EXAMPLE = `const res = await fetch("https://www.linkpricer.ai/api/v1/public/domains/search", {
  method: "POST",
  headers: {
    "x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    filters: { min_dr: 50, country: ["US"], language: "en" },
    sort: "price",
  }),
});
const body = await res.json();
for (const r of body.results) {
  console.log(r.domain, r.data.metrics.domain_rating, r.data.pricing.standard?.linkpricer.lowest);
}`;

export const SEARCH_PYTHON_EXAMPLE = `import requests

res = requests.post(
    "https://www.linkpricer.ai/api/v1/public/domains/search",
    headers={"x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"},
    json={
        "filters": {"min_dr": 50, "country": ["US"], "language": "en"},
        "sort": "price",
    },
)
res.raise_for_status()
for r in res.json()["results"]:
    print(r["domain"], r["data"]["metrics"]["domain_rating"],
          r["data"]["pricing"].get("standard", {}).get("linkpricer", {}).get("lowest"))`;

export const RESULT_ERROR_CODES = [
  { name: "domain_not_found", desc: "The domain is not in our catalog. status is \"not_found\". Not charged." },
  { name: "invalid_domain", desc: "The entry is not a valid domain (or not a string). status is \"invalid\". Not charged." },
];

export const REQUEST_EXAMPLE = `POST /api/v1/public/domains/pricing
x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "domains": ["techblog.com", "https://www.newsdaily.io/about", "nosuchsite.org", "not a domain"],
  "niche": "gambling"
}`;

export const BATCH_RESPONSE_EXAMPLE = `{
  "api_version": "1",
  "niche": "gambling",
  "summary": { "requested": 4, "unique_domains": 3, "ok": 2, "not_found": 1, "invalid": 1 },
  "usage": {
    "charged": 2,
    "monthly_limit": 10000,
    "monthly_remaining": 9412,
    "resets_at": "2026-10-01T00:00:00.000Z"
  },
  "results": [
    {
      "input": "techblog.com",
      "domain": "techblog.com",
      "status": "ok",
      "error": null,
      "data": { "domain": "techblog.com", "found": true, "currency": "USD", "pricing": { "gambling": { … } }, … }
    },
    {
      "input": "https://www.newsdaily.io/about",
      "domain": "newsdaily.io",
      "status": "ok",
      "error": null,
      "data": { … }
    },
    {
      "input": "nosuchsite.org",
      "domain": "nosuchsite.org",
      "status": "not_found",
      "error": { "code": "domain_not_found", "message": "No data found for this domain." },
      "data": null
    },
    {
      "input": "not a domain",
      "domain": null,
      "status": "invalid",
      "error": { "code": "invalid_domain", "message": "Not a valid domain. Send a bare host such as example.com." },
      "data": null
    }
  ]
}`;

export const CURL_EXAMPLE = `curl -X POST "https://www.linkpricer.ai/api/v1/public/domains/pricing" \\
  -H "x-api-key: lp_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"domains": ["techblog.com", "newsdaily.io"], "niche": "gambling"}'`;

export const JS_EXAMPLE = `const res = await fetch("https://www.linkpricer.ai/api/v1/public/domains/pricing", {
  method: "POST",
  headers: {
    "x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ domains: ["techblog.com", "newsdaily.io"], niche: "gambling" }),
});
const body = await res.json();
for (const r of body.results) {
  if (r.status === "ok") console.log(r.domain, r.data.pricing.gambling?.linkpricer.lowest);
}`;

export const PYTHON_EXAMPLE = `import requests

domains = open("domains.txt").read().split()
for i in range(0, len(domains), 200):          # 200 per request
    res = requests.post(
        "https://www.linkpricer.ai/api/v1/public/domains/pricing",
        headers={"x-api-key": "lp_live_xxxxxxxxxxxxxxxxxxxxxxxx"},
        json={"domains": domains[i:i + 200], "niche": "gambling"},
    )
    res.raise_for_status()
    for r in res.json()["results"]:
        if r["status"] == "ok":
            print(r["domain"], r["data"]["pricing"].get("gambling", {}).get("linkpricer", {}).get("lowest"))`;

export const RESPONSE_EXAMPLE = `{
  "domain": "techblog.com",
  "found": true,
  "currency": "USD",
  "fee": { "percent": 15, "minimum_usd": 28.50 },
  "pricing": {
    "standard": {
      "label":   "Standard / general",
      "summary": "LinkPricer best price for Standard / general: $299 (6 sources).",
      "marketplace": { "lowest": 260.00, "average": 264.50, "highest": 420.00 },
      "linkpricer":  { "lowest": 299, "average": 304.17, "highest": 483, "recommended": 345 },
      "offer_count":  6,
      "last_updated": "2026-06-20"
    },
    "gambling": {
      "label":   "Gambling / iGaming",
      "summary": "LinkPricer best price for Gambling / iGaming: $414 (3 sources).",
      "marketplace": { "lowest": 360.00, "average": 512.40, "highest": 900.00 },
      "linkpricer":  { "lowest": 414, "average": 589.26, "highest": 1035, "recommended": null },
      "offer_count":  3,
      "last_updated": "2026-05-02"
    }
  },
  "available_niches": ["standard", "gambling"],
  "metrics": {
    "domain_rating":   45,
    "organic_traffic": 12000,
    "ref_domains":     1200,
    "country":         "United States"
  },
  "last_updated": "2026-06-20"
}`;

export const ERROR_EXAMPLE = `{
  "error": "too_many_domains",
  "message": "A batch can contain at most 200 domains; this one has 250. Split it into several requests.",
  "status": 422
}`;

export const NICHE_CODES = ["standard", "gambling", "adult", "cbd", "loan", "dating", "crypto", "trading_forex", "link_insertion"];

export const BATCH_FIELDS: [field: string, type: string, desc: string][] = [
  ["api_version", "string", "Always \"1\"."],
  ["niche", "string | null", "The niche every result was filtered to, as its canonical id (a synonym you sent is resolved). null for all niches."],
  ["summary.requested", "number", "Entries you sent."],
  ["summary.unique_domains", "number", "Distinct valid domains looked up."],
  ["summary.ok / not_found / invalid", "number", "Results per status, counted per entry (duplicates included)."],
  ["usage.charged", "number", "Lookups this request took from your monthly quota — one per distinct domain in our catalog (every status \"ok\" domain, even when data.found is false for the niche you filtered to)."],
  ["usage.monthly_limit", "number", "Your monthly lookup quota."],
  ["usage.monthly_remaining", "number", "Lookups left this month after this request."],
  ["usage.resets_at", "string", "When the quota resets (the 1st, 00:00 UTC), ISO 8601."],
  ["results[].input", "string | null", "The entry exactly as you sent it. null if it was not a string."],
  ["results[].domain", "string | null", "The normalized domain that was looked up. null when the entry was invalid."],
  ["results[].status", "string", "\"ok\", \"not_found\" (not in our catalog) or \"invalid\" (malformed entry)."],
  ["results[].error", "object | null", "{ code, message } when status is not ok, otherwise null."],
  ["results[].data", "object | null", "When status is ok: the domain's pricing body — see Domain Result in the Reference section. Otherwise null. data.found is false when the domain is catalogued but nothing is priced for the niche you asked for."],
  
];

export const SEARCH_RESPONSE_FIELDS: [field: string, type: string, desc: string][] = [
  ["api_version", "string", "Always \"1\"."],
  ["niche", "string | null", "The niche searched, as its canonical id. null when you sent none."],
  ["filters", "object", "The filters as we understood them: codes upper- or lower-cased, single values turned into lists. Compare it with what you sent if a search surprises you."],
  ["sort.by / sort.order", "string", "The sort that was applied, defaults filled in."],
  ["summary.returned", "number", "How many domains are in results."],
  ["summary.limit", "number", "The limit that applied."],
  ["summary.has_more", "boolean", "true when more sites matched than were returned. There is no next page: narrow the filters or change the sort to see different sites."],
  ["usage", "object", "Same fields as the Pricing API (charged, monthly_limit, monthly_remaining, resets_at). usage.charged equals summary.returned."],
  ["results[].domain", "string", "The matching domain."],
  ["results[].data", "object", "The domain's pricing body — identical to what the pricing endpoint returns for it. See Domain Result."],
  
];

export const RESULT_FIELDS: [field: string, type: string, desc: string][] = [
  ["domain", "string", "The normalized domain you queried."],
  ["found", "boolean", "false when nothing in this response is priced — either no source prices the domain at all, or the niche you filtered to has no offers. pricing is then {} and last_updated is null. available_niches still tells you what the domain IS priced for."],
  ["currency", "string", "Always \"USD\". Source prices in other currencies are converted before any comparison."],
  ["fee", "object", "The Linkpricer fee applied to every figure under linkpricer. Identical for every niche, so it is stated once here rather than repeated."],
  ["fee.percent", "number", "The percentage part of the fee. Currently 15. It is the larger of this percentage and fee.minimum_usd that is actually charged, so on a cheap placement the effective markup is higher than this number."],
  ["fee.minimum_usd", "number", "The minimum fee, charged whenever it exceeds fee.percent of the source price — the usual case below roughly $190. Set in euros by us (currently €25), so this figure tracks the exchange rate. Use it to reproduce any linkpricer figure."],
  ["pricing", "object", "One entry per niche that at least one source prices for this domain. A niche nobody prices is absent — never present with nulls."],
  ["pricing.<niche>.label", "string", "Human-readable niche name, e.g. \"Gambling / iGaming\"."],
  ["pricing.<niche>.summary", "string", "One sentence naming what this niche's headline price is for. For display only — every figure in it is also a number below, and the wording may change at any time, so do not parse it."],
  ["pricing.<niche>.marketplace", "object", "What the sources charge, WITHOUT the Linkpricer fee. Anonymized — we never say which source a price came from."],
  ["pricing.<niche>.marketplace.lowest", "number", "WITHOUT fee. Lowest price any source charges for this niche, in USD."],
  ["pricing.<niche>.marketplace.average", "number", "WITHOUT fee. Mean price across every source that prices this niche, in USD."],
  ["pricing.<niche>.marketplace.highest", "number", "WITHOUT fee. Highest price any source charges for this niche, in USD."],
  ["pricing.<niche>.linkpricer", "object", "What you pay Linkpricer, fee INCLUDED."],
  ["pricing.<niche>.linkpricer.lowest", "number", "WITH fee. What Linkpricer charges to place this for you at the best price. Identical to the price shown on the dashboard's Buy button."],
  ["pricing.<niche>.linkpricer.average", "number", "WITH fee. The mean of your price at every source. NOT marketplace.average plus the fee — each source is priced individually and then averaged, so the minimum fee on cheap placements is reflected honestly."],
  ["pricing.<niche>.linkpricer.highest", "number", "WITH fee. Your price at the most expensive source."],
  ["pricing.<niche>.linkpricer.recommended", "number | null", "WITH fee. What Linkpricer charges via the cheapest source our team has vetted. null when no vetted source prices this niche for this domain — the placement is still available at linkpricer.lowest."],
  ["pricing.<niche>.offer_count", "number", "How many independent sources back these figures."],
  ["pricing.<niche>.last_updated", "string | null", "Date the prices for THIS niche were last refreshed, from the sources that actually price it. null when no contributing source carries a timestamp."],
  ["available_niches", "string[]", "Every niche this domain is priced for, regardless of any niche filter. Use it to tell \"no source sells this niche here\" apart from \"you filtered it out\" — without spending a second request."],
  ["metrics.domain_rating", "number | null", "Ahrefs Domain Rating (0–100)."],
  ["metrics.organic_traffic", "number | null", "Estimated monthly organic traffic."],
  ["metrics.ref_domains", "number | null", "Number of referring domains."],
  ["metrics.country", "string | null", "Primary traffic country, full name (e.g. \"United States\") — not an ISO code."],
  ["last_updated", "string | null", "The most recent of the per-niche dates in this response. null when nothing is priced."],
  
];
