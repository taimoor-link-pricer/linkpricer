// Ahrefs REST v3 client for the Related Sites "hide sites that already link to
// me" feature. Uses plain REST (not MCP/SSE) — the sibling serverless app
// (linkpricer-serverless/functions/src/jobs/ahrefs-dr.ts) found MCP SSE times
// out from a serverless environment (60s Cloud Run handshake limit), REST
// works reliably. Same auth pattern (Bearer token) as that job.
//
// Endpoint confirmed against https://docs.ahrefs.com/en/api/reference/site-explorer/get-refdomains
// (2026-07-14): GET /v3/site-explorer/refdomains, response wrapped as
// { refdomains: [...] }, fields include `domain` and `traffic_domain`.
//
// NOTE: the AHREFS_API_KEY used through 2026-07-14 returned 401 Unauthorized
// on this endpoint — it was scoped to Ahrefs' "MCP" key type, not "API".
// Fixed 2026-07-14 by generating a proper REST-API-scoped key from Ahrefs'
// dashboard (Account -> API keys -> "Generate API key", not "Generate MCP
// key") and re-verified live (200s against both this endpoint and
// subscription-info/limits-and-usage) on 2026-07-16.

const API_URL = "https://api.ahrefs.com/v3/site-explorer/refdomains";
const MIN_REFERRING_TRAFFIC = 100;
const MAX_REFERRING_DOMAINS = 1000;
const REQUEST_TIMEOUT_MS = 12_000;

export interface AhrefsReferringDomain {
  domain: string;
  orgTraffic: number;
}

interface RefdomainsResponse {
  refdomains?: { domain: string; traffic_domain: number }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches the referring domains for `targetDomain`, filtered server-side to
 * only those with >= MIN_REFERRING_TRAFFIC organic traffic (per Karolis: this
 * reduces Ahrefs API unit consumption vs. pulling everything and filtering
 * client-side). Throws on failure — callers must handle fallback themselves,
 * this module never degrades silently.
 */
export async function fetchReferringDomainsFromAhrefs(targetDomain: string): Promise<AhrefsReferringDomain[]> {
  const apiKey = process.env.AHREFS_API_KEY;
  if (!apiKey) throw new Error("AHREFS_API_KEY not configured");

  const where = JSON.stringify({ field: "traffic_domain", is: ["gte", MIN_REFERRING_TRAFFIC] });
  const params = new URLSearchParams({
    target: targetDomain,
    select: "domain,traffic_domain",
    mode: "domain",
    limit: String(MAX_REFERRING_DOMAINS),
    order_by: "traffic_domain:desc",
    where,
  });

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 429) {
      if (attempt >= 3) throw new Error("Ahrefs HTTP 429: rate limited after 3 attempts");
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1500 * attempt);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Ahrefs HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const parsed = (await res.json()) as RefdomainsResponse;
    const rows = parsed.refdomains ?? [];
    return rows.map((r) => ({
      domain: r.domain.toLowerCase(),
      orgTraffic: Number(r.traffic_domain ?? 0),
    }));
  }
}
