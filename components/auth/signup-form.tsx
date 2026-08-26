"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES, validRedirect } from "@/lib/constants";
import { getPostAuthRoute } from "@/lib/auth/post-auth-route";
import {
  signUpWithEmail,
  startGoogleSignIn,
  getAuthErrorMessage,
  isFirebaseError,
} from "@/lib/firebase/auth-client";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  background: "#ffffff",
  color: "#000000",
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  color: "#1a202c",
  marginBottom: 8,
};

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = validRedirect(searchParams.get("redirect"));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tosAccepted) { setError("Please accept the Terms of Service and Privacy Policy."); return; }
    setError(null);
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    const fullName = (fd.get("name") as string).trim();
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";
    try {
      await signUpWithEmail(firstName, lastName, fd.get("email") as string, fd.get("password") as string);
      router.push(await getPostAuthRoute(redirect));
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
      setIsLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setIsLoading(true);
    try {
      await startGoogleSignIn();
      router.push(await getPostAuthRoute(redirect));
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
      setIsLoading(false);
    }
  }

  function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = "#0052cc";
    e.currentTarget.style.boxShadow = "0 0 0 3px #e6f2ff";
  }

  function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = "#e8eaed";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, padding: 48, width: "100%", maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <Link href={ROUTES.home} style={{ display: "block", fontSize: 20, fontWeight: 800, color: "#000000", marginBottom: 32, textAlign: "center", textDecoration: "none" }}>
        Linkpricer
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Get started free</h1>
      <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px" }}>No credit card required. Start comparing domain prices in minutes.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="name" style={labelStyle}>Full name</label>
          <input id="name" name="name" type="text" placeholder="John Doe" required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="email" style={labelStyle}>Email address</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="company" style={labelStyle}>
            Company <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
          </label>
          <input id="company" name="company" type="text" placeholder="Acme Agency" style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="use-case" style={labelStyle}>What will you use Linkpricer for?</label>
          <textarea
            id="use-case"
            name="use-case"
            placeholder="e.g., Building backlinks for my clients' sites..."
            required
            style={{ ...inputStyle, resize: "vertical", minHeight: 80 } as React.CSSProperties}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, fontSize: 13, color: "#6b7280" }}>
          <input
            type="checkbox"
            id="terms"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0, marginTop: 2 }}
          />
          <label htmlFor="terms" style={{ cursor: "pointer" }}>
            I agree to the{" "}
            <Link href="/terms" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 500 }}>Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" style={{ color: "#0052cc", textDecoration: "none", fontWeight: 500 }}>Privacy Policy</Link>
          </label>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 16px", fontWeight: 500 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{ width: "100%", padding: "12px 16px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {isLoading && <span style={{ width: 14, height: 14, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", margin: "24px 0", color: "#9ca3af", fontSize: 13 }}>
        <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
        <span style={{ margin: "0 12px" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
        style={{ width: "100%", padding: "11px 16px", background: "#ffffff", color: "#1a202c", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: isLoading ? "not-allowed" : "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.background = "#f5f6f8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e8eaed"; e.currentTarget.style.background = "#ffffff"; }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Sign up with Google
      </button>

      <div style={{ textAlign: "center", fontSize: 14, color: "#6b7280", marginTop: 24 }}>
        Already have an account?{" "}
        <Link href={ROUTES.login} style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>
          Log in
        </Link>
      </div>
    </div>
  );
}
