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

// Splitting the shortlist into concurrent batches cuts wall-clock latency
// roughly in proportion to the batch count, since each is its own request
// and scores are independent per candidate — batching changes how fast
// results arrive, not what they are.
//
// 40 works now that the reply is positional scores rather than
// {domain, score} objects (see the prompt below). The old format made the
// model retype every domain it had just been given, and output length is
// what dominates latency here: measured on 20 candidates, 310 output tokens
// / 4743ms as objects versus 43 tokens / 1497ms as bare scores. At 40
// candidates the terse form still answers in ~1.9s — faster than 20
// candidates ever were in the old format. 60 was measurably erratic (one
// run 9.4s), so 40 is the ceiling.
const BATCH_SIZE = 40;

// Chat completions default to temperature 1.0, which is wrong for a scoring
// task: measured over four identical requests, the top 10 agreed only
// 8.0/10 on average, so the same search re-run visibly reshuffled its
// results. At 0 that rises to 9.5/10 at identical latency. (OpenAI does not
// guarantee bit-exact determinism, hence 9.5 rather than 10.)
const TEMPERATURE = 0;

// A batch that fails is retried once before its candidates are dropped —
// most failures here are timeouts or transient 5xx, not deterministic ones.
const BATCH_RETRIES = 1;

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

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

// The reply is positional — a bare array of scores, one per candidate, in
// the order they were listed. That is what makes the batch fast (the model
// no longer retypes 40 domains it was just given), but it moves the burden
// of correctness onto alignment: if the model returns 39 numbers for 40
// candidates, every score after the gap lands on the WRONG site and the
// result looks perfectly well-formed. So a length mismatch fails the batch
// rather than being patched up — a dropped batch costs recall, a misaligned
// one silently corrupts the ranking.
//
// The keyed {domain, score} shape is still accepted as a fallback: JSON mode
// plus a model revision has changed this reply's shape before (parser looked
// for "results", model sent "result", every search silently fell back to
// word-overlap), and keyed entries carry their own alignment so they need no
// length check.
function parseScores(raw: string, candidates: RerankCandidate[]): Map<string, number> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return null;
  }

  // Accept a bare array, or any array-valued property whatever it is named.
  let arr: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.domain === "string" && typeof obj.score === "number") {
      arr = [obj];
    } else {
      arr = Object.values(obj).find((v): v is unknown[] => Array.isArray(v)) ?? null;
    }
  }
  if (!arr || arr.length === 0) return null;

  const scores = new Map<string, number>();

  if (typeof arr[0] === "number") {
    if (arr.length !== candidates.length) {
      console.error(
        `[openai-rerank] misaligned reply: ${arr.length} scores for ${candidates.length} candidates — dropping batch`
      );
      return null;
    }
    for (let i = 0; i < candidates.length; i++) {
      const v = arr[i];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        console.error(`[openai-rerank] non-numeric score at position ${i} — dropping batch`);
        return null;
      }
      scores.set(candidates[i].domain, clamp(v));
    }
    return scores;
  }

  for (const entry of arr) {
    const e = entry as Record<string, unknown>;
    if (e && typeof e.domain === "string" && typeof e.score === "number") {
      scores.set(e.domain, clamp(e.score));
    }
  }
  return scores.size > 0 ? scores : null;
}

/**
 * Scores each candidate's relevance (0-100) to `query`.
 *
 * Returns null only when *nothing* could be scored (missing key, or every
 * batch failed), so callers fall back to keyword-overlap scoring. When some
 * batches succeed the returned map covers only the candidates that were
 * actually scored — callers must treat a missing domain as "not ranked" and
 * drop it, never as a zero. This must never throw or block a search.
 */
