"use client";

// Shared building blocks for the Profile and Settings pages, split out of
// what used to be one combined settings page -- same reasoning that already
// justified extracting ProfileMenu/DashboardNav: two pages hand-copying the
// same card/field/input styling is exactly the kind of thing that quietly
// drifts.

export function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e8eaed",
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8eaed",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        overflow: "hidden",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid #e8eaed",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #e8eaed",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  background: "#f9fafb",
  color: "#111827",
  boxSizing: "border-box",
};

export const readonlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f5f6f8",
  color: "#9ca3af",
  cursor: "not-allowed",
};

export function FormMessage({ msg }: { msg: { type: "success" | "error"; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 13,
        background: msg.type === "success" ? "#dcfce7" : "#fee2e2",
        color: msg.type === "success" ? "#166534" : "#991b1b",
      }}
    >
      {msg.text}
    </div>
  );
}
