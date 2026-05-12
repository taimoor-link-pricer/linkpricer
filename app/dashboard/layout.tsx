"use client";

import { useState } from "react";
import { AuthProvider, useAuthContext } from "@/lib/contexts/auth-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { TipsBanner } from "@/components/dashboard/TipsBanner";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, handleSignOut } = useAuthContext();

  const displayName = profile?.displayName
    ? profile.displayName.split(" ")[0]
    : profile?.email?.split("@")[0] ?? "User";

  return (
    <>
      <style>{`
        .mobile-topbar {
          display: none; align-items: center; justify-content: space-between;
          padding: 12px 20px; background: #ffffff; border-bottom: 1px solid #e8eaed;
          position: sticky; top: 0; z-index: 100;
        }
        @media (max-width: 768px) {
          .mobile-topbar { display: flex; }
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 22, color: "#374151", padding: 4, lineHeight: 1,
          }}
          aria-label="Open menu"
        >
          ☰
        </button>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#0052cc" }}>Linkpricer</span>
        <button
          onClick={handleSignOut}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "#6b7280", fontWeight: 500,
          }}
        >
          Sign out
        </button>
      </div>

      <div style={{ display: "flex", minHeight: "100vh", background: "#f5f6f8" }}>
        <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, overflow: "auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <TipsBanner />
          {children}
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
