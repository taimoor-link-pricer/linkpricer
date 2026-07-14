"use client";

// Homepage body: full-page AI chat search, like Claude/ChatGPT/Gemini —
// minimal empty state, docked input once a conversation starts. Backed by
// the real marketplace catalog via /api/homepage-search (SQL prefilter +
// Claude semantic rerank, see lib/search/catalog-search.ts) — same search
// pipeline the in-app Related Sites feature uses, just capped to the single
// best match since this UI shows one domain at a time.

import { useEffect, useRef, useState } from "react";
import { Icon, Stars } from "@/lib/design-v1/icons";
import { fmt } from "@/lib/design-v1/format";
import { Pill, btn, chip, priceLbl, priceVal } from "@/components/design-v1/primitives";
import type { CatalogSearchResult, CatalogSearchOffer } from "@/lib/search/catalog-search";
import { SignupModal, type SignupReason } from "./signup-modal";

const CHIPS = ["Finance guest post", "iGaming niche edit", "Tech blog under $200", "SaaS website about VPN"];

type ThreadMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "assistant"; domain: CatalogSearchResult };

function priceFmt(n: number | null | undefined) {
  return fmt.price(n, "$");
}

function OfferCard({ o, onBuy }: { o: CatalogSearchOffer; onBuy: () => void }) {
  const linkGood = o.link === "Dofollow";
  const typeIcon = ({ API: "plug", DB: "db", Vendor: "user" } as const)[o.type] || "plug";
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid var(--lp-accent)",
      boxShadow: "0 0 0 2px var(--lp-accent-50)", padding: "16px 18px", position: "relative",
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <span style={{
        position: "absolute", top: -10, left: 14, background: "var(--lp-accent)",
        color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px",
        borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase",
      }}>Best price</span>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 170px", minWidth: 150 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, flexShrink: 0,
          background: o.type === "Vendor" ? "#fdf2dd" : o.type === "API" ? "#e9f1fe" : "#eef0f4",
          color: o.type === "Vendor" ? "#a35d00" : o.type === "API" ? "#1d4ed8" : "#374151",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name={typeIcon} size={15} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--lp-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</div>
          <Stars n={o.quality} size={11} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flex: "1 1 220px" }}>
        <div>
          <div style={priceLbl}>Marketplace</div>
          <div style={priceVal}>{priceFmt(o.minPrice)}{o.maxPrice && o.maxPrice !== o.minPrice ? ` – ${priceFmt(o.maxPrice)}` : ""}</div>
        </div>
        <div>
          <div style={priceLbl}>Our price</div>
          <div style={{ ...priceVal, color: "var(--lp-accent-700)" }}>{priceFmt(fmt.withFee(o.minPrice))}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 260px", minWidth: 260 }}>
        <Pill color="ink" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{o.delivery}d delivery</Pill>
        <Pill color="ink" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{o.tat}d avg. TAT</Pill>
        <Pill color={linkGood ? "green" : "amber"} style={{ whiteSpace: "nowrap", flexShrink: 0 }}><Icon name={linkGood ? "check" : "x"} size={10} /> {o.link}</Pill>
        <Pill color="ink" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{o.type === "API" ? "Live API" : o.type === "DB" ? "Synced" : "Vendor"}</Pill>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
        <button style={{ ...btn("primary", "sm"), cursor: "pointer", whiteSpace: "nowrap" }} onClick={onBuy}>
          <Icon name="shield" size={13} /> Buy now
        </button>
      </div>
    </div>
  );
}

function MatchResult({ d, onBuy, onViewMore }: { d: CatalogSearchResult; onBuy: () => void; onViewMore: () => void }) {
  const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
  const best = offers[0];

  return (
    <div className="msg-in" style={{ marginTop: 14, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--lp-ink)" }}>{d.domain}</span>
        <Pill color="ink">DR {d.dr}</Pill>
        {d.category && <Pill color="blue">{d.category}</Pill>}
      </div>

      {best && <OfferCard o={best} onBuy={onBuy} />}

      {offers.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 13.5, color: "var(--lp-mute)" }}>
            +{offers.length - 1} more suppliers stock this domain
          </span>
          <button style={{ ...btn("ghost", "sm"), cursor: "pointer" }} onClick={onViewMore}>
            See all suppliers <Icon name="arrowRight" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

const UserBubble = ({ text }: { text: string }) => (
  <div className="msg-in" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
    <div style={{ maxWidth: "75%", background: "var(--lp-accent)", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "11px 16px", fontSize: 14.5, lineHeight: 1.5 }}>{text}</div>
  </div>
);
const AssistantText = ({ text }: { text: string }) => (
  <div className="msg-in" style={{ marginTop: 16, maxWidth: 640 }}>
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--lp-ink-2)" }}>{text}</p>
  </div>
);
const TypingRow = () => (
  <div className="msg-in" style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 5 }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ width: 6, height: 6, borderRadius: 999, background: "var(--lp-mute-2)", display: "inline-block", animation: "lp-dot 1.1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
    ))}
  </div>
);

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
        placeholder="Describe what you're looking for… e.g. “SaaS website about VPN, budget $300–500”"
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

