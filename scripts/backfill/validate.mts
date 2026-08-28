// Stage 2c: check agent output and build a redo list for whatever failed.
//
// Usage: npx tsx scripts/backfill/validate.mts <workDir>
//
// Exists because the loader's length gate alone is not enough. Rejecting a
// short summary at save time protects the database, but throws away a page
// that was already fetched and already summarized — and the domain then
// waits for a future pass to fetch it all over again. This stage instead
// pairs each failure back to its ORIGINAL fetched page and writes a redo
// chunk, so a repair agent rewrites only the failures with no re-fetching.
//
// Measured need: in the 100-domain pilot one agent produced summaries at a
// median of 540 chars against a 900+ target — 27% of that run was under
// spec. Consistency between agents, not raw quality, is Haiku's weak point.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const MIN_CHARS = 700;   // matches the loader's gate in save.mts
const TARGET_MIN = 900;  // what the prompt asks for

// Length alone is not a quality signal, and enforcing it created a new
// failure: one pilot agent hit the character target by emitting a fixed
// template ("This website, accessed via domain X, is titled 'Y'. The site
// functions as an information portal providing content and resources on
// various topics...") with a few scraped navigation words spliced in. All 40
// rows in that chunk were byte-similar. That output is worse than nothing —
// near-identical text embeds to near-identical vectors, so every one of
// those domains would look the same to the index and would surface for
// unrelated queries. Detected structurally: if many rows in a chunk share an
// opening, the agent templated rather than read.
const TEMPLATE_PHRASES = [
  "accessed via domain",
  "functions as an information portal",
  "appears designed to provide information",
  "key sections and navigation areas visible",
  "providing content and resources on various topics",
];
// Vocabulary overlap, not a shared opening. The first version of this check
// compared opening sentences and MISSED the real templated chunk outright:
// that template embedded the domain name in its first sentence ("This
// website, accessed via domain pmi.it, is titled ..."), so every opening was
// technically unique while every description was otherwise identical. A
// phrase blocklist caught it, but a blocklist only ever catches templates
// already seen once.
//
// Measuring average pairwise word-set overlap instead is template-shape
// agnostic: genuine descriptions of unrelated sites share only common
// English, whereas any fill-in-the-blank pattern shares nearly its whole
// vocabulary regardless of where the variable slots sit. Real chunks measure
// well under 0.3; the templated chunk measures far above it.
const VOCAB_OVERLAP_LIMIT = 0.45;

// Whole-chunk vocabulary overlap misses *category*-templating: an agent that
// writes one template per site-type ("This is a regional news portal
// delivering comprehensive coverage of local and regional news across its
// service area") produces overlap around 0.24 — above genuine work (0.08-0.17)
// but well under the single-template threshold, because different categories
// genuinely use different words. Compare only rows that share a primary
// category, where a template shows up at full strength.
const SAME_CATEGORY_OVERLAP_LIMIT = 0.5;
const MIN_ROWS_PER_CATEGORY = 3;

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));
}

function averagePairwiseOverlap(summaries: string[]): number {
  const sets = summaries.map(wordSet).filter((s) => s.size > 5);
  if (sets.length < 4) return 0;
  // Sample pairs rather than all N^2 — 60 pairs is plenty to separate 0.2
  // from 0.8 and keeps validation instant on large chunks.
  let total = 0, n = 0;
  for (let i = 0; i < sets.length && n < 60; i++) {
    for (let j = i + 1; j < sets.length && n < 60; j++) {
      const a = sets[i], b = sets[j];
      let inter = 0;
      for (const w of a) if (b.has(w)) inter++;
      total += inter / (a.size + b.size - inter);
      n++;
    }
  }
  return n ? total / n : 0;
}

const dir = process.argv[2] ?? "scripts/backfill/work/chunks";
const files = readdirSync(dir);

let ok = 0;
const failures: Array<{ chunk: string; page: unknown; reason: string }> = [];

