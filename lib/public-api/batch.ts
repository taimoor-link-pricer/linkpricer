/**
 * The v2 batch endpoint's request parsing and response shape, as pure
 * functions.
 *
 * POST /api/v2/public/domains/pricing takes up to MAX_BATCH_DOMAINS domains in
 * one call — the same ceiling the Analyze page applies — and answers with one
 * result per submitted entry, in the order they were sent. Each successful
 * result carries the exact body v1 returns for that domain (buildPricingBody),
 * so an integrator already parsing v1 parses a v2 result with the same code.
 *
 * Kept free of the database, the request and the quota claim for the same
 * reason shape.ts is: the shape is the product, and it has to be assertable
 * on its own. lib/public-api/batch.test.ts pins it.
 */

import { isValidHostname } from "@/lib/public-api/common";
import {
  ACCEPTED_NICHE_VALUES,
  resolveNiche,
  type NicheId,
} from "@/lib/public-api/pricing";
import type { PricingBody } from "@/lib/public-api/shape";

/** Same ceiling as the Analyze page (app/api/analyze/route.ts). */
export const MAX_BATCH_DOMAINS = 200;

/**
 * Upper bound on the raw request body. 200 maximum-length hostnames with JSON
 * quoting come to roughly 51 KB; the rest is headroom for whitespace and
 * pasted URLs with paths. Anything bigger is not a batch we would accept
 * anyway, and reading it would just be memory spent on a rejection.
 */
export const MAX_BODY_BYTES = 128 * 1024;

/** A request-level rejection: nothing is looked up and no quota is used. */
export interface BatchRequestError {
  ok: false;
  status: 400 | 422;
  code: string;
  message: string;
  /** Per-entry detail, present only when every entry was individually invalid. */
  results?: BatchResult[];
}

export interface BatchEntry {
  /** What the caller sent at this position, echoed back when it was a string. */
  input: string | null;
  /** The normalized domain that will be looked up, or null when invalid. */
  domain: string | null;
  error: { code: string; message: string } | null;
}

export interface ParsedBatch {
  ok: true;
  niche: NicheId | null;
  /** One per submitted entry, in submission order. */
  entries: BatchEntry[];
  /** The distinct valid domains, in order of first appearance — what gets looked up and charged. */
  unique: string[];
}

export type BatchResultStatus = "ok" | "not_found" | "invalid";

export interface BatchResult {
  input: string | null;
  domain: string | null;
  status: BatchResultStatus;
  error: { code: string; message: string } | null;
  /** The v1 per-domain body when status is "ok", otherwise null. */
  data: PricingBody | null;
}

export interface BatchUsage {
  /** Lookups this call consumed from the monthly quota. */
  charged: number;
  monthly_limit: number;
  monthly_remaining: number;
  /** ISO timestamp of the next monthly reset (1st, 00:00 UTC). */
  resets_at: string;
}

export interface BatchBody {
  api_version: "2";
  niche: NicheId | null;
  summary: {
    requested: number;
    unique_domains: number;
    ok: number;
    not_found: number;
    invalid: number;
  };
  usage: BatchUsage;
  results: BatchResult[];
}

/**
 * Batch inputs are usually pasted lists, so they arrive as URLs as often as
 * bare hosts ("https://www.example.com/blog/post?x=1"). Reduce every entry to
 * its host the way the Analyze page does — scheme, a leading www., and
 * anything from the first path, query or fragment separator onwards are
 * dropped — then validate it with the exact rule v1 uses.
 */
export function normalizeBatchDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .trim();
}

const INVALID_DOMAIN = {
  code: "invalid_domain",
  message: "Not a valid domain. Send a bare host such as example.com.",
} as const;

const NOT_A_STRING = {
  code: "invalid_domain",
  message: "Each entry in domains must be a string.",
} as const;

