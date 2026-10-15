// Vector (meaning-based) candidate retrieval for the catalog search.
//
// This is the recall half of the search. The keyword prefilter in
// catalog-search.ts can only find domains whose text literally contains the
// query words; this finds domains whose *description* means something
// similar, which is how a methylene-blue query reaches a science-news site
// that never uses the word "supplement".
import { neon } from "@neondatabase/serverless";
import { sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
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

// The deep list asks for far more rows than the shortlist does, and with an
// iterative scan a larger ef is *faster*, not slower, because the index
// reaches the LIMIT in fewer passes: measured for 1,000 rows, ef 400 took
// 1.0-2.9s against 0.8s at ef 1000. So ef follows the row limit, up to
// pgvector's maximum.
const MAX_EF_SEARCH = 1000;

// Ceiling on index tuples an iterative scan may visit while looking for rows
// that pass the caller's filters. This is what keeps a very selective filter
// (one small country plus a DR floor) from walking the whole index: the scan
// stops here and returns what it found. Rows it never reaches are far from
// the query — well under the relevance floor applied in catalog-search.ts —
// so stopping costs nothing that would have been shown.
const HEAD_MAX_SCAN_TUPLES = 8000;
// For the deep list the bound scales with the rows asked for (10,000 tuples
// for the full 1,000-row list) unless the caller sets its own. It was 20,000
// until a full read under a narrow filter (an English query limited to
// Germany) ran into the 45s timeout cold and returned nothing at all. Half
// the budget still fills the list for any broad filter — a large country
// needs about 3,300 tuples for 1,000 rows — and under a narrow one gives up
// only the sites furthest from the query, which sit under the relevance
// floor anyway.
const DEEP_SCAN_TUPLES_PER_ROW = 10;

const QUERY_TIMEOUT_MS = 10_000;
// How long the first page keeps waiting for a *filtered* shortlist read once
// the unfiltered one is already in hand (see headVectorCandidates).
const FILTERED_HEAD_GRACE_MS = 1_000;
// The deep list is loaded by its own background request after the first page
// is already on screen, so it can be given far longer. It needs it: a query
// nobody has run recently walks index pages Neon has to fetch from storage,
// measured at 7-11s for 1,000 rows unfiltered and 9-27s under a country
// filter, against ~2s once those pages are warm.
const DEEP_QUERY_TIMEOUT_MS = 45_000;

const dialect = new PgDialect();

export interface VectorCandidate {
  id: string;
  similarity: number;
}

// One row of the deep list: enough to filter, count, sort and rank it without
// a second query. Display fields and offers are fetched later, only for the
// page actually being looked at.
export interface DeepCandidate extends VectorCandidate {
  domain: string;
  lang: string | null;
  dr: number | null;
  traffic: number | null;
  keywords: number | null;
  // Has at least one live offer. A domain without one must not be shown.
  sellable: boolean;
  // Cheapest live offer in USD — only when the caller asked for prices
  // (`bestPriceUsd`), otherwise null regardless of what is for sale.
  bestPrice: number | null;
  // Only when the caller asked for grades (`withGrade`).
  aiGrade: string | null;
}

interface KnnSettings {
  efSearch: number;
  maxScanTuples: number;
  timeoutMs: number;
  // Lets a caller give up on the read early (in addition to the timeout).
  cancel?: AbortSignal;
}

// Runs `query` in one HTTP transaction behind the HNSW session settings.
//
// Own connection rather than the shared drizzle client because these are
// session settings, and lib/db uses the Neon *HTTP* driver where every
// statement is an independent request — a SET sent that way applies to a
// session that is already gone by the time the next query runs. Batching the
// settings and the query into one transaction is what makes them apply.
//
// Three settings beyond ef_search, all needed once filters live inside the
// vector query:
//
//  - iterative_scan: an HNSW scan normally fetches ef_search neighbours and
//    *then* applies the WHERE clause, so a country filter over 150 neighbours
//    returns however many of those 150 happen to be in that country — 22 for
//    "sport" + US, measured, against 1,000+ that exist. An iterative scan
//    keeps walking the index until LIMIT rows have passed the filter.
//  - max_scan_tuples: the bound on that walk (see the constants above).
//  - enable_seqscan off: left to itself the planner answers a filtered query
//    with a sequential scan that computes the exact distance for every row
//    passing the filter. That is fine warm and unusable cold — measured on
//    the US subset (46K vectors) at 2.3s warm and 23-55s cold, because each
//    vector is a separate 6KB read. The index path is bounded either way.
async function runKnn<T>(query: SQL, settings: KnnSettings, label: string): Promise<T[] | null> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;

  // Hard cap on how long the search will wait for this read. Without one the
  // request simply hangs on whatever the connection is doing — observed live
  // at 75s and again at 299s (ending in ECONNRESET) — and since the routes
  // that call this run under `maxDuration = 60`, that is not a slow search,
  // it is a 504 where a keyword-only answer was available the whole time.
  // Abort turns the worst case back into the documented degradation below.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  const onCancel = () => controller.abort();
  settings.cancel?.addEventListener("abort", onCancel, { once: true });
  if (settings.cancel?.aborted) controller.abort();
  const client = neon(rawUrl.replace(/[&?]channel_binding=require/g, ""), {
    fetchOptions: { signal: controller.signal },
  });

  try {
    const compiled = dialect.sqlToQuery(query);
    const results = await client.transaction([
      client`SELECT set_config('hnsw.ef_search', ${String(settings.efSearch)}, true)`,
      client`SELECT set_config('hnsw.iterative_scan', 'relaxed_order', true)`,
      client`SELECT set_config('hnsw.max_scan_tuples', ${String(settings.maxScanTuples)}, true)`,
      client`SELECT set_config('enable_seqscan', 'off', true)`,
      client.query(compiled.sql, compiled.params),
    ]);
    return results[results.length - 1] as T[];
  } catch (err) {
    // Vector retrieval is additive: on failure the search still runs on the
    // keyword branch alone, which is the pre-vector behavior. A timeout takes
    // this same path deliberately — half a search now beats no search in 60s.
    // A read the caller walked away from is not a failure worth a log line.
    if (!settings.cancel?.aborted) console.error(`[${label}] failed:`, err);
    return null;
  } finally {
    clearTimeout(timer);
    settings.cancel?.removeEventListener("abort", onCancel);
  }
}

