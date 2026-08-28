// Stage 2: write descriptions with OpenAI, replacing the Claude subagent step.
//
// Usage: npx tsx --env-file=.env.local scripts/backfill/describe.mts [count] [concurrency]
//
// Why a script and not agents. The subagent approach failed in four distinct
// ways over ~1,100 domains, each with a confident success report: one chunk
// was a single fill-in-the-blank template, one was a template per site
// category, one agent wrote no file at all while claiming completion, and one
// hard-cut every description mid-word at the character ceiling. On top of
// that, the whole run stops dead when the Claude Code subscription hits its
// monthly limit — which it did twice.
//
// A plain loop has none of those failure modes: it cannot decide to delegate,
// cannot script a template, writes to the database row by row, and resumes by
// re-querying which rows are still NULL. It also runs inside the org's
// OpenAI free tier, so it does not compete with interactive work for budget.
import { sqlClient } from "./shared.mjs";

const MODEL = "gpt-4.1-mini";
const TIMEOUT_MS = 45_000;
const MIN_CHARS = 700;
const FETCH_TIMEOUT_MS = 12_000;
const MIN_TEXT_CHARS = 200;

const SYSTEM = `You write website descriptions that will be turned into search embeddings for a link-marketplace catalogue.

Describe what the SITE is and does: its subject matter, main sections, and audience. Write in English even if the site is not, and say which language and country it serves when that is clear.

Be specific to THIS site. A reader who already knows the category should still learn something from your description: name the actual sections, recurring topics, features, or products visible in the text. Never write a description that would fit any other site in the same category.

Describe the site in general, not today's headlines — this text is embedded for search and must not go stale.

Do not invent anything. Describe only what is visible in the supplied text. If the text is too thin or garbled to describe honestly, reply with exactly: SKIP

Write 900-1300 characters and end on a complete sentence. Reply with a JSON object: {"category": "Primary / Secondary / Specific Focus", "summary": "Page Title: <title>. <description>"}`;

async function fetchPage(domain: string): Promise<{ title: string; text: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`https://${domain}/`, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) return null;

    // Decode with the declared charset — resp.text() assumes UTF-8, and a
    // mis-decoded page becomes replacement characters that a model will
    // still confidently describe from prior knowledge.
    const buf = Buffer.from(await resp.arrayBuffer());
    const headerCharset = /charset=([\w-]+)/i.exec(resp.headers.get("content-type") ?? "")?.[1];
    const metaCharset = /charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString("latin1"))?.[1];
    let html: string;
    try {
      html = new TextDecoder((headerCharset ?? metaCharset ?? "utf-8").toLowerCase()).decode(buf);
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
      .slice(0, 3500);

    if (text.length < MIN_TEXT_CHARS) return null;
    if ((text.match(/�/g)?.length ?? 0) / text.length > 0.02) return null;
    return { title, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function trimToSentence(text: string): string {
  const last = Math.max(text.lastIndexOf(". "), text.lastIndexOf("."), text.lastIndexOf("!"), text.lastIndexOf("?"));
  return last < text.length * 0.66 ? text : text.slice(0, last + 1);
}

async function describe(domain: string, page: { title: string; text: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Domain: ${domain}\nTitle: ${page.title}\n\nPage text:\n${page.text}` },
        ],
        max_completion_tokens: 800,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return { error: `${resp.status} ${await resp.text().catch(() => "")}`.slice(0, 200) };
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) return { error: "empty completion" };
    const parsed = JSON.parse(raw) as { category?: string; summary?: string };
    const summary = typeof parsed.summary === "string" ? trimToSentence(parsed.summary.trim()) : "";
    if (!summary || summary === "SKIP" || summary.startsWith("SKIP")) return { skip: true };
    if (summary.length < MIN_CHARS) return { error: `too short (${summary.length})` };
    return { category: parsed.category ?? null, summary };
  } catch (err) {
    return { error: String(err).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

const count = Number(process.argv[2] ?? 200);
const concurrency = Number(process.argv[3] ?? 8);
if (!process.env.OPENAI_API_KEY) { console.error("OPENAI_API_KEY is not set"); process.exit(1); }

const sql = sqlClient();

// Random sample, not traffic-ranked. The priority ordering used elsewhere
// surfaces the highest-traffic domains first — reddit.com, quora.com,
// finance.yahoo.com — which are exactly the sites that refuse scrapers. Every
// run that succeeded described its reachable domains, so the head of that
// ordering silted up with the ones that had already failed, and a later run
// retried the same blocked set forever (measured: 30 of 30 unreachable).
// Sampling randomly walks the whole remaining gap instead.
const rows = (await sql.query(`
  SELECT d.id, d.domain
  FROM domains d
  WHERE d.semantic_summary IS NULL
    AND (COALESCE(d.domain_rating,0) > 0 OR COALESCE(d.org_traffic,0) > 0)
    AND (
      EXISTS (SELECT 1 FROM marketplace_offers mo
              WHERE mo.domain_id = d.id AND mo.available = true AND mo.min_price::float > 0)
      OR EXISTS (SELECT 1 FROM supplier_offers so
                 WHERE so.domain_id = d.id AND so.status = 'active' AND so.is_active = true AND so.min_price::float > 0)
    )
  ORDER BY random()
  LIMIT ${Number(count)}
`)) as Array<{ id: string; domain: string }>;
console.log(`[describe] ${rows.length} domains to process, concurrency ${concurrency}`);

let saved = 0, unreachable = 0, skipped = 0, failed = 0, done = 0;
for (let i = 0; i < rows.length; i += concurrency) {
  await Promise.all(rows.slice(i, i + concurrency).map(async (row) => {
    const page = await fetchPage(row.domain);
    if (!page) { unreachable++; return; }
    const result = await describe(row.domain, page);
    if ("skip" in result) { skipped++; return; }
    if ("error" in result) { failed++; return; }
    // Write immediately, one row at a time. WHERE semantic_summary IS NULL
    // makes a re-run a no-op rather than an overwrite, so an interrupted run
    // costs only the domains that were in flight.
    await sql`UPDATE domains
              SET semantic_summary = ${result.summary},
                  semantic_category = COALESCE(${result.category}, semantic_category),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${row.id} AND semantic_summary IS NULL`;
    saved++;
  }));
  done += Math.min(concurrency, rows.length - i);
  process.stdout.write(`\r[describe] ${done}/${rows.length}  saved=${saved} unreachable=${unreachable} skip=${skipped} fail=${failed}`);
}
console.log(`\n[describe] done — ${saved} written`);
