import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/verify-session";
import { understand } from "@/lib/assistant/understand";
import { compose, type ComposeMode } from "@/lib/assistant/compose";
import { runSearch, sitesByIds, lookupDomains, applySpecInJs, sortForSpec } from "@/lib/assistant/retrieve";
import { parseState, nextState, describeSpec } from "@/lib/assistant/state";
import type { AssistantSite, ChatEvent, ChatState } from "@/lib/assistant/types";

// The homepage assistant (components/marketing/ai-search-home.tsx).
//
// One POST per message. The reply is a stream of newline-delimited JSON
// events (lib/assistant/types.ts, ChatEvent) so the page can show the
// understood filters at ~1s, the sites at ~4s and the written answer when
// the composer finishes, instead of a spinner until everything is done.
//
// Each turn is three steps: understand (lib/assistant/understand.ts) turns
// the message into a plan, retrieve (retrieve.ts) runs it against the
// catalogue, compose (compose.ts) orders the sites, explains each one and
// writes the answer. The conversation state rides along with the client
// (state.ts) because this runs on serverless functions with no shared memory.
//
// Three model-backed steps plus a catalogue search can run past the
// platform-default function timeout on a slow day — same reason
// /api/related-sites and the old /api/homepage-search raise it.
export const maxDuration = 60;

