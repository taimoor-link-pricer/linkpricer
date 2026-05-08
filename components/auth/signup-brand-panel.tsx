const HIGHLIGHTS = [
  { icon: "✓", text: "Free to compare — no credit card needed" },
  { icon: "✓", text: "60+ marketplaces in one dashboard" },
  { icon: "✓", text: "Bulk domain search & favorites" },
  { icon: "✓", text: "Full order tracking by email & dashboard" },
  { icon: "✓", text: "GDPR-friendly, secure, exportable" },
];

export function SignupBrandPanel() {
  return (
    <div
      style={{
        background: "linear-gradient(160deg, #0052cc 0%, #003a99 100%)",
        height: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 40px",
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#ffffff", letterSpacing: -0.5, marginBottom: 48 }}>
          Linkpricer
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 900, color: "#ffffff", lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 12 }}>
          Start building smarter.<br />Compare. Order. Track.
        </h2>
        <p style={{ fontSize: 14, color: "#c7dcff", lineHeight: 1.6, marginBottom: 36 }}>
          Join thousands of SEO professionals who use Linkpricer to find the best backlink prices.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {HIGHLIGHTS.map((h) => (
            <div key={h.text} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 900, flexShrink: 0, marginTop: 1 }}>{h.icon}</span>
              <span style={{ fontSize: 14, color: "#e0ecff", lineHeight: 1.4 }}>{h.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 24, display: "flex", gap: 28 }}>
        {[
          { stat: "60+", label: "Vendors" },
          { stat: "40K+", label: "Domains" },
          { stat: "3K+", label: "Users" },
        ].map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffffff" }}>{item.stat}</div>
            <div style={{ fontSize: 12, color: "#93b8f5", marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
