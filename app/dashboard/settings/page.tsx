"use client";

import { useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, linkWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import {
  LoadingSpinner,
  SectionCard,
  FormField,
  FormMessage,
  inputStyle,
} from "@/components/dashboard/settings-shared";

export default function SettingsPage() {
  const { loading } = useAuthContext();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasPasswordProvider, setHasPasswordProvider] = useState(
    () => auth.currentUser?.providerData.some((p) => p.providerId === "password") ?? true
  );

  const [pwBtnHover, setPwBtnHover] = useState(false);

  if (loading) return <LoadingSpinner />;

  async function handlePasswordChange() {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPasswordMsg({ type: "error", text: "Current password is incorrect." });
      } else {
        setPasswordMsg({ type: "error", text: "Failed to change password. Please try again." });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleAddPassword() {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    setPasswordSaving(true);
    setPasswordMsg(null);

    try {
      const credential = EmailAuthProvider.credential(user.email, newPassword);
      await linkWithCredential(user, credential);
      setHasPasswordProvider(true);
      setPasswordMsg({ type: "success", text: "Password added. You can now also log in with your email and password." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/requires-recent-login") {
        setPasswordMsg({ type: "error", text: "Please sign out and sign back in with Google, then try again." });
      } else if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        setPasswordMsg({ type: "error", text: "This email is already linked to a password on another account." });
      } else {
        setPasswordMsg({ type: "error", text: "Failed to add password. Please try again." });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <>
    <style>{`.settings-page{padding:32px 40px;max-width:700px;margin:0 auto}@media(max-width:768px){.settings-page{padding:20px 16px}}`}</style>
    <div className="settings-page">
      <DashboardNav breadcrumb="/ app / settings" />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#000000",
            margin: "0 0 4px",
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Manage your account security
        </p>
      </div>

      {/* Security section */}
      <SectionCard title="Security">
        {hasPasswordProvider ? (
          <>
            <FormField label="Current Password">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={inputStyle}
              />
            </FormField>
            <FormField label="New Password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                style={inputStyle}
              />
            </FormField>
            <FormField label="Confirm New Password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
              />
            </FormField>

            <FormMessage msg={passwordMsg} />

            <button
              onClick={handlePasswordChange}
              onMouseEnter={() => setPwBtnHover(true)}
              onMouseLeave={() => setPwBtnHover(false)}
              disabled={passwordSaving}
              style={{
                padding: "10px 24px",
                background: passwordSaving ? "#6b9fdb" : pwBtnHover ? "#003a99" : "#0052cc",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: passwordSaving ? "not-allowed" : "pointer",
                fontSize: 14,
                transition: "background 0.15s",
              }}
            >
              {passwordSaving ? "Changing..." : "Change password"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
              Your account currently signs in with Google only. Add a password to also be able to log in with your email address.
            </p>
            <FormField label="New Password">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                style={inputStyle}
              />
            </FormField>
            <FormField label="Confirm Password">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                style={inputStyle}
              />
            </FormField>

            <FormMessage msg={passwordMsg} />

            <button
              onClick={handleAddPassword}
              onMouseEnter={() => setPwBtnHover(true)}
              onMouseLeave={() => setPwBtnHover(false)}
              disabled={passwordSaving}
              style={{
                padding: "10px 24px",
                background: passwordSaving ? "#6b9fdb" : pwBtnHover ? "#003a99" : "#0052cc",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: passwordSaving ? "not-allowed" : "pointer",
                fontSize: 14,
                transition: "background 0.15s",
              }}
            >
              {passwordSaving ? "Adding..." : "Add password"}
            </button>
          </>
        )}
      </SectionCard>

      {/* Danger zone */}
      <div
        style={{
          background: "#fff7f7",
          border: "1px solid #fecaca",
          borderRadius: 12,
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#991b1b",
            margin: "0 0 8px",
          }}
        >
          Danger Zone
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          Account deletion is permanent and cannot be undone.
        </p>
        <button
          disabled
          style={{
            padding: "10px 20px",
            background: "#f5f6f8",
            color: "#9ca3af",
            border: "1px solid #e8eaed",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "not-allowed",
            fontSize: 13,
          }}
        >
          Delete account — contact support
        </button>
      </div>
    </div>
    </>
  );
}
