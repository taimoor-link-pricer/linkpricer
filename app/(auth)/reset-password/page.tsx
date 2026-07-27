import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Set a new password for your Linkpricer account.",
};

export default function ResetPasswordPage() {
  return (
    <main style={{ margin: 0, padding: 0, background: "#eff0f3", fontFamily: "Inter, -apple-system, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
