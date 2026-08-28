// Semantic reranking for search results, using OpenAI chat completions.
//
// Replaces the Claude reranker on the same interface (see claude-rerank.ts):
// same input shape, same Map<domain, score> return, same never-throw
// contract. Two reasons this exists rather than a second provider option:
//
//  1. Related Sites already runs on OpenAI for retrieval (text-embedding-3-
//     small), so ranking here makes the whole feature single-vendor — one
//     key to keep funded, one place to look when it breaks.
//  2. The org is enrolled in OpenAI's data-sharing tier, which grants a
//     large daily allowance across the mini/nano models. A rerank costs
//     roughly 2K tokens, so ordinary search traffic runs inside it.
//
// The tradeoff that buys: inputs and outputs on this path — including user
// search queries — are shared with OpenAI for model training. That is the
// price of the free tier and a deliberate choice, not an implementation
// detail.
const MODEL = "gpt-4.1-mini";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_SUMMARY_CHARS = 200;
const MAX_OUTPUT_TOKENS = 4000;

// Matches claude-rerank.ts. Splitting a large shortlist into concurrent
// batches cuts wall-clock latency roughly in proportion to the batch count,
// since each batch is its own request. Scores are independent per candidate,
// so batching changes only how fast results arrive, not what they are.
const BATCH_SIZE = 40;

export interface RerankCandidate {
  domain: string;
  category: string;
  semanticSummary?: string | null;
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
  // JSON mode requires an object at the top level, so a prompt asking for
  // "ONLY a JSON array" makes the model emit a single object — the first
  // candidate, scored, and the other 39 dropped. The prompt now asks for an
  // explicit {"scores": [...]} envelope, but the key the model picks has
  // still varied in testing ("result", "results", "scores"), so accept:
  //   - a bare array
  //   - any object value that is an array
  //   - a single {domain, score} object (the degenerate JSON-mode case)
  // Guessing one key name is exactly how this failed silently the first
  // time: parser looked for "results", model sent "result", every search
  // fell back to word-overlap with nothing logged.
  let arr: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.domain === "string" && typeof obj.score === "number") {
      arr = [obj];
    } else {
      arr = Object.values(obj).find(
        (v): v is unknown[] => Array.isArray(v) && v.length > 0 && typeof v[0] === "object",
      ) ?? null;
    }
  }
  if (!arr) return null;

  const scores = new Map<string, number>();
  for (const entry of arr) {
    const e = entry as Record<string, unknown>;
    if (e && typeof e.domain === "string" && typeof e.score === "number") {
      scores.set(e.domain, e.score);
    }
  }
  return scores.size > 0 ? scores : null;
}

/**
 * Scores each candidate's relevance (0-100) to `query`. Returns null on any
 * failure — missing key, timeout, malformed response, or any batch failing
 * once split — so callers fall back to keyword-overlap scoring. This must
 * never throw or block a search.
 */
export async function rerankWithOpenAI(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  if (!process.env.OPENAI_API_KEY || candidates.length === 0) return null;

  if (candidates.length <= BATCH_SIZE) return rerankBatch(query, candidates);

  const batches: RerankCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }
  const results = await Promise.all(batches.map((b) => rerankBatch(query, b)));

  // All-or-nothing, matching the Claude path: there is no principled way to
  // rank model-scored candidates against unscored ones, so a partial failure
  // falls the whole query back to word-overlap rather than producing a
  // half-scored result set.
  if (results.some((r) => r === null)) return null;

  const merged = new Map<string, number>();
  for (const result of results) for (const [d, s] of result!) merged.set(d, s);
  return merged;
}

async function rerankBatch(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  const items = candidates.map((c) => ({
    domain: c.domain,
    category: c.category,
    summary: c.semanticSummary ? c.semanticSummary.slice(0, MAX_SUMMARY_CHARS) : undefined,
  }));

  const prompt = `A user is searching a backlink/guest-post marketplace for sites matching this topic: "${query}"

Here is a JSON array of candidate sites (domain, category, and an optional content summary):
${JSON.stringify(items)}

Score every candidate's relevance to the search topic from 0 (irrelevant) to 100 (perfect match), based on semantic meaning, not just literal keyword overlap. Include an entry for EVERY candidate above.

Respond with ONLY a JSON object in this exact shape and no other text:
{"scores": [{"domain": "example.com", "score": 87}]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        // Ask for JSON at the API level rather than trusting the prompt —
        // this is what removes the "model wrote a sentence before the array"
        // failure that made the Claude path fall back to word-overlap.
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[openai-rerank] ${resp.status}: ${await resp.text().catch(() => "")}`);
      return null;
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    return text ? parseScores(text) : null;
  } catch (err) {
    console.error("[openai-rerank] failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
