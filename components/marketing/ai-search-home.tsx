"use client";

// Homepage body: the LinkPricer assistant — a chat that turns a request in
// plain words into a ranked list of sites with real prices, explains each
// pick, remembers the conversation, and can put sites in the cart.
//
// Backed by /api/assistant/chat (app/api/assistant/chat/route.ts), which
// streams newline-delimited events: the understood filters first, then the
// sites, then the written answer. The thread renders each as it arrives, so a
// turn shows its first content in about a second rather than after the whole
// pipeline. The conversation state travels with the client (see
// lib/assistant/state.ts for why) and is sent back with every message.
//
// Layout is provisional: built from the existing homepage chat's components
// and design tokens (Pill, btn, chip, the --lp-* variables) pending a Karolis
// design for the results list.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/lib/design-v1/icons";
import { fmt } from "@/lib/design-v1/format";
import { Pill, btn, chip, priceLbl, priceVal } from "@/components/design-v1/primitives";
import { SignupModal, type SignupReason } from "./signup-modal";
import { prettyMarketplaceName } from "@/lib/marketplace-name";
import { ROUTES } from "@/lib/constants";
import { useMarketingAuth } from "@/lib/hooks/use-marketing-auth";
import { loadCart, persistCart } from "@/lib/cart-storage";
import type { CartItem } from "@/components/dashboard/results-shared";
import type { AssistantSite, ChatEvent, ChatState, SearchSpec } from "@/lib/assistant/types";
import { EMPTY_STATE } from "@/lib/assistant/state";

const CHIPS = [
  "Tech blogs under $200 with DR 40+",
  "iGaming sites in the UK",
  "German finance sites, dofollow only",
  "I sell a VPN for small businesses — budget $300 per link",
];

// How many sites a search shows before "Show more". Candidates beyond this
// are still in the thread (the composer saw them), just folded.
const SHOWN_DEFAULT = 10;

type ResultsBlock = {
  role: "assistant";
  kind: "results";
  // Stable id: the stream handler updates the block by id, not by thread
  // index — an index taken inside a setState updater is not available
  // synchronously, and two events in one chunk were updating nothing.
  id: number;
  filters: string[];
  sites: AssistantSite[];
  // How many of `sites` are primary (ordered and explained by the composer).
  primary: number;
  summary: string | null;
  chips: string[];
  lowRelevance: boolean;
  pending: boolean;
  expanded: boolean;
};

type ThreadMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; kind: "text"; text: string; chips?: string[] }
  | { role: "assistant"; kind: "cart"; text: string; sites: AssistantSite[] }
  | ResultsBlock;

type Stage = "understanding" | "searching" | "ranking";

const STAGE_LABEL: Record<Stage, string> = {
  understanding: "Understanding your request…",
  searching: "Searching 670K sites across 60+ marketplaces…",
  ranking: "Ranking the best fits and writing it up…",
};

function priceFmt(n: number | null | undefined) {
  return fmt.price(n, "$");
}

// The cart's price column for a niche the customer searched in; the same
// mapping the Analyze page applies (nicheToPriceType in
// app/dashboard/search/page.tsx) so checkout prices casino content at the
// casino rate rather than the standard one.
function priceTypeFor(spec: SearchSpec | null): CartItem["priceType"] {
  if (spec?.linkType === "link_insertion") return "insertion";
  switch (spec?.niche) {
    case "gambling": return "gambling";
    case "adult": return "adult";
    case "cbd": return "cbd";
    case "loan": return "loan";
    case "dating": return "dating";
    case "crypto": return "crypto";
    case "trading_forex": return "tradingForex";
    default: return "base";
  }
}

function cartItemFor(s: AssistantSite, spec: SearchSpec | null): CartItem | null {
  const o = s.bestOffer;
  if (!o) return null;
  return {
    domain: s.domain, dr: s.dr, traffic: s.traffic,
    offerName: o.name, offerType: o.type,
    price: o.minPrice, delivery: o.delivery, link: o.link, orderType: "managed",
    priceType: priceTypeFor(spec),
  };
}

/** Adds the headline offer of each site to the shared cart; returns how many were new. */
function addSitesToCart(sites: AssistantSite[], spec: SearchSpec | null): number {
  const cart = loadCart();
  let added = 0;
  for (const s of sites) {
    const item = cartItemFor(s, spec);
    if (!item) continue;
    const dup = cart.items.some((i) => i.domain === item.domain && i.offerName === item.offerName);
    if (dup) continue;
    cart.items.push(item);
    added++;
  }
  persistCart(cart);
  return added;
}

