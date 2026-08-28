// Vector (meaning-based) candidate retrieval for the catalog search.
//
// This is the recall half of the search. The keyword prefilter in
// catalog-search.ts can only find domains whose text literally contains the
// query words; this finds domains whose *description* means something
// similar, which is how a methylene-blue query reaches a science-news site
// that never uses the word "supplement".
import { neon } from "@neondatabase/serverless";
import { toVectorLiteral } from "./query-embedding";

// pgvector's HNSW index will not examine more candidates than hnsw.ef_search,
// regardless of the LIMIT asked for: at the default of 40, `LIMIT 1500`
// returns 40 rows and the extra 1460 are silently never considered. So this
// value — not the LIMIT — is the real recall knob. Measured against the
// live index (282K vectors): ef 100 -> 421ms, ef 500 -> 2.6s, ef 1000 ->
// 2.7s. 400 keeps the whole retrieval comfortably under a second or two
// while returning enough candidates to survive the "has a live offer"
// filter that runs after this.
const EF_SEARCH = 150;

export interface VectorCandidate {
  id: string;
  similarity: number;
}

/**
 * Nearest neighbours to `vec` among domains that carry an embedding.
 *
 * Runs on its own connection rather than through the shared drizzle client
 * because `SET hnsw.ef_search` is session state, and lib/db uses the Neon
 * *HTTP* driver where every statement is an independent request — a SET sent
 * that way applies to a session that is already gone by the time the next
 * query runs. Batching both statements into one HTTP transaction is what
 * makes the setting actually apply.
 */
export async function vectorCandidates(vec: number[], limit: number): Promise<VectorCandidate[]> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return [];
  const sql = neon(rawUrl.replace(/[&?]channel_binding=require/g, ""));
  const literal = toVectorLiteral(vec);

  try {
    const [, rows] = await sql.transaction([
      sql`SELECT set_config('hnsw.ef_search', ${String(EF_SEARCH)}, false)`,
      sql`SELECT id, 1 - (embedding <=> ${literal}::vector) AS similarity
          FROM domains
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${literal}::vector
          LIMIT ${limit}`,
    ]);
    return (rows as Array<{ id: string; similarity: number }>).map((r) => ({
      id: r.id,
      similarity: Number(r.similarity),
    }));
  } catch (err) {
    // Vector retrieval is additive: on failure the search still runs on the
    // keyword branch alone, which is the pre-vector behavior.
    console.error("[vectorCandidates] failed:", err);
    return [];
  }
}
