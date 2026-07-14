export function SectionHead({ step, eyebrow, title, body }: { step: string; eyebrow: string; title: string; body: string }) {
  return (
    <div style={{ marginBottom: 20, maxWidth: 640 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--lp-mono)", fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--lp-accent-700)", marginBottom: 12 }}>
        <span style={{ width: 20, height: 20, borderRadius: 999, background: "var(--lp-accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{step}</span>
        {eyebrow}
      </div>
      <h2 style={{ margin: 0, fontSize: "clamp(24px, 3.2vw, 32px)", fontWeight: 800, letterSpacing: -0.8, color: "var(--lp-ink)" }}>{title}</h2>
      <p style={{ margin: "10px 0 0", fontSize: 15.5, color: "var(--lp-ink-3)", lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}
