import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Linkpricer account.",
};

export default function SignupPage() {
  return (
    <main style={{ margin: 0, padding: "40px 16px", background: "#eff0f3", fontFamily: "Inter, -apple-system, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <SignupForm />
    </main>
  );
}
