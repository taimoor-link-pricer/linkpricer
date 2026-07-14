// Semantic reranking for Related Sites search results, using the Claude
// Messages API (not an embeddings endpoint — Anthropic doesn't offer
// first-party embeddings). Replaces the naive JS word-overlap relevance score
// with real relevance judgment over a bounded shortlist. One call per search,
// so cost/latency stay predictable regardless of shortlist size.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_SUMMARY_CHARS = 200;
// Sized for up to CLAUDE_SHORTLIST_SIZE (80) candidates in route.ts — each
// {"domain": "...", "score": 87} entry runs ~20-25 tokens, so 80 entries need
// ~1600-2000 tokens. A prior 1500 cap silently truncated the JSON on nearly
// every real search, which made rerankWithClaude fail to parse and fall back
// to the naive word-overlap scoring on almost every request.
const MAX_OUTPUT_TOKENS = 4000;

export interface RerankCandidate {
  domain: string;
  category: string;
  semanticSummary?: string | null;
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function parseScores(raw: string): Map<string, number> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const scores = new Map<string, number>();
  for (const entry of parsed) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).domain === "string" &&
      typeof (entry as Record<string, unknown>).score === "number"
    ) {
      scores.set((entry as { domain: string }).domain, (entry as { score: number }).score);
    }
  }
  return scores.size > 0 ? scores : null;
}

/**
 * Scores each candidate's relevance (0-100) to `query` using Claude. Returns
 * null on any failure (missing key, timeout, malformed response) so callers
 * fall back to the existing keyword-overlap scoring — this must never throw
 * or block a search.
 */
export async function rerankWithClaude(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  const anthropic = getClient();
  if (!anthropic || candidates.length === 0) return null;

  const items = candidates.map((c) => ({
    domain: c.domain,
    category: c.category,
    summary: c.semanticSummary ? c.semanticSummary.slice(0, MAX_SUMMARY_CHARS) : undefined,
  }));

  const prompt = `A user is searching a backlink/guest-post marketplace for sites matching this topic: "${query}"

Here is a JSON array of candidate sites (domain, category, and an optional content summary):
${JSON.stringify(items)}

Score every candidate's relevance to the search topic from 0 (irrelevant) to 100 (perfect match), based on semantic meaning, not just literal keyword overlap. Respond with ONLY a JSON array, one entry per candidate, in this exact shape and no other text:
[{"domain": "example.com", "score": 87}, ...]`;

  try {
    const response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (response.stop_reason === "max_tokens") {
      console.warn(
        `[claude-rerank] response truncated at max_tokens (${MAX_OUTPUT_TOKENS}) for ${candidates.length} candidates — falling back to keyword scoring`
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const scores = parseScores(textBlock.text);
    if (!scores) {
      console.warn(
        `[claude-rerank] failed to parse scores for ${candidates.length} candidates — falling back to keyword scoring`
      );
    } else if (scores.size < candidates.length) {
      console.warn(
        `[claude-rerank] scored ${scores.size} of ${candidates.length} candidates (partial response) — unscored candidates default to 0`
      );
    }
    return scores;
  } catch (err) {
    console.error("[claude-rerank] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