const UserBubble = ({ text }: { text: string }) => (
  <div className="msg-in" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
    <div style={{ maxWidth: "75%", background: "var(--lp-accent)", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "11px 16px", fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text}</div>
  </div>
);

const Chips = ({ chips, onClick }: { chips?: string[]; onClick?: (s: string) => void }) =>
  chips && chips.length > 0 ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      {chips.map((s) => (
        <button key={s} type="button" onClick={() => onClick?.(s)} style={{ ...chip, cursor: "pointer" }}>{s}</button>
      ))}
    </div>
  ) : null;

const AssistantText = ({ text, chips, onChip }: { text: string; chips?: string[]; onChip?: (s: string) => void }) => (
  <div className="msg-in" style={{ marginTop: 16, maxWidth: 680 }}>
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--lp-ink-2)", whiteSpace: "pre-wrap" }}>{text}</p>
    <Chips chips={chips} onClick={onChip} />
  </div>
);

const TypingRow = ({ stage }: { stage: Stage }) => (
  <div className="msg-in" style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 10 }}>
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: "var(--lp-mute-2)", display: "inline-block", animation: "lp-dot 1.1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
    <span style={{ fontSize: 13.5, color: "var(--lp-mute)" }}>{STAGE_LABEL[stage]}</span>
  </div>
);

function SiteCard({ s, rank, pending, signedIn, inCart, onBuy, onAddToCart }: { s: AssistantSite; rank: number; pending: boolean; signedIn: boolean; inCart: boolean; onBuy: () => void; onAddToCart: () => void }) {
  const category = (s.category || "").split("/").map((c) => c.trim()).filter(Boolean).slice(0, 2).join(" · ");
  const about = s.about ? (s.about.length > 170 ? `${s.about.slice(0, 170).replace(/\s+\S*$/, "")}…` : s.about) : null;
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: rank === 1 && !pending ? "1px solid var(--lp-accent)" : "1px solid var(--lp-line)",
      boxShadow: rank === 1 && !pending ? "0 0 0 2px var(--lp-accent-50)" : undefined, padding: "14px 16px", marginTop: 10, position: "relative",
      opacity: pending ? 0.75 : 1,
    }}>
      {rank === 1 && !pending && (
        <span style={{ position: "absolute", top: -10, left: 14, background: "var(--lp-accent)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase" }}>Top pick</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lp-mute-2)", minWidth: 18 }}>{pending ? "·" : `#${rank}`}</span>
        <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 15, color: "var(--lp-ink)", textDecoration: "none" }}>{s.domain}</a>
        <Pill color="ink">DR {s.dr}</Pill>
        {s.traffic > 0 && <Pill color="ink">{fmt.num(s.traffic)} traffic</Pill>}
        {s.country && <Pill color="ink">{s.country}</Pill>}
        {category && <Pill color="blue">{category}</Pill>}
        {s.dofollow && <Pill color="green"><Icon name="check" size={10} /> Dofollow</Pill>}
      </div>
      {about && <p style={{ margin: "8px 0 0 26px", fontSize: 13, lineHeight: 1.5, color: "var(--lp-mute)" }}>{about}</p>}
      {s.reason && (
        <p style={{ margin: "6px 0 0 26px", fontSize: 13.5, lineHeight: 1.5, color: "var(--lp-accent-700)", display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Icon name="sparkle" size={13} style={{ flexShrink: 0, marginTop: 3 }} /><span>{s.reason}</span>
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 10, marginLeft: 26 }}>
        <div>
          <div style={priceLbl}>From · fee incl.</div>
          <div style={{ ...priceVal, color: "var(--lp-accent-700)" }}>{priceFmt(s.ourPrice)}</div>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--lp-mute)" }}>
          {s.offerCount > 0 ? `${s.offerCount} supplier${s.offerCount === 1 ? "" : "s"}` : "no supplier yet"}
          {s.bestOffer ? ` · ${s.priceOutlier ? "typical" : "cheapest"} via ${s.bestOffer.type === "Vendor" ? s.bestOffer.name : prettyMarketplaceName(s.bestOffer.name)}` : ""}
          {s.bestOffer ? ` · ${s.bestOffer.delivery}d avg. TAT` : ""}
          {s.priceOutlier && s.lowQuote != null ? ` · one supplier lists ${priceFmt(s.lowQuote)} (unverified)` : ""}
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {signedIn && s.bestOffer && (
            <button type="button" onClick={onAddToCart} disabled={inCart} style={{ ...btn(inCart ? "disabled" : "ghost", "sm"), cursor: inCart ? "default" : "pointer", whiteSpace: "nowrap" }}>
              <Icon name={inCart ? "check" : "cart"} size={13} /> {inCart ? "In cart" : "Add to cart"}
            </button>
          )}
          <button type="button" onClick={onBuy} style={{ ...btn("primary", "sm"), cursor: "pointer", whiteSpace: "nowrap" }}>
            <Icon name="shield" size={13} /> {signedIn ? "Compare & buy" : "Buy now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsView({ b, signedIn, inCart, onBuy, onAddToCart, onChip, onShowMore }: {
  b: ResultsBlock; signedIn: boolean; inCart: (s: AssistantSite) => boolean;
  onBuy: (s: AssistantSite) => void; onAddToCart: (s: AssistantSite) => void; onChip: (s: string) => void; onShowMore: () => void;
}) {
  // Once the answer is in, the explained sites are the list; "top 3" shows
  // three. Before it, the provisional candidates fill up to the default.
  const shown = b.expanded ? b.sites : b.sites.slice(0, b.primary > 0 ? b.primary : Math.min(SHOWN_DEFAULT, b.sites.length));
  const hidden = b.sites.length - shown.length;
  return (
    <div className="msg-in" style={{ marginTop: 14, maxWidth: 760 }}>
      {b.filters.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Icon name="filter" size={12} color="var(--lp-mute-2)" />
          {b.filters.map((f, i) => <Pill key={`${f}-${i}`} color={i === 0 ? "blue" : "ink"}>{f}</Pill>)}
        </div>
      )}
      {b.lowRelevance && !b.pending && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--lp-warn)", display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="info" size={13} /> No strong match for this topic in the catalogue — these are the closest sites.
        </p>
      )}
      {b.summary ? (
        <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.6, color: "var(--lp-ink-2)", whiteSpace: "pre-wrap" }}>{b.summary}</p>
      ) : b.sites.length > 0 ? (
        <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "var(--lp-mute)" }}>{b.sites.length} candidate{b.sites.length === 1 ? "" : "s"} found — ranking and writing up…</p>
      ) : null}
      {shown.map((s, i) => (
        <SiteCard key={s.id} s={s} rank={i + 1} pending={b.pending} signedIn={signedIn} inCart={inCart(s)} onBuy={() => onBuy(s)} onAddToCart={() => onAddToCart(s)} />
      ))}
      {hidden > 0 && !b.pending && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: "var(--lp-mute)" }}>+{hidden} more site{hidden === 1 ? "" : "s"} matched</span>
          <button type="button" style={{ ...btn("ghost", "sm"), cursor: "pointer" }} onClick={onShowMore}>
            {signedIn ? <>Show all {b.sites.length} <Icon name="chevronDown" size={12} /></> : <><Icon name="lock" size={12} /> Log in to see all {b.sites.length}</>}
          </button>
        </div>
      )}
      {!b.pending && <Chips chips={b.chips} onClick={onChip} />}
    </div>
  );
}

