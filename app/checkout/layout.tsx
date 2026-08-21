"use client";

import { AuthProvider } from "@/lib/contexts/auth-context";

// Checkout is authenticated (CheckoutModal reads useAuthContext for
// profile.uid) but deliberately outside app/dashboard/* — it already
// rendered as a full-bleed fixed overlay with no dashboard chrome even as a
// modal, so this mirrors app/(onboarding)/layout.tsx's pattern: just
// AuthProvider, no DashboardShell/TipsBanner/DashboardNav to strip back out.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
