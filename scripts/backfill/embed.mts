// Stage 3: embed descriptions that don't yet have a vector.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill/embed.mts [count]
//
// Model and dimensions must match the 282K vectors already in the column —
// text-embedding-3-small @ 1536. A different model, or the same model at
// different dimensions, produces vectors in an unrelated space: nothing
// errors, cosine distance just returns meaningless neighbours. Changing
// either constant means re-embedding every row.
//
// Cost is negligible: $0.02 per 1M tokens, so the entire 226K-domain gap
// is a couple of dollars. Never optimize this stage; optimize the fetch.
import { sqlClient } from "./shared.mjs";

const MODEL = "text-embedding-3-small";
const DIMS = 1536;
const BATCH = 100;

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY is not set"); process.exit(1); }

const limit = Number(process.argv[2] ?? 1000);
const sql = sqlClient();

const rows = (await sql`
  SELECT id, semantic_summary FROM domains
  WHERE semantic_summary IS NOT NULL AND embedding IS NULL
  LIMIT ${limit}`) as Array<{ id: string; semantic_summary: string }>;

console.log(`[embed] ${rows.length} rows to embed`);
let done = 0;

for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, dimensions: DIMS, input: slice.map((r) => r.semantic_summary.slice(0, 8000)) }),
  });
  if (!resp.ok) {
    // Stop rather than skip: a 429/quota error would otherwise burn through
    // the whole work list leaving silent holes that look like completed work.
    console.error(`[embed] OpenAI ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }
  const json = (await resp.json()) as { data: Array<{ index: number; embedding: number[] }> };
  for (const item of json.data) {
    const row = slice[item.index];
    if (!row || item.embedding.length !== DIMS) continue;
    await sql`UPDATE domains SET embedding = ${`[${item.embedding.join(",")}]`}::vector WHERE id = ${row.id}`;
  }
  done += slice.length;
  process.stdout.write(`\r[embed] ${done}/${rows.length}`);
}
console.log(`\n[embed] done`);