interface HomepageSearchResponse {
  result: CatalogSearchResult | null;
  lowRelevance: boolean;
  remaining?: number;
}

export function AiSearchHome() {
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [value, setValue] = useState("");
  const [thinking, setThinking] = useState(false);
  const [signup, setSignup] = useState<SignupReason | null>(null);
  const slots = useRef<{ domain: CatalogSearchResult | null }>({ domain: null });
  const threadRef = useRef<HTMLDivElement>(null);
  const started = thread.length > 0;

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread, thinking]);

  const requireSignup = (reason: SignupReason) => setSignup(reason);

  async function respond(text: string) {
    try {
      const res = await fetch("/api/homepage-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });

      if (res.status === 429) {
        setThinking(false);
        requireSignup("search");
        return;
      }

      const data: HomepageSearchResponse = await res.json();
      setThinking(false);

      if (!data.result) {
        setThread((t) => [...t, { role: "assistant", text: "I couldn't find a match for that — try describing the niche, budget, or type of site you're after." }]);
        return;
      }

      const d = data.result;
      slots.current.domain = d;
      const intro = data.lowRelevance
        ? `Closest match we found for that — ${d.domain}, ${d.category || "General"} niche, DR ${d.dr}:`
        : `Found it — ${d.domain}, ${d.category || "General"} niche, DR ${d.dr}. Here's the best price we found:`;
      setThread((t) => [...t, { role: "assistant", text: intro }, { role: "assistant", domain: d }]);
    } catch {
      setThinking(false);
      setThread((t) => [...t, { role: "assistant", text: "Something went wrong on our end — please try again." }]);
    }
  }

  function send(text?: string) {
    const q = (text ?? value).trim();
    if (!q || thinking) return;
    setThread((t) => [...t, { role: "user", text: q }]);
    setValue("");
    setThinking(true);
    respond(q);
  }

  return (
    <div className="lp-reset" id="top" style={{ background: "var(--lp-bg)", minHeight: "calc(100dvh - 64px)", display: "flex", flexDirection: "column", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      {!started ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 620, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 999, background: "var(--lp-accent-50)", color: "var(--lp-accent-700)", fontSize: 12.5, fontWeight: 700, marginBottom: 18 }}>
              <Icon name="sparkle" size={13} /> AI-powered supplier search
            </div>
            <h1 style={{ margin: "0 0 22px", fontSize: 26, fontWeight: 700, letterSpacing: -0.5, color: "var(--lp-ink)" }}>
              What kind of backlink are you looking for?
            </h1>
            <InputBar docked={false} value={value} setValue={setValue} thinking={thinking} send={send} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
              {CHIPS.map((c) => (
                <button key={c} type="button" onClick={() => send(c)} style={{ ...chip, cursor: "pointer" }}>+ {c}</button>
              ))}
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 12.5, color: "var(--lp-mute)", fontWeight: 500 }}>
              Searching 60+ marketplaces · 400k+ listings
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div ref={threadRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 4px 8px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>
              {thread.map((m, i) => {
                if (m.role === "user") return <UserBubble key={i} text={m.text} />;
                if ("domain" in m) return <MatchResult key={i} d={m.domain} onBuy={() => requireSignup("buy")} onViewMore={() => requireSignup("search")} />;
                return <AssistantText key={i} text={m.text} />;
              })}
              {thinking && <TypingRow />}
            </div>
          </div>
          <div style={{ position: "sticky", bottom: 0, background: "var(--lp-bg)", paddingTop: 14 }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 20px" }}>
              <InputBar docked value={value} setValue={setValue} thinking={thinking} send={send} />
            </div>
          </div>
        </div>
      )}

      {signup && <SignupModal reason={signup} onClose={() => setSignup(null)} domain={slots.current.domain?.domain} />}
    </div>
  );
}
