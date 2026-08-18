"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { Icon } from "@/lib/design-v1/icons";
import { btn } from "@/components/design-v1/primitives";
import { signInWithEmail, getAuthErrorMessage, isFirebaseError } from "@/lib/firebase/auth-client";

export type SignupReason = "search" | "buy" | "save" | "generic";

const COPY: Record<SignupReason, { title: string; body: string }> = {
  search: { title: "You've used your free demo searches", body: "Log in to keep searching — against live marketplace data instead of the sample set." },
  buy: { title: "Log in to place this order", body: "We'll handle the order directly with the marketplace — one price, low fee, pay only after publication." },
  save: { title: "Log in to save this site", body: "Save sites to your favourites and track their prices over time." },
  generic: { title: "Log in to Linkpricer", body: "Search live marketplaces, compare prices and order directly — all in one place." },
};

export function SignupModal({ reason, onClose, domain }: { reason: SignupReason; onClose: () => void; domain?: string }) {
  const c = COPY[reason] || COPY.generic;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carries the matched domain through login/signup so the user lands back
  // on its real compare-offers view post-auth, instead of a generic
  // dashboard — see login-form.tsx/signup-form.tsx's `redirect` handling.
  const target = domain ? `${ROUTES.search}?domain=${encodeURIComponent(domain)}` : undefined;
  const signupHref = target ? `${ROUTES.signup}?redirect=${encodeURIComponent(target)}` : ROUTES.signup;
  // Carry over whatever the user already typed here so they don't retype it
  // on the real signup page.
  const signupHrefWithEmail = email ? `${signupHref}${signupHref.includes("?") ? "&" : "?"}email=${encodeURIComponent(email)}` : signupHref;

  const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid var(--lp-line)", fontSize: 14, fontFamily: "inherit", color: "var(--lp-ink-2)", outline: "none", background: "#fff" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      onClose();
      router.push(target ?? ROUTES.search);
    } catch (err) {
      // auth/user-not-found only ever surfaces on projects without email
      // enumeration protection — the modern Firebase default collapses both
      // "no account" and "wrong password" into auth/invalid-credential so a
      // failed login can't be used to probe which emails are registered.
      // Only route to signup on the unambiguous case; an ambiguous failure
      // gets a normal inline error (with a manual "sign up instead" link
      // below) rather than guessing and bouncing someone with a typo'd
      // password straight into an "email already in use" wall.
      if (isFirebaseError(err) && err.code === "auth/user-not-found") {
        router.push(signupHrefWithEmail);
        return;
      }
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
      setIsLoading(false);
    }
  }

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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <input type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} style={field} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={field} required />

            {error && (
              <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>{error}</p>
            )}

            <div style={{ textAlign: "right", marginTop: -2 }}>
              <Link href={ROUTES.forgotPassword} style={{ fontSize: 12.5, color: "var(--lp-mute-2)" }}>Forgot password?</Link>
            </div>

            <button type="submit" disabled={isLoading} style={{ ...btn("primary"), height: 46, justifyContent: "center", fontSize: 14.5, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? "not-allowed" : "pointer" }}>
              {isLoading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--lp-mute-2)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} /> new here? <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} />
          </div>
          <Link href={signupHrefWithEmail} style={{ ...btn("ghost"), width: "100%", height: 44, justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Create free account</Link>

          <p style={{ margin: "16px 0 0", fontSize: 11.5, color: "var(--lp-mute)", textAlign: "center", lineHeight: 1.5 }}>
            No credit card required · Pay only after publication
          </p>
        </div>
      </div>
    </div>
  );
}
