"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import {
  signUpWithEmail,
  startGoogleSignIn,
  finishGoogleSignIn,
  getAuthErrorMessage,
  isFirebaseError,
} from "@/lib/firebase/auth-client";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }} aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
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

function InputField({ id, name, type = "text", autoComplete, placeholder, required = true }: {
  id: string; name: string; type?: string; autoComplete?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      autoComplete={autoComplete}
      required={required}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#0052cc"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,82,204,0.1)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#e8eaed"; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
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
    const form = e.currentTarget;
    const data = new FormData(form);
    const firstName = data.get("first_name") as string;
    const lastName = data.get("last_name") as string;
    const email = data.get("email") as string;
    const password = data.get("password") as string;
    const confirmPassword = data.get("confirm_password") as string;
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (!tosAccepted || !privacyAccepted) { setError("Please accept the Terms of Service and Privacy Policy."); return; }
    setIsLoading(true);
    try {
      await signUpWithEmail(firstName, lastName, email, password);
      router.push(ROUTES.onboarding);
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setIsLoading(true);
    try {
      const { isNewUser } = await startGoogleSignIn();
      router.push(isNewUser ? ROUTES.onboarding : ROUTES.dashboard);
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#000000", letterSpacing: -0.5, margin: "0 0 6px" }}>
          Create your account
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          It&apos;s free to search, compare, and favorite domains.
        </p>
      </div>

      {/* Google sign-up */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "11px 16px", background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#000000", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.6 : 1, marginBottom: 18 }}
      >
        <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>or sign up with email</span>
        <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label htmlFor="first_name" style={labelStyle}>First name</label>
            <InputField id="first_name" name="first_name" autoComplete="given-name" placeholder="John" />
          </div>
          <div>
            <label htmlFor="last_name" style={labelStyle}>Last name</label>
            <InputField id="last_name" name="last_name" autoComplete="family-name" placeholder="Doe" />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" style={labelStyle}>Email address</label>
          <InputField id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <div style={{ position: "relative" }}>
            <InputField id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="••••••••" />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, display: "flex" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label htmlFor="confirm_password" style={labelStyle}>Confirm password</label>
          <InputField id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" placeholder="••••••••" />
        </div>

        {/* Checkboxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input id="tos" name="tos" type="checkbox" checked={tosAccepted} onChange={(e) => setTosAccepted(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#0052cc", cursor: "pointer", marginTop: 2, flexShrink: 0 }} />
            <label htmlFor="tos" style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.4, cursor: "pointer" }}>
              I agree to the{" "}
              <Link href="/terms" style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>Terms of Service</Link>
            </label>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input id="privacy" name="privacy" type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#0052cc", cursor: "pointer", marginTop: 2, flexShrink: 0 }} />
            <label htmlFor="privacy" style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.4, cursor: "pointer" }}>
              I acknowledge the{" "}
              <Link href="/privacy" style={{ color: "#0052cc", fontWeight: 600, textDecoration: "none" }}>Privacy Policy</Link>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p role="alert" style={{ fontSize: 13, color: "#dc2626", fontWeight: 500, margin: 0 }}>{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          style={{ width: "100%", padding: "13px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, marginTop: 4 }}
        >
          {isLoading ? "Creating account…" : "Create account"}
        </button>

        {/* Sign in CTA */}
        <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
          Already have an account?{" "}
          <Link href={ROUTES.login} style={{ color: "#0052cc", fontWeight: 700, textDecoration: "none" }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}
