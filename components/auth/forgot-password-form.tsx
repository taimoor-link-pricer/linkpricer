"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { sendPasswordResetEmail, getAuthErrorMessage, isFirebaseError } from "@/lib/firebase/auth-client";

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

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const email = new FormData(e.currentTarget).get("email") as string;
    try {
      await sendPasswordResetEmail(email);
      // Always show the same success state whether or not the address has
      // an account — Firebase deliberately doesn't tell us either way, and
      // revealing account existence here would defeat that.
      setSent(true);
    } catch (err) {
      setError(isFirebaseError(err) ? getAuthErrorMessage(err.code) : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function focusInput(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "#0052cc";
    e.currentTarget.style.boxShadow = "0 0 0 3px #e6f2ff";
  }

  function blurInput(e: React.FocusEvent<HTMLInputElement>) {
    e.currentTarget.style.borderColor = "#e8eaed";
    e.currentTarget.style.boxShadow = "none";
  }

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, padding: 48, width: "100%", maxWidth: 420, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <Link href={ROUTES.home} style={{ display: "block", fontSize: 20, fontWeight: 800, color: "#000000", marginBottom: 32, textAlign: "center", textDecoration: "none" }}>
        Linkpricer
      </Link>

      {sent ? (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Check your email</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px", lineHeight: 1.5 }}>
            If an account exists for that address, we&apos;ve sent a link to reset your password. It&apos;ll expire in an hour.
          </p>
          <Link
            href={ROUTES.login}
            style={{ display: "block", width: "100%", padding: "12px 16px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
          >
            Back to login
          </Link>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Reset your password</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px" }}>Enter your email and we&apos;ll send you a link to reset it.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="email" style={labelStyle}>Email address</label>
              <input id="email" name="email" type="email" placeholder="you@example.com" required style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
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
              {isLoading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <div style={{ textAlign: "center", fontSize: 14, color: "#6b7280", marginTop: 8 }}>
            <Link href={ROUTES.login} style={{ color: "#0052cc", textDecoration: "none", fontWeight: 600 }}>
              Back to login
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
