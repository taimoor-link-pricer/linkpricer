// Turns a search query into a 1536-d vector comparable with the embeddings
// already stored on domains.embedding.
//
// The model and dimensions are NOT free choices: the stored vectors were
// generated with OpenAI text-embedding-3-small at 1536 dims (see
// old-linpricer-app/scripts/generate_lp_embeddings.ts). Vectors from a
// different model — or the same model at different dimensions — occupy a
// different space entirely, so mixing them does not error, it just returns
// confident nonsense. Changing either constant means re-embedding all
// ~282K stored rows.
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const REQUEST_TIMEOUT_MS = 8_000;

// Raw fetch rather than the OpenAI SDK, matching the old backfill script:
// SDK v6 silently ignored the `dimensions` param, which would hand back
// 3072-d vectors that fail to compare against the 1536-d column. Also
// avoids adding a dependency for one endpoint.
export async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const cached = cache.get(trimmed);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: trimmed.slice(0, 8000), dimensions: EMBEDDING_DIMS }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      console.error(`[embedQuery] OpenAI ${resp.status}: ${await resp.text().catch(() => "")}`);
      return null;
    }
    const json = (await resp.json()) as { data?: Array<{ embedding?: number[] }> };
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) return null;
    cache.set(trimmed, vec);
    return vec;
  } catch (err) {
    // Never fail the search on this — the caller falls back to keyword-only
    // retrieval, which is exactly the behavior that shipped before vectors.
    console.error("[embedQuery] failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Bounded in-process cache. Query text repeats heavily (pagination, re-sorts,
// the same popular searches), and an embedding is deterministic for a given
// input, so this removes most of the per-search API call and its latency.
const CACHE_MAX = 500;
const cache = new Map<string, number[]>();
const _set = cache.set.bind(cache);
cache.set = (k: string, v: number[]) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return _set(k, v);
};

// Free fast path: if the query is itself a domain we already hold a vector
// for, reuse that vector instead of paying OpenAI to embed the string. This
// is the common shape of a Related Sites search ("find sites like mine"),
// where the input is the user's own domain — and it is strictly better than
// embedding the bare domain text, since the stored vector was built from the
// site's actual page content rather than from its name.
export async function embeddingForDomain(candidate: string): Promise<number[] | null> {
  const host = candidate.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\/?#].*$/, "");
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;

  try {
    const rows = await db.execute(
      sql`SELECT embedding::text AS embedding FROM domains WHERE domain = ${host} AND embedding IS NOT NULL LIMIT 1`
    );
    const raw = rows.rows[0]?.embedding as string | undefined;
    if (!raw) return null;
    const vec = JSON.parse(raw) as number[];
    return Array.isArray(vec) && vec.length === EMBEDDING_DIMS ? vec : null;
  } catch (err) {
    console.error("[embeddingForDomain] failed:", err);
    return null;
  }
}

export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