function InputBar({ docked, value, setValue, thinking, send }: { docked: boolean; value: string; setValue: (v: string) => void; thinking: boolean; send: (text?: string) => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{
      display: "flex", alignItems: "center", gap: 6, background: "#fff",
      border: "1px solid var(--lp-line)", borderRadius: 999, padding: "6px 6px 6px 20px",
      boxShadow: docked ? "0 -2px 14px rgba(15,23,42,0.06)" : "var(--lp-shadow-1)",
    }}>
      <input
        autoFocus={!docked}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
        placeholder={docked ? "Refine, ask about a site, or add to cart…" : "Describe what you need… e.g. “tech and cybersecurity sites, dofollow, budget $300 per link”"}
        style={{ flex: 1, border: "none", outline: "none", fontSize: 14.5, fontFamily: "inherit", color: "var(--lp-ink)", background: "transparent", minWidth: 0 }}
      />
      <button type="submit" aria-label="Send" disabled={!value.trim() || thinking} style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 999, border: "none",
        background: value.trim() && !thinking ? "var(--lp-accent)" : "var(--lp-bg-3)",
        color: value.trim() && !thinking ? "#fff" : "var(--lp-mute-2)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: value.trim() && !thinking ? "pointer" : "not-allowed",
      }}><Icon name="arrowRight" size={17} /></button>
    </form>
  );
}

