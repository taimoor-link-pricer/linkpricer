"use client";

import { AuthProvider } from "@/lib/contexts/auth-context";
import { TipsBanner } from "@/components/dashboard/TipsBanner";

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9" }}>
      <TipsBanner />
      {children}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
