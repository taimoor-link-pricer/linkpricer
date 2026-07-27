import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Linkpricer account password.",
};

export default function ForgotPasswordPage() {
  return (
    <main style={{ margin: 0, padding: 0, background: "#eff0f3", fontFamily: "Inter, -apple-system, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <ForgotPasswordForm />
    </main>
  );
}
