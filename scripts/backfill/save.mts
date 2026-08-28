// Stage 2b: write model-written summaries into domains.semantic_summary.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill/save.mts <summaries.json>
// Input shape: [{ "id": "<domains.id>", "summary": "...", "category": "..." }]
//
// Target is `domains`, matched on the primary key `id` — NOT
// lp_domain_ai_metrics. That table has been unwritten since 2026-03-25,
// joins by text `domainUrl` (1,929 of its rows are orphans with no matching
// domain), and its vectors were built from `domain | category | country |
// language` rather than page content. `domains` is the live table, holds
// the existing 282K good descriptions, carries IDX_domains_embedding, and
// is what catalog-search.ts reads first.
import { readFileSync } from "node:fs";
import { sqlClient } from "./shared.mjs";

interface Written { id: string; summary: string; category?: string }

const file = process.argv[2];
if (!file) { console.error("usage: save.mts <summaries.json>"); process.exit(1); }

const rows = JSON.parse(readFileSync(file, "utf8")) as Written[];
const sql = sqlClient();

// Cuts at the last sentence-ending punctuation, but only when that keeps
// most of the text — a description with no punctuation in its final third is
// more likely oddly formatted than truncated, and is better left intact for
// the length gate to judge.
function trimToSentence(text: string): string {
  const lastStop = Math.max(text.lastIndexOf(". "), text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf("?"));
  if (lastStop < text.length * 0.66) return text;
  return text.slice(0, lastStop + 1);
}

let saved = 0, skipped = 0;
for (const r of rows) {
  // Guard against a model returning an apology, a refusal, or a truncated
  // fragment instead of a description. Short junk would still embed
  // cleanly and would then pollute search results invisibly — there is no
  // downstream stage that can catch it, so it has to be caught here.
  // 700 chars ~= 110 words, comfortably under the 150-200 word target but
  // above the terse output one pilot agent produced (median 540 chars, self-
  // reported 50-91 words). Rejecting rather than accepting short summaries
  // keeps the row NULL so a later pass retries it — accepting them would
  // mark the domain "done" with a thin description that no stage revisits.
  if (!r?.id || typeof r.summary !== "string" || r.summary.trim().length < 700) { skipped++; continue; }

  // Trim back to the last complete sentence. Agents that overshoot the
  // character ceiling hard-cut the text mid-word — one pilot chunk had 37 of
  // 40 descriptions ending like "...artist interviews, and c". The body of
  // those descriptions is fine and genuinely per-site, so a model redo would
  // be wasted spend; the defect is purely the severed trailing clause.
  // Deterministic here rather than in the prompt because no amount of
  // instruction reliably stops a model from running past a hard limit.
  const summary = trimToSentence(r.summary.trim());
  if (summary.length < 700) { skipped++; continue; }

  // WHERE semantic_summary IS NULL makes re-running a batch a no-op rather
  // than an overwrite: the existing 282K descriptions are good and must
  // never be clobbered by a rerun that picked up an already-filled row.
  const res = await sql`
    UPDATE domains
    SET semantic_summary = ${summary},
        semantic_category = COALESCE(${r.category?.trim() ?? null}, semantic_category),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${r.id} AND semantic_summary IS NULL
    RETURNING id`;
  if (res.length) saved++; else skipped++;
}
console.log(`[save] ${saved} written, ${skipped} skipped (already filled, or summary too short to trust)`);
