// Compares two runs of scripts/assistant-eval.mjs: per scenario, how much of
// the shown list and the extracted filters agree. Two identical runs give
// the noise floor; a run before and after a change shows what the change
// moved beyond that floor.
//
//   node scripts/assistant-eval-compare.mjs <a.json> <b.json>

import fs from "node:fs";

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
const byName = (r) => new Map(r.map((s) => [s.name, s]));
const A = byName(a);
const B = byName(b);
let sumOverlap = 0;
let n = 0;
console.log("scenario".padEnd(28), "intent", "spec", "top10 overlap", "shown A/B");
for (const [name, sa] of A) {
  const sb = B.get(name);
  if (!sb) continue;
  const la = sa.turns[sa.turns.length - 1];
  const lb = sb.turns[sb.turns.length - 1];
  const da = new Set((la.primary ?? []).map((p) => p.domain));
  const db = new Set((lb.primary ?? []).map((p) => p.domain));
  const inter = [...da].filter((d) => db.has(d)).length;
  const union = new Set([...da, ...db]).size;
  const overlap = union ? inter / union : 1;
  const specA = JSON.stringify(la.spec ?? la.state?.search ?? null);
  const specB = JSON.stringify(lb.spec ?? lb.state?.search ?? null);
  if (da.size || db.size) {
    sumOverlap += overlap;
    n++;
  }
  console.log(name.padEnd(28), (la.intent === lb.intent ? "same" : `${la.intent}≠${lb.intent}`).padEnd(6), (specA === specB ? "same" : "DIFF").padEnd(4), `${inter}/${union} (${Math.round(overlap * 100)}%)`.padEnd(14), `${da.size}/${db.size}`);
}
console.log(`mean top-10 Jaccard overlap across ${n} list scenarios: ${Math.round((sumOverlap / Math.max(1, n)) * 100)}%`);
