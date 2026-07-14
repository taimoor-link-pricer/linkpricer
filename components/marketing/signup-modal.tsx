"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { Icon } from "@/lib/design-v1/icons";
import { btn } from "@/components/design-v1/primitives";

export type SignupReason = "search" | "buy" | "save" | "generic";

const COPY: Record<SignupReason, { title: string; body: string }> = {
  search: { title: "You've used your free demo searches", body: "Create a free account to keep searching — and run it against live marketplace data instead of the sample set." },
  buy: { title: "Sign up to place this order", body: "Create a free account and we'll handle the order directly with the marketplace — one price, low fee, pay only after publication." },
  save: { title: "Sign up to save this site", body: "Create a free account to save sites to your favourites and track their prices over time." },
  generic: { title: "Create your free LinkPricer account", body: "Search live marketplaces, compare prices and order directly — all in one place." },
};

export function SignupModal({ reason, onClose }: { reason: SignupReason; onClose: () => void }) {
  const c = COPY[reason] || COPY.generic;

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
