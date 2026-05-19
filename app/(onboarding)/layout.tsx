"use client";

import { AuthProvider } from "@/lib/contexts/auth-context";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