export async function rerankWithOpenAI(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  if (!process.env.OPENAI_API_KEY || candidates.length === 0) return null;

  if (candidates.length <= BATCH_SIZE) return rerankBatchWithRetry(query, candidates);

  // Dealt round-robin rather than sliced into contiguous blocks. Batches are
  // scored independently and the prompt caps how many candidates may score
  // above 90, so a contiguous split makes that cap wildly unfair: candidates
  // arrive in relevance order, so block 1 holds the 40 strongest and they
  // compete against each other for the quota, while the last block holds the
  // weakest and hands out the same number of high scores unopposed.
  //
  // Measured: on "football news", football365.com (vector rank 35) landed in
  // block 1 and fell out of the top 30 entirely, beaten by futbik.com
  // (vector rank 94, and a lower cosine) which had block 3 largely to
  // itself. Dealing round-robin gives every batch the same spread of
  // quality, which is what makes the per-batch scoring comparable across
  // batches.
  const batchCount = Math.ceil(candidates.length / BATCH_SIZE);
  const batches: RerankCandidate[][] = Array.from({ length: batchCount }, () => []);
  candidates.forEach((c, i) => batches[i % batchCount].push(c));
  const results = await Promise.all(batches.map((b) => rerankBatchWithRetry(query, b)));

  // Previously all-or-nothing: any failed batch discarded every other
  // batch's scores and fell the whole search back to word-overlap. Measured
  // cost of that rule at 8 concurrent batches: one slow call on "football
  // news" spent 35s and returned the *unranked* ordering — strictly worse
  // than not widening the shortlist at all.
  //
  // The reasoning behind the old rule still holds — model-scored and
  // unscored candidates cannot be ranked against each other — so this does
  // not mix them. It returns only the domains that were actually scored and
  // lets the caller drop the rest, which costs recall on a failed batch
  // instead of costing the entire ranking.
  const merged = new Map<string, number>();
  for (const result of results) if (result) for (const [d, s] of result) merged.set(d, s);
  if (merged.size === 0) return null;
  const failed = results.filter((r) => r === null).length;
  if (failed > 0) {
    console.error(
      `[openai-rerank] ${failed}/${batches.length} batches failed; ranking ${merged.size}/${candidates.length} candidates`
    );
  }
  return merged;
}

// One retry before a batch's candidates are given up on. Failures on this
// path are dominated by timeouts and transient 5xx, which a second attempt
// clears; a deterministic failure (bad key, malformed prompt) costs one
// extra call and then gives up rather than looping.
async function rerankBatchWithRetry(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  for (let attempt = 0; attempt <= BATCH_RETRIES; attempt++) {
    const result = await rerankBatch(query, candidates);
    if (result) return result;
  }
  return null;
}

async function rerankBatch(
  query: string,
  candidates: RerankCandidate[]
): Promise<Map<string, number> | null> {
  // A numbered plain-text list rather than JSON: the reply is positional, so
  // the numbering is what the model indexes its answer against, and dropping
  // the JSON scaffolding costs nothing to comprehension.
  //
  // The scoring instruction is deliberately strict about spreading scores.
  // Asked plainly to "score 0-100", the model collapses onto a handful of
  // values — measured across 8 live searches, 7.5 distinct scores per 30
  // results at BATCH_SIZE 20 fell to 3.9 at 40. That matters more than it
  // sounds: batches are scored independently, so ties are broken by
  // shortlist order rather than by judgment, and at 4 distinct values across
  // 160 candidates most of the ranking is arbitrary. ("football news"
  // returned 30 results carrying just two different scores, with
  // football365.com displaced by a keyword-shaped domain.) Demanding the
  // full range restores 40/40 distinct scores at the same latency and puts
  // football365.com back at the top.
  //
  // "how substantial/authoritative" is in there for a specific failure the
  // embeddings cannot fix: moneycontrol.com and moneycontrol.me have nearly
  // identical descriptions and therefore nearly identical vectors, so
  // telling the real site from the lookalike is the model's job, and it has
  // to be asked to do it.
  //
  // MAX_SUMMARY_CHARS stays at 200 even though summaries average ~890 chars
  // and input length is nearly free here (2.2K vs 6.9K input tokens measured
  // at the same ~2s latency). Sending the full text was tested and does not
  // change the ranking: 200-chars vs full agreed 7-8/10 on the top ten,
  // which is exactly the run-to-run agreement of the *identical* prompt with
  // itself. The difference is noise, so the extra input tokens buy nothing.
  const lines = candidates
    .map((c, i) => {
      const summary = c.semanticSummary ? c.semanticSummary.slice(0, MAX_SUMMARY_CHARS) : "";
      return `${i + 1}. ${c.domain} | ${c.category} | ${summary}`;
    })
    .join("\n");

  const prompt = `A user is searching a backlink/guest-post marketplace for sites matching this topic: "${query}"

Candidate sites, numbered in order:
${lines}

Score each candidate's relevance from 0 to 100 by semantic meaning, not literal keyword overlap. Judge both topical fit AND how substantial/authoritative the site is for that topic.
Use the full range and be strict: at most 5 candidates may score above 90, and most should fall below 70. Avoid repeating the same score — break ties by quality.

Reply with ONLY this JSON object and no other text:
{"s":[<score for 1>,<score for 2>,...]}
It must contain exactly ${candidates.length} numbers, in the same order as the list above. Do not include domain names.`;

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
        temperature: TEMPERATURE,
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
    return text ? parseScores(text, candidates) : null;
  } catch (err) {
    console.error("[openai-rerank] failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
