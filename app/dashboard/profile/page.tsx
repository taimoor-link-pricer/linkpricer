"use client";

import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import {
  LoadingSpinner,
  SectionCard,
  FormField,
  FormMessage,
  inputStyle,
  readonlyInputStyle,
} from "@/components/dashboard/settings-shared";

// Photo upload (Avatar preview, "Change photo" button, /api/user/profile-image)
// is built and working end to end, but disabled here -- Firebase Storage
// writes are down platform-wide right now (GCP billing closed on the
// linkpricer-dev project, see memory/project_new_app_storage_billing.md).
// Re-enable by restoring the commented block below once billing is fixed;
// nothing else needs to change.
// import { useRef } from "react";
// import { Avatar } from "@/components/dashboard/avatar";
// const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB, matches the server-side check

export default function ProfilePage() {
  const { profile, loading, refreshProfile } = useAuthContext();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [currency, setCurrency] = useState("USD");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saveBtnHover, setSaveBtnHover] = useState(false);

  // const photoInputRef = useRef<HTMLInputElement>(null);
  // const [photoUploading, setPhotoUploading] = useState(false);
  // const [photoMsg, setPhotoMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (loading) return <LoadingSpinner />;

  // async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
  //   const file = e.target.files?.[0];
  //   e.target.value = ""; // allow re-selecting the same file later
  //   if (!file) return;
  //
  //   if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
  //     setPhotoMsg({ type: "error", text: "Please choose a JPEG, PNG, or WebP image." });
  //     return;
  //   }
  //   if (file.size > MAX_PHOTO_SIZE) {
  //     setPhotoMsg({ type: "error", text: "Image is too large. Max 5MB." });
  //     return;
  //   }
  //
  //   setPhotoUploading(true);
  //   setPhotoMsg(null);
  //   try {
  //     const form = new FormData();
  //     form.append("file", file);
  //     const res = await fetch("/api/user/profile-image", { method: "POST", body: form });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.error ?? "Upload failed");
  //
  //     // Keep Firebase's own copy in sync too, same as the display-name save below.
  //     const user = auth.currentUser;
  //     if (user) await updateProfile(user, { photoURL: data.url }).catch(() => {});
  //     await refreshProfile();
  //     setPhotoMsg({ type: "success", text: "Profile photo updated." });
  //   } catch (err) {
  //     setPhotoMsg({ type: "error", text: err instanceof Error ? err.message : "Upload failed. Please try again." });
  //   } finally {
  //     setPhotoUploading(false);
  //   }
  // }

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

  const memberSince = profile
    ? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "—";

  return (
    <>
    <style>{`.profile-page{padding:32px 40px;max-width:700px;margin:0 auto}@media(max-width:768px){.profile-page{padding:20px 16px}}`}</style>
    <div className="profile-page">
      <DashboardNav breadcrumb="/ app / profile" />

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
          Profile
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          Manage your personal information
        </p>
      </div>

      {/* Profile section */}
      <SectionCard title="Profile">
        {/* Photo upload -- see the disabled block near the top of this file
            for why (Firebase Storage billing). Re-enable by uncommenting
            both this JSX block and the state/handler above.
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <Avatar url={profile?.profileImageUrl} initials={initials} size={72} />
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              style={{
                padding: "8px 16px",
                background: "#ffffff",
                color: "#374151",
                border: "1px solid #e8eaed",
                borderRadius: 8,
                fontWeight: 600,
                cursor: photoUploading ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              {photoUploading ? "Uploading..." : "Change photo"}
            </button>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "6px 0 0" }}>
              JPEG, PNG, or WebP. Max 5MB.
            </p>
          </div>
        </div>

        <FormMessage msg={photoMsg} />
        */}

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

        <FormMessage msg={profileMsg} />

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
    </div>
    </>
  );
}
