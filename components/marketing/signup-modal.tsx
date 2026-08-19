"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { Icon } from "@/lib/design-v1/icons";
import { btn } from "@/components/design-v1/primitives";
import { signInWithEmail, startGoogleSignIn, getAuthErrorMessage, isFirebaseError } from "@/lib/firebase/auth-client";

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

  async function handleGoogleSignIn() {
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      await startGoogleSignIn();
      onClose();
      router.push(target ?? ROUTES.search);
    } catch (err) {
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
            <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} /> or <span style={{ flex: 1, height: 1, background: "var(--lp-line)" }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            style={{ ...btn("ghost"), width: "100%", height: 44, justifyContent: "center", gap: 8, boxSizing: "border-box", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

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
