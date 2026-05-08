import type { Metadata } from "next";
import { SignupBrandPanel } from "@/components/auth/signup-brand-panel";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Linkpricer account and start comparing backlink prices for free.",
};

export default function SignupPage() {
  return (
    <>
      <style>{`
        .auth-root { display: flex; flex-direction: row; min-height: 100vh; }
        .auth-brand { width: 420px; flex-shrink: 0; }
        .auth-form-side { flex: 1; display: flex; align-items: center; justify-content: center; background: #ffffff; padding: 40px 24px; overflow-y: auto; }
        @media (max-width: 900px) {
          .auth-brand { display: none; }
          .auth-root { flex-direction: column; }
          .auth-form-side { padding: 32px 16px; align-items: flex-start; }
        }
      `}</style>
      <main className="auth-root">
        <div className="auth-brand">
          <SignupBrandPanel />
        </div>
        <div className="auth-form-side">
          <div style={{ width: "100%", maxWidth: 460 }}>
            <SignupForm />
          </div>
        </div>
      </main>
    </>
  );
}
