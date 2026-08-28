// Stage 1: fetch homepages for domains missing a description.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill/fetch.mts [tier] [count]
//   tier  traffic | dr | all   (default: traffic)
//   count how many domains this run should fetch (default: 200)
//
// Writes scripts/backfill/work/pending-<timestamp>.json for the summarize
// stage. Dead/blocked/timing-out sites are dropped here rather than being
// handed to a model, which is the single biggest source of junk summaries:
// a model given a Cloudflare challenge page will cheerfully describe the
// challenge page.
import { writeFileSync, mkdirSync } from "node:fs";
import { sqlClient, targetQuery, WORK_DIR, type Tier, type FetchedPage } from "./shared.mjs";

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 12;
const MIN_TEXT_CHARS = 200;

async function fetchOne(row: { id: string; domain: string }): Promise<FetchedPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`https://${row.domain}/`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A real UA materially changes what these sites return; many
        // marketplace domains 403 a bare fetch client outright.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) return null;

    // Decode using the charset the server (or the document) declares, not
    // resp.text()'s UTF-8 assumption. Measured failure: rotter.net, a
    // Hebrew site served as windows-1255, decoded to pure replacement
    // characters — and a model handed that garbage still wrote a confident,
    // detailed description of the site from prior knowledge alone. That is
    // the worst failure mode available here: fluent, unfounded text that
    // embeds cleanly and cannot be detected downstream.
    const buf = Buffer.from(await resp.arrayBuffer());
    const headerCharset = /charset=([\w-]+)/i.exec(resp.headers.get("content-type") ?? "")?.[1];
    const sniff = buf.subarray(0, 2048).toString("latin1");
    const metaCharset = /charset=["']?([\w-]+)/i.exec(sniff)?.[1];
    const charset = (headerCharset ?? metaCharset ?? "utf-8").toLowerCase();
    let html: string;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = buf.toString("utf8");
    }

    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);

    // Too little text means a JS-only shell, a parking page, or a bot wall.
    // None of those describe the site, so they are not worth a model call.
    if (text.length < MIN_TEXT_CHARS) return null;

    // Final guard: if decoding still produced substantial replacement
    // characters, the text is unreadable and must never reach a model —
    // see the decode comment above for why that is dangerous rather than
    // merely useless.
    const replacementRatio = (text.match(/\uFFFD/g)?.length ?? 0) / text.length;
    if (replacementRatio > 0.02) return null;

    return { id: row.id, domain: row.domain, title, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const tier = (process.argv[2] as Tier) ?? "traffic";
const count = Number(process.argv[3] ?? 200);

const sql = sqlClient();
const rows = (await sql.query(targetQuery(tier, count))) as Array<{ id: string; domain: string }>;
console.log(`[fetch] tier=${tier} target=${rows.length} domains`);

const out: FetchedPage[] = [];
let done = 0;
for (let i = 0; i < rows.length; i += CONCURRENCY) {
  const slice = rows.slice(i, i + CONCURRENCY);
  const results = await Promise.all(slice.map(fetchOne));
  for (const r of results) if (r) out.push(r);
  done += slice.length;
  process.stdout.write(`\r[fetch] ${done}/${rows.length} attempted, ${out.length} usable`);
}
console.log();

mkdirSync(WORK_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = `${WORK_DIR}/pending-${stamp}.json`;
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`[fetch] wrote ${out.length} pages -> ${file}`);
console.log(`[fetch] ${rows.length - out.length} unreachable/blocked/thin (skipped, will be retried on a later run)`);
