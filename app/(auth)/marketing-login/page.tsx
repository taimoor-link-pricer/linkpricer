import { LoginForm } from "@/components/auth/login-form";

export default function MarketingLoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f6f8", padding: "24px 16px" }}>
      <LoginForm />
    </div>
  );
}
