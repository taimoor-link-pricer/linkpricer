// Gate for the public homepage AI search (app/api/homepage-search/route.ts):
// distinguishes a real marketplace search ("linen websites", "finance guest
// post under $200") from off-topic input a public chat box inevitably
// attracts ("can you clean my bathroom", "what is 2+2"). Without this, those
// queries still ran the full SQL prefilter + Claude rerank pipeline and came
// back with some nonsense "closest match" domain dressed up as a real result.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const REQUEST_TIMEOUT_MS = 8_000;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/**
 * Classifies whether `query` is a legitimate backlink/guest-post marketplace
 * search versus unrelated small talk, a task request, trivia, or math.
 * Defaults to true (assume on-topic, let the real search run) on any
 * failure — missing key, timeout, malformed response — so this can never
 * block or break a real search.
 */
export async function isOnTopicQuery(query: string): Promise<boolean> {
  const anthropic = getClient();
  if (!anthropic) return true;

  const prompt = `You gate the search box of a backlink/guest-post marketplace. A legitimate query describes a website niche, topic, budget, or type of site to buy a backlink on — e.g. "SaaS blog about VPN", "finance guest post under $200", "linen websites". An illegitimate query is unrelated small talk, a task request, trivia, or math — e.g. "can you clean my bathroom", "what is 2+2", "tell me a joke", "who is the president".

Query: "${query}"

Respond with ONLY the single word "yes" if this is a legitimate marketplace search, or "no" if it is not. No other text.`;

  try {
    const response = await anthropic.messages.create(
      { model: MODEL, max_tokens: 5, messages: [{ role: "user", content: prompt }] },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return true;
    return textBlock.text.trim().toLowerCase().startsWith("y");
  } catch (err) {
    console.error("[query-intent] failed:", err instanceof Error ? err.message : err);
    return true;
  }
}
