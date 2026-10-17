// One JSON-mode chat-completions call, shared by the two model steps of the
// homepage assistant (lib/assistant/understand.ts and compose.ts).
//
// OpenAI rather than Anthropic for the same reason lib/ai/openai-rerank.ts
// and lib/ai/query-intent.ts give: search already runs on OpenAI, the org's
// data-sharing tier covers the mini models, and one vendor means one key to
// keep funded and one place to look when it breaks.
//
// Never throws. A failure of any kind — no key, timeout, non-2xx, unparseable
// reply — comes back as null and is logged, so each caller decides what the
// degraded behaviour is (the planner falls back to a plain search, the
// composer to an unranked list) instead of the whole chat turning into a 500.

export const ASSISTANT_MODEL = "gpt-4.1-mini";

export interface ChatJsonOptions {
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  model?: string;
  tag: string;
}

export interface ChatJsonResult {
  json: unknown;
  ms: number;
  inputTokens: number;
  outputTokens: number;
}

export async function chatJson(opts: ChatJsonOptions): Promise<ChatJsonResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(`[assistant:${opts.tag}] OPENAI_API_KEY is not set`);
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const t0 = Date.now();
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? ASSISTANT_MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        max_completion_tokens: opts.maxTokens,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[assistant:${opts.tag}] OpenAI ${resp.status}: ${await resp.text().catch(() => "")}`);
      return null;
    }
    const body = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) {
      console.error(`[assistant:${opts.tag}] empty reply`);
      return null;
    }
    let json: unknown;
    try {
      json = JSON.parse(stripCodeFences(text));
    } catch {
      console.error(`[assistant:${opts.tag}] unparseable reply: ${text.slice(0, 200)}`);
      return null;
    }
    return {
      json,
      ms: Date.now() - t0,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    console.error(`[assistant:${opts.tag}] failed:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}
