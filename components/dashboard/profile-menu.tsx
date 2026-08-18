"use client";

// Avatar-circle + dropdown, extracted from app/dashboard/search/page.tsx so
// every dashboard page (Analyze/Related Sites/Favorites/Orders) renders the
// same profile menu instead of only the page it happened to be built on.
import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { C } from "@/components/dashboard/results-shared";
import { ROUTES } from "@/lib/constants";
import { Avatar } from "@/components/dashboard/avatar";

export function ProfileMenu() {
  const { profile, loading, handleSignOut } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hard navigation (not router.push) so AuthProvider re-fetches /api/user/me
  // from scratch under the new view_mode cookie and re-runs its redirect logic.
  async function switchToAdmin() {
    setSwitching(true);
    try {
      await fetch("/api/auth/view-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "admin" }),
      });
    } finally {
      window.location.href = ROUTES.admin;
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = profile?.displayName
    ? profile.displayName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : profile?.email?.[0].toUpperCase() ?? "";

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: 8 }}>
      <button
        onClick={() => !loading && setOpen(v => !v)}
        style={{
          width: 36, height: 36, borderRadius: "50%",
          background: loading ? C.line : "transparent",
          border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          cursor: loading ? "default" : "pointer",
          padding: 0,
          transition: "background 0.3s ease",
        }}
      >
        {!loading && <Avatar url={profile?.profileImageUrl} initials={initials} size={32} />}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 44, width: 220, background: "#fff", borderRadius: 12, border: `1px solid ${C.line}`, boxShadow: "0 8px 32px rgba(15,22,32,0.14)", zIndex: 999, overflow: "hidden" }}>
          {/* User info */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line2}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar url={profile?.profileImageUrl} initials={initials} size={38} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.displayName ?? "User"}</div>
                <div style={{ fontSize: 11.5, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.email}</div>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: "6px 0" }}>
            {[
              { label: "My profile", icon: "👤", href: ROUTES.profile },
              { label: "Settings", icon: "⚙️", href: ROUTES.settings },
            ].map(item => (
              <a key={item.label} href={item.href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13, color: C.ink2, textDecoration: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </a>
            ))}
            {profile?.isAdmin && (
              <button
                onClick={switchToAdmin}
                disabled={switching}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", width: "100%", fontSize: 13, color: C.ink2, background: "none", border: "none", cursor: switching ? "default" : "pointer", textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget.style.background = C.bg3)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 15 }}>🛠️</span>
                {switching ? "Switching…" : "Switch to Admin view"}
              </button>
            )}
            <div style={{ height: 1, background: C.line2, margin: "4px 0" }} />
            <button
              onClick={handleSignOut}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", width: "100%", fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 15 }}>🚪</span>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
