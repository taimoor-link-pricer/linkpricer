"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { verifyPasswordResetCode, confirmPasswordReset, getAuthErrorMessage, isFirebaseError } from "@/lib/firebase/auth-client";

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

type CodeState = { status: "checking" } | { status: "valid"; email: string } | { status: "invalid"; message: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [codeState, setCodeState] = useState<CodeState>({ status: "checking" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setCodeState({ status: "invalid", message: "This reset link is missing its code. Request a new one." });
      return;
    }
    verifyPasswordResetCode(oobCode)
      .then((email) => setCodeState({ status: "valid", email }))
      .catch((err) =>
        setCodeState({
          status: "invalid",
          message: isFirebaseError(err) ? getAuthErrorMessage(err.code) : "This reset link is invalid or has expired.",
        })
      );
  }, [oobCode]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!oobCode) return;
    setError(null);

    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirmPassword = fd.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(oobCode, password);
      setDone(true);
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

      {codeState.status === "checking" && (
        <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", margin: 0 }}>Checking your link…</p>
      )}

      {codeState.status === "invalid" && (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Link expired</h1>
          <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 32px", lineHeight: 1.5 }}>{codeState.message}</p>
          <Link
            href={ROUTES.forgotPassword}
            style={{ display: "block", width: "100%", padding: "12px 16px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
          >
            Request a new link
          </Link>
        </>
      )}

      {codeState.status === "valid" && done && (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Password updated</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px" }}>Your password has been reset. You can now log in with it.</p>
          <Link
            href={ROUTES.login}
            style={{ display: "block", width: "100%", padding: "12px 16px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}
          >
            Go to login
          </Link>
        </>
      )}

      {codeState.status === "valid" && !done && (
        <>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#000000", margin: "0 0 8px", letterSpacing: -0.5 }}>Set a new password</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px" }}>For {codeState.email}</p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="password" style={labelStyle}>New password</label>
              <input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="confirmPassword" style={labelStyle}>Confirm new password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required minLength={6} style={inputStyle} onFocus={focusInput} onBlur={blurInput} />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 16px", fontWeight: 500 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{ width: "100%", padding: "12px 16px", background: "#0052cc", color: "#ffffff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {isLoading && <span style={{ width: 14, height: 14, border: "2px solid #ffffff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />}
              {isLoading ? "Saving…" : "Reset password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
