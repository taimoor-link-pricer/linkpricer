"use client";

const WHY_CARDS = [
  { icon: "💰", title: "True market pricing", description: "Stop guessing. See price differences across marketplaces in seconds and negotiate better deals." },
  { icon: "📧", title: "One order, not 50 emails", description: "Centralize purchasing — let your dashboard and inbox reflect the status. No more juggling threads." },
  { icon: "✅", title: "Fewer surprises", description: "Acceptance rules and requirements surfaced up front. Choose viable domains only." },
  { icon: "🎁", title: "Always free to compare", description: "Build lists, favorite targets, and compare prices without paying a cent. Zero paywall." },
];

const FEATURE_CARDS = [
  { title: "📊 Bulk search", description: "Paste hundreds of domains at once for instant availability & best-price matching." },
  { title: "🔄 Marketplace comparison", description: "We unify listings from multiple marketplaces and show the best place to purchase." },
  { title: "❤️ Favorites list", description: "Shortlist domains you like and come back later or order in one go." },
  { title: "🛒 Direct ordering", description: "Checkout via Linkpricer or delegate ordering to us with your instructions." },
  { title: "📧 Email-first workflow", description: "Automatic Order received email. Ongoing communication continues by email." },
  { title: "📋 Dashboard tracking", description: "Mirror of your email thread: see order status, confirmations, content, and publication." },
  { title: "✍️ Content options", description: "Upload your article or let us write it for you. Status visible end-to-end." },
  { title: "🔒 Privacy & security", description: "GDPR-friendly data handling, role-based access, and exportable records." },
  { title: "💵 Zero cost to compare", description: "Comparisons are free. You only pay when you place an order." },
];

const PRICING_CARDS = [
  { title: "No paywall for research", description: "Paste, compare, and favorite domains without entering a card." },
  { title: "Transparent checkout", description: "Before you pay, you see exactly what is being ordered and the total due." },
  { title: "Invoices by email", description: "Once a marketplace confirms your order via API, we email the invoice so you can pay and continue." },
];

function hoverCard(el: HTMLDivElement, enter: boolean) {
  el.style.borderColor = enter ? "#0052cc" : "#e8eaed";
  el.style.boxShadow = enter ? "0 8px 24px rgba(0,82,204,0.1)" : "none";
  el.style.transform = enter ? "translateY(-4px)" : "none";
}

export function AnalyticsSection() {
  return (
    <>
      <style>{`
        .analytics-section { padding: 100px 40px; }
        .analytics-h2 { font-size: 44px; margin: 0 0 56px; }
        .analytics-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px; }
        .analytics-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 1024px) {
          .analytics-grid-3 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .analytics-section { padding: 56px 16px; }
          .analytics-h2 { font-size: 26px; margin: 0 0 32px; letter-spacing: -0.5px; }
          .analytics-grid-2 { grid-template-columns: 1fr; gap: 16px; }
          .analytics-grid-3 { grid-template-columns: 1fr; gap: 16px; }
        }
      `}</style>

      {/* Why Linkpricer */}
      <section className="analytics-section" style={{ background: "#f5f6f8" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="analytics-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            Why choose Linkpricer?
          </h2>
          <div className="analytics-grid-2">
            {WHY_CARDS.map((card) => (
              <div
                key={card.title}
                style={{ background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)", border: "1px solid #cce5ff", borderRadius: 14, padding: 36, transition: "all 0.3s", cursor: "pointer" }}
                onMouseEnter={(e) => hoverCard(e.currentTarget as HTMLDivElement, true)}
                onMouseLeave={(e) => hoverCard(e.currentTarget as HTMLDivElement, false)}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 10px", color: "#000000" }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="analytics-section" style={{ background: "#ffffff" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="analytics-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            What&apos;s included
          </h2>
          <div className="analytics-grid-3">
            {FEATURE_CARDS.map((card) => (
              <div
                key={card.title}
                style={{ background: "#f5f6f8", border: "1px solid #e8eaed", borderRadius: 14, padding: 28, transition: "all 0.3s" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "#ffffff";
                  el.style.borderColor = "#0052cc";
                  el.style.boxShadow = "0 6px 16px rgba(0,82,204,0.08)";
                  el.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = "#f5f6f8";
                  el.style.borderColor = "#e8eaed";
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px", color: "#000000" }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free to use pricing */}
      <section className="analytics-section" style={{ background: "#f5f6f8" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="analytics-h2" style={{ fontWeight: 900, textAlign: "center", color: "#000000", letterSpacing: -1 }}>
            Free to use, transparent pricing
          </h2>
          <div className="analytics-grid-3">
            {PRICING_CARDS.map((card) => (
              <div
                key={card.title}
                style={{ background: "#ffffff", border: "1px solid #e8eaed", borderRadius: 14, padding: 32, textAlign: "center", transition: "all 0.3s" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#006621";
                  el.style.boxShadow = "0 8px 24px rgba(0,102,33,0.1)";
                  el.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "#e8eaed";
                  el.style.boxShadow = "none";
                  el.style.transform = "none";
                }}
              >
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 10px", color: "#000000" }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 }}>{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