for (const outName of files.filter((f) => f.startsWith("out-") && f.endsWith(".json"))) {
  const n = outName.replace("out-", "").replace(".json", "");
  const chunkName = `chunk-${n}.json`;
  if (!files.includes(chunkName)) { console.error(`[validate] no ${chunkName} for ${outName}`); continue; }

  const pages = JSON.parse(readFileSync(`${dir}/${chunkName}`, "utf8")) as Array<{ id: string; domain: string }>;
  let written: Array<{ id: string; summary?: string }> = [];
  try {
    written = JSON.parse(readFileSync(`${dir}/${outName}`, "utf8"));
  } catch (e) {
    console.error(`[validate] ${outName} is not valid JSON — whole chunk goes to redo`);
  }
  const byId = new Map(written.map((w) => [w.id, w]));

  // Chunk-level template check first: count how often the same opening
  // sentence recurs. This has to look at the batch, not the row — any single
  // templated description reads as plausible prose on its own.
  const overlap = averagePairwiseOverlap(written.map((w) => w.summary ?? ""));
  let chunkTemplated = overlap > VOCAB_OVERLAP_LIMIT;
  if (chunkTemplated) {
    console.error(`[validate] ${outName}: TEMPLATED — average pairwise vocabulary overlap ${overlap.toFixed(2)} (limit ${VOCAB_OVERLAP_LIMIT}). Whole chunk goes to redo.`);
  }

  // Per-category pass: group by the primary category segment and re-measure.
  if (!chunkTemplated) {
    const byCategory = new Map<string, string[]>();
    for (const w of written as Array<{ category?: string; summary?: string }>) {
      const primary = (w.category ?? "").split("/")[0].trim().toLowerCase();
      if (!primary) continue;
      if (!byCategory.has(primary)) byCategory.set(primary, []);
      byCategory.get(primary)!.push(w.summary ?? "");
    }
    for (const [primary, summaries] of byCategory) {
      if (summaries.length < MIN_ROWS_PER_CATEGORY) continue;
      const catOverlap = averagePairwiseOverlap(summaries);
      if (catOverlap > SAME_CATEGORY_OVERLAP_LIMIT) {
        console.error(`[validate] ${outName}: CATEGORY-TEMPLATED — "${primary}" rows overlap ${catOverlap.toFixed(2)} across ${summaries.length} rows (limit ${SAME_CATEGORY_OVERLAP_LIMIT}). Whole chunk goes to redo.`);
        chunkTemplated = true;
        break;
      }
    }
  }

  for (const page of pages) {
    const w = byId.get(page.id);
    const summary = typeof w?.summary === "string" ? w.summary.trim() : "";
    const lower = summary.toLowerCase();
    if (!w) failures.push({ chunk: n, page, reason: "missing from output" });
    else if (chunkTemplated) failures.push({ chunk: n, page, reason: "templated chunk" });
    else if (TEMPLATE_PHRASES.some((t) => lower.includes(t))) failures.push({ chunk: n, page, reason: "template phrasing" });
    else if (summary === "SKIP" || summary.startsWith("SKIP")) ok++; // deliberate, not a failure
    else if (summary.length < MIN_CHARS) failures.push({ chunk: n, page, reason: `too short (${summary.length})` });
    else ok++;
  }
}

const byReason = failures.reduce<Record<string, number>>((acc, f) => {
  const key = f.reason.replace(/\(\d+\)/, "(n)");
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(`[validate] usable: ${ok}   needing redo: ${failures.length}`);
for (const [reason, n] of Object.entries(byReason)) console.log(`           ${reason}: ${n}`);

if (failures.length) {
  const redoPages = failures.map((f) => f.page);
  const path = `${dir}/redo-1.json`;
  writeFileSync(path, JSON.stringify(redoPages, null, 2));
  console.log(`[validate] wrote ${redoPages.length} pages -> ${path}`);
  console.log(`[validate] run a repair agent over that file (target >=${TARGET_MIN} chars), output to ${dir}/out-redo1.json`);
} else {
  console.log("[validate] nothing to redo");
}
