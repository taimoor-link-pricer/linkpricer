"use client";

const DEMO_FEATURES = [
  { icon: "📊", title: "See all available offers", description: "Every marketplace that has your domain, with prices side-by-side. Find the cheapest instantly." },
  { icon: "⭐", title: "Value grading", description: "Our proprietary algorithm rates whether a domain is worth its price based on traffic, DR, and market average." },
  { icon: "❤️", title: "Save & organize", description: "Heart domains you love, build shortlists, and come back anytime to order them in bulk." },
  { icon: "📈", title: "SEO metrics built-in", description: "See Domain Rating, organic traffic, keyword count, and category for every domain in real-time." },
];

const HOW_STEPS = [
  { num: "1", title: "Paste your domain list", description: "Paste a URL or bulk URLs of any domain you're considering for a guest post or backlink placement. No formatting required." },
  { num: "2", title: "Compare & favorite", description: "See where each domain is available and the lowest purchase price. Add domains to Favorites to build your shortlist." },
  { num: "3", title: "Order in one go", description: "Checkout directly via Linkpricer or leave order details to us. You get an Order received email instantly." },
  { num: "4", title: "Track in your dashboard", description: "All communication continues by email. Progress is mirrored in your dashboard for full visibility." },
  { num: "5", title: "Invoice after confirmation", description: "When the marketplace confirms your order, we email the invoice. Pay first, then delivery continues." },
  { num: "6", title: "Content handling", description: "Upload your own article or ask us to write it — either way, you see every step until publication." },
];

export function FeaturesSection() {
  return (
    <>
      <style>{`
        .feat-section { padding: 100px 40px; }
        .feat-h2 { font-size: 44px; margin: 0 0 56px; }
        .feat-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; }
        .feat-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        @media (max-width: 1024px) {
          .feat-grid-3 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .feat-section { padding: 56px 16px; }
          .feat-h2 { font-size: 26px; margin: 0 0 32px; letter-spacing: -0.5px; }
          .feat-grid-2 { grid-template-columns: 1fr; gap: 16px; }
          .feat-grid-3 { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>

      {/* See it in action */}
      <section className="feat-section" style={{ background: "linear-gradient(135deg, #f5f6f8 0%, #eff0f3 100%)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="feat-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            See it in action
          </h2>
          <div className="feat-grid-2">
            {DEMO_FEATURES.map((f) => (
              <div
                key={f.title}
                style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, padding: 32, transition: "all 0.3s" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#0052cc";
                  el.style.boxShadow = "0 8px 24px rgba(0,82,204,0.1)";
                  el.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#e8eaed";
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, background: "#e6f2ff", borderRadius: 12, fontSize: 24, marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 10px", color: "#000000" }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="feat-section" id="how" style={{ background: "#ffffff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="feat-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            How it works in 6 steps
          </h2>
          <div className="feat-grid-3">
            {HOW_STEPS.map((step) => (
              <div
                key={step.num}
                style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, padding: 32, textAlign: "center", transition: "all 0.3s", position: "relative", overflow: "hidden" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#0052cc";
                  el.style.boxShadow = "0 8px 24px rgba(0,82,204,0.1)";
                  el.style.transform = "translateY(-6px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#e8eaed";
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #0052cc, #003a99)" }} />
                <div style={{ fontSize: 40, fontWeight: 900, color: "#0052cc", marginBottom: 12 }}>{step.num}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px", color: "#000000" }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
