const BENEFITS = [
  { icon: "💰", title: "True market pricing", desc: "See price differences across 60+ marketplaces in seconds." },
  { icon: "📊", title: "SEO metrics built-in", desc: "DR, traffic, and keyword data for every domain." },
  { icon: "❤️", title: "Save & compare", desc: "Favorite domains and compare prices without paying a cent." },
  { icon: "🛒", title: "One-click ordering", desc: "Order directly via Linkpricer — no more juggling emails." },
];

export function AuthBrandPanel() {
  return (
    <section
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
        <h1 style={{ fontSize: 34, fontWeight: 900, color: "#ffffff", lineHeight: 1.15, letterSpacing: -0.75, marginBottom: 14 }}>
          One search.<br />Best price wins.
        </h1>
        <p style={{ fontSize: 15, color: "#c7dcff", lineHeight: 1.6, marginBottom: 0 }}>
          Compare backlink prices across all major marketplaces and find the best deal in seconds.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, margin: "40px 0" }}>
        {BENEFITS.map((b) => (
          <div key={b.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ fontSize: 18, width: 36, height: 36, background: "rgba(255,255,255,0.12)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {b.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 2 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: "#c7dcff", lineHeight: 1.5 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 24 }}>
        <div style={{ display: "flex", gap: 28 }}>
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
    </section>
  );
}
