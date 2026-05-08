"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import {
  signInWithEmail,
  startGoogleSignIn,
  finishGoogleSignIn,
  getAuthErrorMessage,
  isFirebaseError,
} from "@/lib/firebase/auth-client";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
  color: "#000000",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#4b5563",
  marginBottom: 6,
};

export function LoginForm() {
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    finishGoogleSignIn()
      .then((result) => {
        if (result) {
          setIsLoading(true);
          router.push(result.isNewUser ? ROUTES.onboarding : ROUTES.dashboard);
        }
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    try {
      await signInWithEmail(email, password);
      router.push(ROUTES.dashboard);
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsLoading(true);
    try {
      const { isNewUser } = await startGoogleSignIn();
      router.push(isNewUser ? ROUTES.onboarding : ROUTES.dashboard);
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <section style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "48px 40px", background: "#ffffff" }}>
      {/* Mobile logo */}
      <div style={{ display: "none", marginBottom: 32, alignSelf: "flex-start" }} className="mobile-logo">
        <span style={{ fontSize: 20, fontWeight: 900, color: "#0052cc", letterSpacing: -0.5 }}>Linkpricer</span>
      </div>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: "#000000", letterSpacing: -0.5, margin: "0 0 8px" }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Sign in to your Linkpricer account.
          </p>
        </div>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 16px", background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#000000", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1, marginBottom: 20 }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>or sign in with email</span>
          <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,82,204,0.1)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e8eaed"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label htmlFor="password" style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
              <Link href={ROUTES.forgotPassword} style={{ fontSize: 12, color: "#0052cc", textDecoration: "none", fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,82,204,0.1)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e8eaed"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>

          {/* Remember me */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#0052cc", cursor: "pointer" }}
            />
            <label htmlFor="remember" style={{ fontSize: 13, color: "#4b5563", cursor: "pointer" }}>
              Remember me
            </label>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" style={{ fontSize: 13, color: "#dc2626", fontWeight: 500, margin: 0 }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{ width: "100%", padding: "13px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, marginTop: 4 }}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Sign up CTA */}
        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 24 }}>
          Don&apos;t have an account?{" "}
          <Link href={ROUTES.signup} style={{ color: "#0052cc", fontWeight: 700, textDecoration: "none" }}>
            Sign up free
          </Link>
        </p>

        {/* Legal */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #f0f2f5", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 16px" }}>
          {[
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
            { label: "Contact", href: "/contact" },
          ].map((link) => (
            <Link key={link.href} href={link.href} style={{ fontSize: 11, color: "#9ca3af", textDecoration: "none" }}>
              {link.label}
            </Link>
          ))}
          <span style={{ fontSize: 11, color: "#d1d5db" }}>© 2026 Linkpricer</span>
        </div>
      </div>
    </section>
  );
}