// Open to signed-out visitors, so the free allowance is an in-memory per-IP
// counter (same pattern as the old homepage search); signed-in users are not
// metered — the chat is a real app surface for them, not a teaser.
const MAX_FREE_MESSAGES = 15;
// Signed-in users are metered too, per account rather than per IP, with a
// cap that no real conversation reaches: every search turn costs a planner
// call, an embedding, four rerank calls, the pricing join and a composer
// call, so an unmetered free account would be an open line to the OpenAI
// bill and the one shared Neon compute. Per instance only (same Map as the
// IP limiter); a shared counter is the durable fix.
const MAX_USER_MESSAGES = 60;
// What a signed-out visitor is shown per search; the rest of the candidates
// stay on the server. "Log in to see all" has to be true on the wire, not
// just in the DOM, or the cheapest-supplier-per-site table the product
// sells is readable with curl.
const GUEST_VISIBLE_SITES = 10;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGE_CHARS = 1000;

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(key: string, max: number): boolean {
  const now = Date.now();
  for (const [k, val] of rateLimit.entries()) if (val.resetAt < now) rateLimit.delete(k);
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/** The signed-in user's id, or null. Only ever relaxes the limiter and widens what is shown. */
async function signedInUid(): Promise<string | null> {
  try {
    const session = (await cookies()).get("session")?.value;
    if (!session) return null;
    const decoded = await verifySession(session);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const hostOf = (d: string) => d.toLowerCase().replace(/^www\./, "");

/** Which of the shown sites an add-to-cart request means. */
function cartTargets(state: ChatState, domains: string[], topN: number | null): string[] {
  if (domains.length > 0) {
    const wanted = new Set(domains.map(hostOf));
    return state.resultIds.filter((_, i) => wanted.has(hostOf(state.resultDomains[i] ?? "")));
  }
  if (topN != null) return state.resultIds.slice(0, topN);
  return state.resultIds;
}

export async function POST(req: NextRequest) {
  const uid = await signedInUid();
  const signedIn = uid !== null;
  // The live evaluation battery (scripts/assistant-eval.mjs) sends far more
  // than the free allowance from one IP; outside production it may say so.
  const evalBypass = process.env.NODE_ENV !== "production" && req.headers.get("x-eval-bypass") === "1";
  if (!evalBypass) {
    const ok = signedIn ? checkRateLimit(`user:${uid}`, MAX_USER_MESSAGES) : checkRateLimit(`ip:${getIp(req)}`, MAX_FREE_MESSAGES);
    if (!ok) return json(429, { error: "rate_limited" });
  }

  let body: { message?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
  if (!message) return json(400, { error: "message is required" });
  const state = parseState(body.state);

  const encoder = new TextEncoder();
  // Set when the client goes away mid-turn; emits become no-ops and the
  // stages that have not started are skipped rather than paid for.
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const emit = (ev: ChatEvent) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          cancelled = true;
        }
      };
      const gone = () => cancelled || req.signal.aborted;
      // What a signed-out visitor is sent: the composer still sees every
      // candidate, the wire carries only the visible ones.
      const visible = (sites: AssistantSite[]) => (signedIn ? sites : sites.slice(0, GUEST_VISIBLE_SITES));
      const t0 = Date.now();
      const timings: Record<string, number> = {};
      try {
        emit({ type: "status", stage: "understanding" });
        const u = await understand(message, state);
        timings.understand = u.ms;
        const plan = u.understanding;
        if (gone()) return;

        if (plan.intent === "clarify" || plan.intent === "chat" || plan.intent === "offtopic") {
          const text = plan.reply ?? "What kind of websites are you looking for?";
          const next = nextState(state, { goal: plan.goal, user: message, assistant: text });
          emit({ type: "message", text, chips: plan.chips, state: next });
        } else if (plan.intent === "add_to_cart") {
          const ids = cartTargets(state, plan.domains, plan.topN);
          const sites = ids.length ? await sitesByIds(ids) : [];
          const buyable = sites.filter((s) => s.bestOffer);
          const text = buyable.length === 0
            ? "I couldn't match that to any of the sites shown. Name the domain, or say \"the top 3\"."
            : `Added ${buyable.length} site${buyable.length === 1 ? "" : "s"} to your cart: ${buyable.map((s) => s.domain).join(", ")}.`;
          const next = nextState(state, { goal: plan.goal, user: message, assistant: text });
          emit({ type: "action", action: "add_to_cart", sites: buyable, text, state: next });
        } else if (plan.intent === "domain_lookup") {
          emit({ type: "understood", intent: plan.intent, filters: [], spec: null });
          emit({ type: "status", stage: "searching" });
          const tr = Date.now();
          const { sites, missing } = await lookupDomains(plan.domains);
          timings.retrieve = Date.now() - tr;
          if (gone()) return;
          emit({ type: "results", sites, lowRelevance: false, total: sites.length });
          if (sites.length === 0) {
            const text = `I don't have ${missing.join(", ")} in the catalogue yet, so there is no price to show. Want similar sites instead?`;
            const next = nextState(state, { goal: plan.goal, user: message, assistant: text });
            emit({ type: "message", text, chips: plan.chips.length ? plan.chips : ["Find similar sites"], state: next });
          } else {
            emit({ type: "status", stage: "ranking" });
            const note = missing.length ? ` (Not in the catalogue, so no data: ${missing.join(", ")}.)` : "";
            const c = await compose({ message: message + note, goal: plan.goal, language: plan.language, spec: null, filters: [], mode: "lookup", lowRelevance: false, total: sites.length, sites });
            timings.compose = c.ms;
            const ordered = orderSites(sites, c.composition.order, c.composition.reasons);
            const next = nextState(state, { goal: plan.goal, search: state.search, results: ordered.slice(0, c.composition.order.length), user: message, assistant: c.composition.summary });
            emit({ type: "answer", summary: c.composition.summary, order: c.composition.order, reasons: c.composition.reasons, sites: ordered.slice(0, c.composition.order.length), chips: c.composition.chips.length ? c.composition.chips : plan.chips, state: next });
          }
        } else {
          const spec = plan.search!;
          const filters = describeSpec(spec);
          emit({ type: "understood", intent: plan.intent, filters, spec });
          emit({ type: "status", stage: "searching" });
          const tr = Date.now();
          let sites: AssistantSite[] | undefined;
          let lowRelevance = false;
          let total = 0;
          let mode: ComposeMode = "search";
          // "Current" scope answers from the sites already shown. That is
          // only possible when the shown set could contain the answer: a new
          // country, language, TLD or niche needs the catalogue, and so does
          // a filter that leaves nothing. Either falls back to a real search.
          const sameScope = state.search && spec.language === state.search.language && spec.niche === state.search.niche
            && JSON.stringify(spec.countries) === JSON.stringify(state.search.countries) && JSON.stringify(spec.tlds) === JSON.stringify(state.search.tlds);
          if (plan.scope === "current" && state.resultIds.length && sameScope) {
            const preferLanguage = spec.language || spec.countries?.length ? null : plan.language;
            sites = sortForSpec(applySpecInJs(await sitesByIds(state.resultIds), spec), spec, preferLanguage);
            total = sites.length;
            mode = "current";
          }
          if (mode !== "current" || sites!.length === 0) {
            const r = await runSearch(spec, { preferLanguage: plan.language });
            sites = r.sites;
            lowRelevance = r.lowRelevance;
            total = r.total;
            mode = "search";
          }
          timings.retrieve = Date.now() - tr;
          if (gone()) return;
          emit({ type: "results", sites: visible(sites!), lowRelevance, total });
          emit({ type: "status", stage: "ranking" });
          const c = await compose({ message, goal: plan.goal, language: plan.language, spec, filters, mode, lowRelevance, total, sites: sites! });
          timings.compose = c.ms;
          const ordered = orderSites(sites!, c.composition.order, c.composition.reasons);
          // The state remembers only what was explained and shown, so "the
          // top 3", "these" and "add them all" mean the list on screen, not
          // the candidates folded behind it.
          const head = ordered.slice(0, c.composition.order.length);
          const next = nextState(state, { goal: plan.goal, search: spec, results: head, user: message, assistant: c.composition.summary });
          emit({ type: "answer", summary: c.composition.summary, order: c.composition.order, reasons: c.composition.reasons, sites: head, chips: c.composition.chips.length ? c.composition.chips : plan.chips, state: next });
        }
        timings.total = Date.now() - t0;
        console.log(`[assistant] ${plan.intent}${plan.scope === "current" ? "/current" : ""} ${JSON.stringify(timings)} model=${u.usedModel ? "ok" : "fallback"}`);
      } catch (err) {
        console.error("[assistant] turn failed:", err instanceof Error ? err.stack ?? err.message : err);
        emit({ type: "error", message: "Something went wrong on our end — please try again." });
      } finally {
        emit({ type: "done" });
        try {
          controller.close();
        } catch {
          /* already cancelled */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

/** The composer's order first (with its reasons), then every other candidate in retrieval order. */
function orderSites(sites: AssistantSite[], order: string[], reasons: Record<string, string>): AssistantSite[] {
  const byDomain = new Map(sites.map((s) => [s.domain, s]));
  const head = order.map((d) => byDomain.get(d)).filter((s): s is AssistantSite => !!s).map((s) => ({ ...s, reason: reasons[s.domain] }));
  const used = new Set(head.map((s) => s.domain));
  const tail = sites.filter((s) => !used.has(s.domain));
  return [...head, ...tail];
}
