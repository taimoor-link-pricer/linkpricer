import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Linkpricer workspace.",
};

export default function LoginPage() {
  return (
    <main style={{ margin: 0, padding: 0, background: "#eff0f3", fontFamily: "Inter, -apple-system, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <LoginForm />
    </main>
  );
}