export function AiSearchHome() {
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const [stage, setStage] = useState<Stage>("understanding");
  const [signup, setSignup] = useState<SignupReason | null>(null);
  const [signupDomain, setSignupDomain] = useState<string | undefined>(undefined);
  const [cartKeys, setCartKeys] = useState<Set<string>>(() => new Set(loadCart().items.map((i) => `${i.domain}|${i.offerName}`)));
  const stateRef = useRef<ChatState>(EMPTY_STATE);
  const nextBlockId = useRef(1);
  const threadRef = useRef<HTMLDivElement>(null);
  const { signedIn } = useMarketingAuth();
  const router = useRouter();
  const started = thread.length > 0;

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread, thinking]);

  const requireSignup = (reason: SignupReason, domain?: string) => {
    setSignup(reason);
    setSignupDomain(domain);
  };

  // Signed in, Buy and "see all" land on the per-domain compare view in the
  // app, which owns the full supplier list, the cart and checkout. Signed
  // out, they open the signup modal, which redirects to the same place
  // after the account exists.
  const openInApp = (domain: string) => router.push(`${ROUTES.search}?domain=${encodeURIComponent(domain)}`);
  const onBuy = (s: AssistantSite) => (signedIn ? openInApp(s.domain) : requireSignup("buy", s.domain));
  const isInCart = (s: AssistantSite) => !!s.bestOffer && cartKeys.has(`${s.domain}|${s.bestOffer.name}`);
  const onAddToCart = (sites: AssistantSite[]) => {
    if (!signedIn) {
      requireSignup("buy", sites[0]?.domain);
      return 0;
    }
    const n = addSitesToCart(sites, stateRef.current.search);
    setCartKeys(new Set(loadCart().items.map((i) => `${i.domain}|${i.offerName}`)));
    return n;
  };

  const updateBlock = (id: number, patch: (b: ResultsBlock) => ResultsBlock) =>
    setThread((t) => t.map((m) => (m.role === "assistant" && m.kind === "results" && m.id === id ? patch(m) : m)));
  // A results block that never got its sites (a lookup miss, a server error
  // after "understood") is removed rather than left saying "ranking…"
  // under the reply that explains what happened.
  const dropEmptyBlock = (id: number) =>
    setThread((t) => t.filter((m) => !(m.role === "assistant" && m.kind === "results" && m.id === id && m.pending && m.sites.length === 0)));
  const settleBlock = (id: number) =>
    updateBlock(id, (b) => (b.pending ? { ...b, pending: false, primary: b.primary || Math.min(SHOWN_DEFAULT, b.sites.length), summary: b.summary ?? (b.sites.length ? `${b.sites.length} sites matched.` : "I couldn't find a match for that — try describing the niche or budget differently.") } : b));

  async function respond(text: string) {
    const blockId = nextBlockId.current++;
    const handle = (ev: ChatEvent) => {
      switch (ev.type) {
        case "status":
          setStage(ev.stage);
          break;
        case "understood":
          setThread((t) => [...t, { role: "assistant", kind: "results", id: blockId, filters: ev.filters, sites: [], primary: 0, summary: null, chips: [], lowRelevance: false, pending: true, expanded: false }]);
          break;
        case "results":
          updateBlock(blockId, (b) => ({ ...b, sites: ev.sites, lowRelevance: ev.lowRelevance }));
          break;
        case "answer": {
          stateRef.current = ev.state;
          updateBlock(blockId, (b) => {
            const head = ev.sites.map((s) => ({ ...s, reason: ev.reasons[s.domain] ?? s.reason }));
            const used = new Set(head.map((s) => s.domain));
            const tail = b.sites.filter((s) => !used.has(s.domain));
            return { ...b, sites: [...head, ...tail], primary: head.length, summary: ev.summary, chips: ev.chips, pending: false };
          });
          setThinking(false);
          break;
        }
        case "message":
          stateRef.current = ev.state;
          dropEmptyBlock(blockId);
          setThread((t) => [...t, { role: "assistant", kind: "text", text: ev.text, chips: ev.chips }]);
          setThinking(false);
          break;
        case "action": {
          stateRef.current = ev.state;
          if (ev.sites.length === 0) {
            setThread((t) => [...t, { role: "assistant", kind: "text", text: ev.text }]);
          } else if (!signedIn) {
            setThread((t) => [...t, { role: "assistant", kind: "text", text: `The cart needs a free account. Create one and ${ev.sites[0]?.domain ?? "this site"} opens in the app ready to order; this conversation stays here.` }]);
            requireSignup("buy", ev.sites[0]?.domain);
          } else {
            onAddToCart(ev.sites);
            setThread((t) => [...t, { role: "assistant", kind: "cart", text: ev.text, sites: ev.sites }]);
          }
          setThinking(false);
          break;
        }
        case "error":
          dropEmptyBlock(blockId);
          settleBlock(blockId);
          setThread((t) => [...t, { role: "assistant", kind: "text", text: ev.message }]);
          setThinking(false);
          break;
        case "done":
          setThinking(false);
          break;
      }
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, state: stateRef.current }),
      });
      if (res.status === 429) {
        setThinking(false);
        if (signedIn) {
          setThread((t) => [...t, { role: "assistant", kind: "text", text: "You're sending messages faster than we can keep up — give it a moment and try again." }]);
        } else {
          setThread((t) => [...t, { role: "assistant", kind: "text", text: "That's the free allowance for this hour. Log in or create a free account to keep going — searches are unlimited with an account." }]);
          requireSignup("search");
        }
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            handle(JSON.parse(line) as ChatEvent);
          } catch (err) {
            console.error("[assistant] bad event", err);
          }
        }
      }
      // A stream that ended without an answer (connection dropped mid-turn)
      // must not leave the typing row on forever.
      setThinking(false);
      dropEmptyBlock(blockId);
      settleBlock(blockId);
    } catch {
      setThinking(false);
      dropEmptyBlock(blockId);
      settleBlock(blockId);
      setThread((t) => [...t, { role: "assistant", kind: "text", text: "Something went wrong on our end — please try again." }]);
    }
  }

  function send(text?: string) {
    const q = (text ?? value).trim();
    if (!q || thinking) return;
    setThread((t) => [...t, { role: "user", text: q }]);
    setValue("");
    setStage("understanding");
    setThinking(true);
    respond(q);
  }

  return (
    <div className="lp-reset" id="top" style={{ background: "var(--lp-bg)", minHeight: "calc(100dvh - 64px)", display: "flex", flexDirection: "column", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      {!started ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 640, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 999, background: "var(--lp-accent-50)", color: "var(--lp-accent-700)", fontSize: 12.5, fontWeight: 700, marginBottom: 18 }}>
              <Icon name="sparkle" size={13} /> AI-powered supplier search
            </div>
            <h1 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: "var(--lp-ink)" }}>
              What kind of backlink are you looking for?
            </h1>
            <p style={{ margin: "0 0 22px", fontSize: 14.5, color: "var(--lp-mute)" }}>
              Describe the niche, budget and quality you want. You get real sites with real prices, and the reason each one fits.
            </p>
            <InputBar docked={false} value={value} setValue={setValue} thinking={thinking} send={send} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
              {CHIPS.map((c) => (
                <button key={c} type="button" onClick={() => send(c)} style={{ ...chip, cursor: "pointer" }}>+ {c}</button>
              ))}
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--lp-mute)", fontWeight: 500 }}>
              Searching 60+ marketplaces · 670K+ sites · prices include our fee
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div ref={threadRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 4px 8px" }}>
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px" }}>
              {thread.map((m, i) => {
                if (m.role === "user") return <UserBubble key={i} text={m.text} />;
                if (m.kind === "results") {
                  return (
                    <ResultsView
                      key={i}
                      b={m}
                      signedIn={signedIn}
                      inCart={isInCart}
                      onBuy={onBuy}
                      onAddToCart={(s) => onAddToCart([s])}
                      onChip={(s) => send(s)}
                      onShowMore={() => (signedIn ? updateBlock(i, (b) => ({ ...b, expanded: true })) : requireSignup("search", m.sites[0]?.domain))}
                    />
                  );
                }
                if (m.kind === "cart") {
                  return (
                    <div key={i} className="msg-in" style={{ marginTop: 16, maxWidth: 680 }}>
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--lp-ink-2)" }}><Icon name="cart" size={14} /> {m.text}</p>
                      <div style={{ marginTop: 10 }}>
                        <button type="button" onClick={() => router.push(ROUTES.search)} style={{ ...btn("primary", "sm"), cursor: "pointer" }}>Open cart <Icon name="arrowRight" size={12} /></button>
                      </div>
                    </div>
                  );
                }
                return <AssistantText key={i} text={m.text} chips={m.chips} onChip={(s) => send(s)} />;
              })}
              {thinking && <TypingRow stage={stage} />}
            </div>
          </div>
          <div style={{ position: "sticky", bottom: 0, background: "var(--lp-bg)", paddingTop: 14 }}>
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px 20px" }}>
              <InputBar docked value={value} setValue={setValue} thinking={thinking} send={send} />
            </div>
          </div>
        </div>
      )}

      {signup && <SignupModal reason={signup} onClose={() => setSignup(null)} domain={signupDomain} />}
    </div>
  );
}
