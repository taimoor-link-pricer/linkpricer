"use client";

import { useState } from "react";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, linkWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e8eaed",
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8eaed",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid #e8eaed",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  background: "#f9fafb",
  color: "#111827",
  boxSizing: "border-box",
};

const readonlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f5f6f8",
  color: "#9ca3af",
  cursor: "not-allowed",
};

export default function SettingsPage() {
  const { profile, loading, refreshProfile } = useAuthContext();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [currency, setCurrency] = useState("USD");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasPasswordProvider, setHasPasswordProvider] = useState(
    () => auth.currentUser?.providerData.some((p) => p.providerId === "password") ?? true
  );

  const [saveBtnHover, setSaveBtnHover] = useState(false);
  const [pwBtnHover, setPwBtnHover] = useState(false);

  if (loading) return <LoadingSpinner />;

  async function handleProfileSave() {
    const user = auth.currentUser;
    if (!user) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/user/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) throw new Error("save failed");
      // Keep Firebase's own copy in sync too (used as a fallback display name
      // and by some auth-provider UI), but the PATCH above is what actually
      // makes the change visible elsewhere in the app.
      await updateProfile(user, { displayName: displayName.trim() || null }).catch(() => {});
      await refreshProfile();
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch {
      setProfileMsg({ type: "error", text: "Failed to update profile. Please try again." });
    } finally {
      setProfileSaving(false);
    }
  }

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

  const memberSince = profile
    ? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "—";

  return (
    <>
    <style>{`.settings-page{padding:32px 40px;max-width:700px;margin:0 auto}@media(max-width:768px){.settings-page{padding:20px 16px}}`}</style>
    <div className="settings-page">
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
          Manage your account preferences and security
        </p>
      </div>

      {/* Profile section */}
      <SectionCard title="Profile">
        <FormField label="Display Name">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
        </FormField>
        <FormField label="Email Address">
          <input
            type="email"
            value={profile?.email ?? ""}
            readOnly
            style={readonlyInputStyle}
          />
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
            Email cannot be changed. Contact support if needed.
          </p>
        </FormField>
        <FormField label="Preferred Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
          </select>
        </FormField>

        {profileMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              background: profileMsg.type === "success" ? "#dcfce7" : "#fee2e2",
              color: profileMsg.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            {profileMsg.text}
          </div>
        )}

        <button
          onClick={handleProfileSave}
          onMouseEnter={() => setSaveBtnHover(true)}
          onMouseLeave={() => setSaveBtnHover(false)}
          disabled={profileSaving}
          style={{
            padding: "10px 24px",
            background: profileSaving ? "#6b9fdb" : saveBtnHover ? "#003a99" : "#0052cc",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: profileSaving ? "not-allowed" : "pointer",
            fontSize: 14,
            transition: "background 0.15s",
          }}
        >
          {profileSaving ? "Saving..." : "Save changes"}
        </button>
      </SectionCard>

      {/* Account section */}
      <SectionCard title="Account">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Role</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 99,
                background: profile?.role === "vendor" ? "#fee2e2" : "#eff6ff",
                color: profile?.role === "vendor" ? "#dc2626" : "#2563eb",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {profile?.role ?? "client"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Member since</span>
            <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{memberSince}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>Onboarding</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 99,
                background: profile?.hasCompletedOnboarding ? "#dcfce7" : "#fef3c7",
                color: profile?.hasCompletedOnboarding ? "#166534" : "#92400e",
              }}
            >
              {profile?.hasCompletedOnboarding ? "Complete" : "Pending"}
            </span>
          </div>
        </div>
      </SectionCard>

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

            {passwordMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  background: passwordMsg.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: passwordMsg.type === "success" ? "#166534" : "#991b1b",
                }}
              >
                {passwordMsg.text}
              </div>
            )}

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

            {passwordMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 13,
                  background: passwordMsg.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: passwordMsg.type === "success" ? "#166534" : "#991b1b",
                }}
              >
                {passwordMsg.text}
              </div>
            )}

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
