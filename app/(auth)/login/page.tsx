import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Linkpricer workspace.",
};

export default function LoginPage() {
  return (
    <>
      <style>{`
        .auth-root { display: flex; flex-direction: row; min-height: 100vh; }
        .auth-brand { width: 420px; flex-shrink: 0; }
        @media (max-width: 900px) {
          .auth-brand { display: none; }
          .auth-root { flex-direction: column; }
        }
      `}</style>
      <main className="auth-root">
        <div className="auth-brand">
          <AuthBrandPanel />
        </div>
        <LoginForm />
      </main>
    </>
  );
}