// One shortlist read. null = the read failed or was abandoned; [] = it ran
// and nothing matched. Callers that need to tell those apart use this.
async function headRead(
  vec: number[], limit: number, filter: SQL | undefined, timeoutMs: number, cancel?: AbortSignal,
): Promise<VectorCandidate[] | null> {
  const literal = toVectorLiteral(vec);
  const rows = await runKnn<{ id: string; similarity: number }>(
    sql`SELECT d.id, 1 - (d.embedding <=> ${literal}::vector) AS similarity
        FROM domains d
        WHERE d.embedding IS NOT NULL ${filter ?? sql``}
        ORDER BY d.embedding <=> ${literal}::vector
        LIMIT ${limit}`,
    { efSearch: EF_SEARCH, maxScanTuples: HEAD_MAX_SCAN_TUPLES, timeoutMs, cancel },
    "vectorCandidates",
  );
  // relaxed_order may hand rows back slightly out of sequence; callers rank
  // by position, so restore strict order here.
  return rows && rows
    .map((r) => ({ id: r.id, similarity: Number(r.similarity) }))
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Nearest neighbours to `vec` among domains that carry an embedding and pass
 * `filter`.
 *
 * `filter` is a run of `AND ...` clauses written against the alias `d`
 * (domains), or omitted for an unfiltered search. It has to be applied here,
 * inside the index scan, and not afterwards: taking the nearest 150 of the
 * whole catalogue and filtering *those* by country is what made a filtered
 * search return a handful of rows where hundreds existed.
 */
export async function vectorCandidates(vec: number[], limit: number, filter?: SQL): Promise<VectorCandidate[]> {
  return (await headRead(vec, limit, filter, QUERY_TIMEOUT_MS)) ?? [];
}

/**
 * The first page's shortlist read when filters are on: the filtered
 * neighbours if they are there promptly, otherwise the unfiltered ones.
 *
 * Filtering inside the scan is the right answer, and with the index in the
 * database's cache it costs a few hundred milliseconds — often less than the
 * unfiltered read. But it means fetching every candidate's row to test it,
 * and on a search nobody has run lately, with index and rows both coming
 * from storage, that is several times the work: measured under a US filter
 * at 5.6s, 6.5s and then past 7s three times running, against 2.7-3.5s
 * unfiltered; under a narrow filter it does not finish at all before the
 * timeout. A first page cannot wait on that, and a vector read that times
 * out leaves only domain-name matches — far worse than what this search
 * returned before filters moved into the scan.
 *
 * So both reads start together and the unfiltered one sets the pace. If the
 * filtered read is back by the time the unfiltered one is, or within
 * FILTERED_HEAD_GRACE_MS after, it is used. If not, it is abandoned and the
 * unfiltered neighbours are returned with `filtered: false`: the caller's
 * own SQL still applies the filters to them, exactly as it always did, so
 * the first page is never slower or worse than it used to be — and the full
 * filtered list still arrives afterwards through the deep read.
 */
export async function headVectorCandidates(
  vec: number[], limit: number, filter: SQL,
): Promise<{ hits: VectorCandidate[]; filtered: boolean }> {
  const dropPlain = new AbortController();
  const dropFiltered = new AbortController();
  const plainRead = headRead(vec, limit, undefined, QUERY_TIMEOUT_MS, dropPlain.signal);
  const filteredRead = headRead(vec, limit, filter, QUERY_TIMEOUT_MS, dropFiltered.signal);

  const first = await Promise.race([
    filteredRead.then((hits) => ({ from: "filtered" as const, hits })),
    plainRead.then((hits) => ({ from: "plain" as const, hits })),
  ]);
  if (first.from === "filtered" && first.hits) {
    dropPlain.abort();
    return { hits: first.hits, filtered: true };
  }

  const plain = await plainRead;
  if (!plain) {
    // The unfiltered read failed outright; the filtered one is all there is.
    const filtered = await filteredRead;
    return { hits: filtered ?? [], filtered: filtered !== null };
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const inGrace = await Promise.race([
    filteredRead,
    new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), FILTERED_HEAD_GRACE_MS); }),
  ]);
  clearTimeout(timer);
  if (inGrace) return { hits: inGrace, filtered: true };
  dropFiltered.abort();
  return { hits: plain, filtered: false };
}

