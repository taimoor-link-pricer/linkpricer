// Gate for the public homepage AI search (app/api/homepage-search/route.ts):
// distinguishes a real marketplace search ("linen websites", "finance guest
// post under $200") from off-topic input a public chat box inevitably
// attracts ("can you clean my bathroom", "what is 2+2"). Without this, those
// queries still ran the full SQL prefilter + semantic rerank pipeline and came
// back with some nonsense "closest match" domain dressed up as a real result.
//
// Runs on OpenAI, not Anthropic, for the same reason lib/ai/openai-rerank.ts
// does: the Anthropic key has no credit, so every call here returned 400 and
// the never-fail contract below turned that into "assume on-topic" — i.e. the
// gate was open for everything, silently, which is exactly the state it exists
// to prevent. Verified live: "what is 2+2" and "can you clean my bathroom"
// both passed. Keeping search on one vendor is also one key to keep funded and
// one place to look when it breaks.
const MODEL = "gpt-4.1-mini";
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Classifies whether `query` is a legitimate backlink/guest-post marketplace
 * search versus unrelated small talk, a task request, trivia, or math.
 * Defaults to true (assume on-topic, let the real search run) on any
 * failure — missing key, timeout, malformed response — so this can never
 * block or break a real search.
 */
export async function isOnTopicQuery(query: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return true;

  const prompt = `You gate the search box of a backlink/guest-post marketplace. A legitimate query describes a website niche, topic, budget, or type of site to buy a backlink on — e.g. "SaaS blog about VPN", "finance guest post under $200", "linen websites". An illegitimate query is unrelated small talk, a task request, trivia, or math — e.g. "can you clean my bathroom", "what is 2+2", "tell me a joke", "who is the president".

Query: "${query}"

Respond with ONLY this JSON object and no other text: {"ok": true} if this is a legitimate marketplace search, or {"ok": false} if it is not.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 16,
        temperature: 0,
        // Same reason as the reranker: ask for JSON at the API level rather
        // than trusting the prompt not to wrap the answer in a sentence.
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[query-intent] OpenAI ${resp.status}: ${await resp.text().catch(() => "")}`);
      return true;
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    if (!text) return true;
    // Only an explicit, well-formed "false" rejects. Anything else — a
    // missing key, a reshaped reply, a model revision that answers in prose —
    // lets the search run, so a change on OpenAI's side can never start
    // silently refusing real searches.
    const parsed = JSON.parse(text) as { ok?: unknown };
    return parsed.ok === false ? false : true;
  } catch (err) {
    console.error("[query-intent] failed:", err instanceof Error ? err.message : err);
    return true;
  } finally {
    clearTimeout(timer);
  }
}
