"use client";

// Homepage body: hero, live sample-data demo (Domain Analysis + Related
// Sites), logged-out signup gate, and the blog strip. Ported from `Home.App`
// in v1-interactive/home.jsx — the design Karolis confirmed as the actual
// homepage (not the older long-form marketing-brief layout).

import { useRef, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { Icon } from "@/lib/design-v1/icons";
import { btn } from "@/components/design-v1/primitives";
import { DemoAnalyze } from "./demo/DemoAnalyze";
import { DemoRelated } from "./demo/DemoRelated";

const FREE_SEARCHES = 2;

type SignupReason = "search" | "buy" | "save" | "generic";

function SignupModal({ reason, onClose }: { reason: SignupReason; onClose: () => void }) {
  const copy: Record<SignupReason, { title: string; body: string }> = {
    search: { title: "You've used your free demo searches", body: "Create a free account to keep searching — and run it against live marketplace data instead of the sample set." },
    buy: { title: "Sign up to place this order", body: "Create a free account and we'll handle the order directly with the marketplace — one price, low fee, pay only after publication." },
    save: { title: "Sign up to save this site", body: "Create a free account to save sites to your favourites and track their prices over time." },
    generic: { title: "Create your free LinkPricer account", body: "Search live marketplaces, compare prices and order directly — all in one place." },
  };
  const c = copy[reason] || copy.generic;

  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid var(--lp-line)", fontSize: 14, fontFamily: "inherit", color: "var(--lp-ink-2)", outline: "none", background: "#fff" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,22,32,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 20px 40px", overflow: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(15,22,32,0.30)", overflow: "hidden" }}>
        <div style={{ padding: "26px 28px 22px", position: "relative" }}>
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 18, right: 18, width: 30, height: 30, borderRadius: 8, border: "1px solid var(--lp-line)", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--lp-mute)" }}>
            <Icon name="x" size={16} />
          </button>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "#000", marginBottom: 16 }}>Linkpricer</div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.4, color: "var(--lp-ink)" }}>{c.title}</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--lp-ink-3)" }}>{c.body}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <input type="email" placeholder="Work email" style={field} />
            <input type="password" placeholder="Choose a password" style={field} />
            <Link href={ROUTES.signup} style={{ ...btn("primary"), height: 46, justifyContent: "center", textDecoration: "none", fontSize: 14.5 }}>Create free account</Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--lp-mute-2)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} /> already have an account? <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} />
          </div>
          <Link href={ROUTES.login} style={{ ...btn("ghost"), width: "100%", height: 44, justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Log in</Link>

          <p style={{ margin: "16px 0 0", fontSize: 11.5, color: "var(--lp-mute)", textAlign: "center", lineHeight: 1.5 }}>
            No credit card required · Pay only after publication
          </p>
        </div>
      </div>
    </div>
  );
}

const BLOG_POSTS = [
  { cat: "Guides", catColor: "var(--lp-warn)", catBg: "var(--lp-warn-bg)", title: "How to Build Backlinks for SaaS Products in 2026", meta: "Karolis Butkus · 11 min read", href: "/blog" },
  { cat: "Comparisons", catColor: "var(--lp-accent-700)", catBg: "var(--lp-accent-50)", title: "Linkpricer vs. Traditional Link-Building Agencies", meta: "Mara Devlin · 9 min read", href: "/blog" },
  { cat: "Case Studies", catColor: "var(--lp-good)", catBg: "var(--lp-good-bg)", title: "How a Fintech Startup 3×'d Organic Traffic in Two Quarters", meta: "Devon Ray · 8 min read", href: "/blog" },
];