/**
 * The deep list: up to `limit` nearest neighbours that pass `filter`, each
 * with the handful of columns needed to filter, count and sort it.
 *
 * Returns null when the read failed or timed out, which callers must treat
 * differently from an empty list — "nothing else is related" is an answer,
 * "the lookup broke" is not, and only the first may be cached or counted.
 *
 * Prices and grades are opt-in because each costs an extra lookup per row
 * and most searches filter on neither. `bestPriceUsd` is the caller's
 * USD-normalised cheapest-live-offer subquery, written against `d.id` —
 * passed in rather than rebuilt here so the price a row is filtered on is
 * the same expression the rest of the search uses.
 */
export async function deepVectorCandidates(
  vec: number[],
  limit: number,
  opts: { filter?: SQL; bestPriceUsd?: SQL; withGrade?: boolean; maxScanTuples?: number },
): Promise<DeepCandidate[] | null> {
  const literal = toVectorLiteral(vec);
  const rows = await runKnn<Record<string, unknown>>(
    sql`WITH nn AS MATERIALIZED (
          SELECT d.id, 1 - (d.embedding <=> ${literal}::vector) AS similarity
          FROM domains d
          WHERE d.embedding IS NOT NULL ${opts.filter ?? sql``}
          ORDER BY d.embedding <=> ${literal}::vector
          LIMIT ${limit}
        )
        SELECT nn.id, nn.similarity, LOWER(d.domain) AS domain,
               d.language_written_in_website AS lang,
               d.domain_rating::float AS dr, d.org_traffic AS traffic, d.org_keywords AS keywords,
               EXISTS (
                 SELECT 1 FROM marketplace_offers mo WHERE mo.domain_id = d.id AND mo.available = true AND mo.min_price::float > 0
                 UNION ALL
                 SELECT 1 FROM supplier_offers so WHERE so.domain_id = d.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0
               ) AS sellable,
               ${opts.bestPriceUsd ?? sql`NULL::float`} AS best_price,
               ${opts.withGrade ? sql`ai."valueGrade"` : sql`NULL::text`} AS ai_grade
        FROM nn
        JOIN domains d ON d.id = nn.id
        ${opts.withGrade ? sql`LEFT JOIN lp_domain_ai_metrics ai ON ai."domainUrl" = d.domain` : sql``}`,
    {
      efSearch: Math.min(MAX_EF_SEARCH, Math.max(EF_SEARCH, limit)),
      maxScanTuples: opts.maxScanTuples ?? limit * DEEP_SCAN_TUPLES_PER_ROW,
      timeoutMs: DEEP_QUERY_TIMEOUT_MS,
    },
    "deepVectorCandidates",
  );
  if (!rows) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return rows
    .map((r) => ({
      id: r.id as string,
      similarity: Number(r.similarity),
      domain: r.domain as string,
      lang: (r.lang as string | null) ?? null,
      dr: num(r.dr),
      traffic: num(r.traffic),
      keywords: num(r.keywords),
      sellable: r.sellable === true,
      bestPrice: num(r.best_price),
      aiGrade: (r.ai_grade as string | null) ?? null,
    }))
    .sort((a, b) => b.similarity - a.similarity);
}