export function parseBatchRequest(body: unknown): ParsedBatch | BatchRequestError {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_request",
      message: 'Request body must be a JSON object: { "domains": ["example.com", ...], "niche": "gambling" }.',
    };
  }

  const { domains, niche: rawNiche } = body as { domains?: unknown; niche?: unknown };

  if (!Array.isArray(domains)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_request",
      message: '"domains" is required and must be an array of domain strings.',
    };
  }
  if (domains.length === 0) {
    return {
      ok: false,
      status: 422,
      code: "empty_batch",
      message: '"domains" must contain at least one domain.',
    };
  }
  // Counted on what was sent, before de-duplication, so the rule is one a
  // caller can check without knowing how we normalize.
  if (domains.length > MAX_BATCH_DOMAINS) {
    return {
      ok: false,
      status: 422,
      code: "too_many_domains",
      message: `A batch can contain at most ${MAX_BATCH_DOMAINS} domains; this one has ${domains.length}. Split it into several requests.`,
    };
  }

  // Blank means "no filter", exactly as in v1, where ?niche= and an omitted
  // parameter are the same request.
  let niche: NicheId | null = null;
  if (rawNiche != null) {
    if (typeof rawNiche !== "string") {
      return invalidNiche();
    }
    const trimmed = rawNiche.trim();
    if (trimmed) {
      niche = resolveNiche(trimmed);
      if (!niche) return invalidNiche();
    }
  }

  const entries: BatchEntry[] = [];
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of domains) {
    if (typeof raw !== "string") {
      entries.push({ input: null, domain: null, error: { ...NOT_A_STRING } });
      continue;
    }
    const domain = normalizeBatchDomain(raw);
    if (!isValidHostname(domain)) {
      entries.push({ input: raw, domain: null, error: { ...INVALID_DOMAIN } });
      continue;
    }
    entries.push({ input: raw, domain, error: null });
    if (!seen.has(domain)) {
      seen.add(domain);
      unique.push(domain);
    }
  }

  if (unique.length === 0) {
    return {
      ok: false,
      status: 422,
      code: "no_valid_domains",
      message: "None of the submitted entries is a valid domain. See results for each one.",
      results: entries.map((e) => ({
        input: e.input,
        domain: null,
        status: "invalid",
        error: e.error,
        data: null,
      })),
    };
  }

  return { ok: true, niche, entries, unique };
}

function invalidNiche(): BatchRequestError {
  return {
    ok: false,
    status: 422,
    code: "invalid_niche",
    message: `Invalid niche. Valid values are: ${ACCEPTED_NICHE_VALUES.join(", ")}`,
  };
}

/**
 * The response body. `found` maps each looked-up domain that exists in the
 * catalogue to its v1 body; a looked-up domain missing from it is not_found.
 * Duplicate entries each get their own result (so results[i] always answers
 * domains[i]) but were looked up — and charged — once.
 */
export function buildBatchBody(
  parsed: ParsedBatch,
  found: Map<string, PricingBody>,
  usage: BatchUsage
): BatchBody {
  const results: BatchResult[] = parsed.entries.map((e) => {
    if (e.error || !e.domain) {
      return { input: e.input, domain: null, status: "invalid", error: e.error, data: null };
    }
    const data = found.get(e.domain);
    if (!data) {
      return {
        input: e.input,
        domain: e.domain,
        status: "not_found",
        error: { code: "domain_not_found", message: "No data found for this domain." },
        data: null,
      };
    }
    return { input: e.input, domain: e.domain, status: "ok", error: null, data };
  });

  let ok = 0;
  let notFound = 0;
  let invalid = 0;
  for (const r of results) {
    if (r.status === "ok") ok++;
    else if (r.status === "not_found") notFound++;
    else invalid++;
  }

  return {
    api_version: "2",
    niche: parsed.niche,
    summary: {
      requested: parsed.entries.length,
      unique_domains: parsed.unique.length,
      ok,
      not_found: notFound,
      invalid,
    },
    usage,
    results,
  };
}