function BlogStrip() {
  return (
    <section style={{ borderTop: "1px solid var(--lp-line)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 24px 8px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <div style={{ fontFamily: "var(--lp-mono)", fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--lp-mute)", marginBottom: 10 }}>From the blog</div>
            <h2 style={{ margin: 0, fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 800, letterSpacing: -0.8, color: "var(--lp-ink)" }}>Playbooks, benchmarks &amp; comparisons</h2>
          </div>
          <Link href="/blog" style={{ ...btn("ghost", "sm"), textDecoration: "none", boxSizing: "border-box" }}>View all articles <Icon name="arrowRight" size={13} /></Link>
        </div>
        <div className="lp-demo-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
          {BLOG_POSTS.map((p, i) => (
            <Link key={i} href={p.href} style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}>
              <div style={{ aspectRatio: "16 / 10", marginBottom: 16, borderRadius: 14, border: "1px solid var(--lp-line)", backgroundImage: "repeating-linear-gradient(45deg, #e8ebf2 0 10px, #f1f3f7 10px 20px)" }} />
              <span style={{ alignSelf: "flex-start", fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: p.catColor, background: p.catBg, padding: "4px 9px", borderRadius: 999, marginBottom: 12 }}>{p.cat}</span>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.25, color: "var(--lp-ink)" }}>{p.title}</h3>
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--lp-mute)" }}>{p.meta}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ step, eyebrow, title, body }: { step: string; eyebrow: string; title: string; body: string }) {
  return (
    <div style={{ marginBottom: 20, maxWidth: 640 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--lp-mono)", fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--lp-accent-700)", marginBottom: 12 }}>
        <span style={{ width: 20, height: 20, borderRadius: 999, background: "var(--lp-accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{step}</span>
        {eyebrow}
      </div>
      <h2 style={{ margin: 0, fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: 800, letterSpacing: -0.8, color: "var(--lp-ink)" }}>{title}</h2>
      <p style={{ margin: "10px 0 0", fontSize: 15.5, color: "var(--lp-ink-3)", lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

export function HeroSection() {
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [signup, setSignup] = useState<SignupReason | null>(null);
  const demoRef = useRef<HTMLDivElement>(null);

  const searchesLeft = Math.max(0, FREE_SEARCHES - searchesUsed);
  const gate = () => {
    if (searchesUsed >= FREE_SEARCHES) { setSignup("search"); return false; }
    setSearchesUsed((n) => n + 1);
    return true;
  };
  const requireSignup = (reason?: string) => setSignup((reason as SignupReason) || "generic");
  const scrollToDemo = () => { try { demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* noop */ } };

  return (
    <div className="lp-reset" id="top" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <style>{`
        @media (max-width: 760px) {
          .lp-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Hero */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 24px 40px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "var(--lp-accent-50)", color: "var(--lp-accent-700)", fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2, marginBottom: 22 }}>
          <Icon name="bolt" size={14} /> Every backlink marketplace, one place
        </div>
        <h1 style={{ margin: "0 auto", maxWidth: 860, fontSize: "clamp(34px, 5.4vw, 58px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.4, color: "var(--lp-ink)" }}>
          Compare backlink prices.<br />Buy the best deal directly.
        </h1>
        <p style={{ margin: "20px auto 0", maxWidth: 620, fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.55, color: "var(--lp-ink-3)" }}>
          LinkPricer brings every backlink marketplace into one search — so you can compare prices side by side, see the single best deal, and order directly, with low fees.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 30 }}>
          <Link href={ROUTES.signup} style={{ ...btn("primary", "lg"), fontSize: 15.5, padding: "15px 26px", textDecoration: "none", boxSizing: "border-box" }}>Start free <Icon name="arrowRight" size={16} /></Link>
          <button onClick={scrollToDemo} style={{ ...btn("ghost", "lg"), fontSize: 15.5, padding: "15px 24px" }}>Try the live demo</button>
        </div>
        <div style={{ display: "flex", gap: 22, justifyContent: "center", flexWrap: "wrap", marginTop: 26, fontSize: 13, color: "var(--lp-mute)", fontWeight: 600 }}>
          {["Compare every marketplace at once", "One transparent price + 15% fee", "Pay only after publication"].map((t) => (
            <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name="check" size={14} color="var(--lp-good)" /> {t}</span>
          ))}
        </div>
      </section>

      {/* Section 1 — Domain Analysis demo */}
      <div ref={demoRef} id="domain-analysis" style={{ background: "var(--lp-bg)", borderTop: "1px solid var(--lp-line)", scrollMarginTop: 80 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 52px" }}>
          <SectionHead
            step="1"
            eyebrow="Backlink price comparison"
            title="Compare prices across every marketplace"
            body="Paste your domains and see live prices, authority metrics and the single best deal side by side. This is the real app on a sample dataset — search and expand any result."
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px 16px", marginBottom: 16, background: "#fdf2dd", border: "1px solid #f0dca8", borderRadius: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#7a5200", fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#a35d00", flexShrink: 0 }} />
              Sample data — log in to search live marketplaces.
            </div>
            <Link href={ROUTES.login} style={{ ...btn("primary", "sm"), background: "#a35d00", boxShadow: "none", whiteSpace: "nowrap", textDecoration: "none", boxSizing: "border-box" }}>Log in to go live <Icon name="arrowRight" size={13} /></Link>
          </div>

          <DemoAnalyze gate={gate} requireSignup={requireSignup} searchesLeft={searchesLeft} />
        </div>
      </div>

      {/* Section 2 — Related Sites demo */}
      <div id="related-sites" style={{ background: "#fff", borderTop: "1px solid var(--lp-line)", scrollMarginTop: 80 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 52px" }}>
          <SectionHead
            step="2"
            eyebrow="Related sites"
            title="Discover relevant sites you haven't considered"
            body="Start from a domain or topic and surface topically related sites, ranked by relevance and price-per-authority — then compare and order them the same way."
          />

          <DemoRelated gate={gate} requireSignup={requireSignup} searchesLeft={searchesLeft} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 26, fontSize: 14, color: "var(--lp-ink-3)" }}>
            <span>Want real results across every live marketplace?</span>
            <Link href={ROUTES.login} style={{ ...btn("primary", "sm"), textDecoration: "none", boxSizing: "border-box" }}>Log in to search live data <Icon name="arrowRight" size={13} /></Link>
          </div>
        </div>
      </div>

      <BlogStrip />
      {signup && <SignupModal reason={signup} onClose={() => setSignup(null)} />}
    </div>
  );
}
