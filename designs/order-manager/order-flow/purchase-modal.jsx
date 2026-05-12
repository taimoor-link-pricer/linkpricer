// Purchase Modal — managed order flow
// Sectioned card layout: niche pricing → content creation → summary → details form
// AI suggestion popovers on Target URL / Anchor / Title

const PurchaseModal = (() => {
  const { Icon, fmt } = LP;
  const D = LP_ORDER_FLOW.purchase;

  const FEE = 0.15;

  const Section = ({ idx, title, subtitle, optional, children }) => (
    <section style={{
      background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14,
      padding: 22, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
        <span style={{
          fontSize: 11, fontFamily: "var(--lp-mono)", fontWeight: 700,
          color: "var(--lp-mute)", letterSpacing: 0.6,
          padding: "2px 8px", border: "1px solid var(--lp-line)", borderRadius: 999,
        }}>STEP 0{idx}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--lp-ink)" }}>{title}</h3>
        {optional && <span style={{ fontSize: 11.5, color: "var(--lp-mute)", fontWeight: 600 }}>· optional</span>}
        {subtitle && <span style={{ fontSize: 12.5, color: "var(--lp-mute)", marginLeft: "auto" }}>{subtitle}</span>}
      </div>
      {children}
    </section>
  );

  const NicheCard = ({ n, selected, onClick }) => (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
      padding: "14px 16px", borderRadius: 12, cursor: "pointer",
      border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
      background: selected ? "var(--lp-accent-50)" : "#fff",
      boxShadow: selected ? "0 0 0 3px var(--lp-accent-50)" : "none",
      transition: "all .12s",
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999,
        border: "2px solid " + (selected ? "var(--lp-accent)" : "#cbd5e1"),
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--lp-accent)" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--lp-ink)" }}>{n.label}</span>
          {n.restricted && <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, padding: "1px 6px",
            background: "#fdf2dd", color: "#a35d00", borderRadius: 4,
          }}>RESTRICTED</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 2 }}>{n.desc}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{
          fontSize: 18, fontWeight: 800, fontFamily: "var(--lp-mono)",
          color: n.restricted ? "#a35d00" : "var(--lp-ink)", letterSpacing: -0.4,
        }}>${n.price}</div>
        <div style={{ fontSize: 10, color: "var(--lp-mute)", fontWeight: 600 }}>guest post</div>
      </div>
    </button>
  );

  const ContentOptionCard = ({ id, label, desc, price, selected, onClick }) => (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
      flex: 1, padding: 16, textAlign: "left", borderRadius: 12, cursor: "pointer",
      border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
      background: selected ? "var(--lp-accent-50)" : "#fff",
      boxShadow: selected ? "0 0 0 3px var(--lp-accent-50)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={{
          width: 16, height: 16, borderRadius: 999,
          border: "2px solid " + (selected ? "var(--lp-accent)" : "#cbd5e1"),
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--lp-accent)" }} />}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--lp-ink)" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--lp-mute)", fontWeight: 700 }}>{price}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--lp-mute)", lineHeight: 1.4, marginLeft: 24 }}>{desc}</div>
    </button>
  );

  const AILabel = ({ children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--lp-ink-2)", letterSpacing: 0.2 }}>{children}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "1px 8px", borderRadius: 999,
        background: "linear-gradient(135deg, #ede9fe, #dbeafe)",
        color: "#5b21b6", fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
      }}>✨ AI suggestions available</span>
    </div>
  );

  const AIPopover = ({ kind, items, onPick }) => (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
      background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 12,
      boxShadow: "0 12px 32px rgba(15,22,32,0.12), 0 2px 8px rgba(15,22,32,0.06)",
      overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: "linear-gradient(90deg, #faf5ff, #eff6ff)",
        borderBottom: "1px solid var(--lp-line-2)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#5b21b6" }}>
          ✨ AI suggestions for {kind}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--lp-mute)", fontWeight: 600 }}>Tap to use</span>
      </header>
      <ul style={{ listStyle: "none", margin: 0, padding: 6, maxHeight: 220, overflow: "auto" }}>
        {items.map((it, i) => (
          <li key={i} style={{
            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
            background: i === 0 ? "var(--lp-bg-3)" : "transparent",
          }}>
            {typeof it === "string" ? (
              <span style={{ fontSize: 13, color: "var(--lp-ink-2)" }}>{it}</span>
            ) : (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--lp-ink)" }}>{it.title || it.url}</div>
                <div style={{ fontSize: 11, color: "var(--lp-mute)", fontFamily: "var(--lp-mono)", marginTop: 2 }}>
                  {it.url} · <span style={{ color: "var(--lp-good)" }}>{it.traffic}</span>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const App = ({ openAI = "title" } = {}) => {
    const niche = D.niches[1]; // iGaming preselected to demonstrate restricted state
    const wc = D.wordCounts[1]; // 750 default
    const gp = niche.price;
    const cp = wc.p;
    const subtotal = gp + cp;
    const fee = subtotal * FEE;
    const total = subtotal + fee;

    return (
      <div className="lp-reset" style={{
        width: 1200, minHeight: 1500, background: "rgba(15,22,32,0.45)",
        padding: "40px 0", fontFamily: "var(--lp-sans)",
      }}>
        {/* Faded /app underneath (visual context) */}
        <div style={{
          position: "absolute", inset: 0, background: "var(--lp-bg)",
          backgroundImage: `radial-gradient(circle at 20% 10%, rgba(44,100,240,0.04), transparent 40%)`,
          zIndex: -1,
        }} />

        <div style={{
          width: 760, margin: "0 auto", background: "var(--lp-bg)",
          borderRadius: 22, boxShadow: "0 24px 80px rgba(15,22,32,0.32), 0 4px 16px rgba(15,22,32,0.12)",
          overflow: "hidden", border: "1px solid rgba(15,22,32,0.08)",
        }}>
          {/* Header */}
          <header style={{
            background: "#fff", padding: "20px 24px",
            borderBottom: "1px solid var(--lp-line)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: "linear-gradient(135deg, var(--lp-ink), #2c64f0)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="shield" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Managed service</h2>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                  padding: "2px 8px", borderRadius: 4,
                  background: "var(--lp-accent-50)", color: "var(--lp-accent-700)",
                }}>RECOMMENDED</span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--lp-mute)" }}>
                Complete your guest post order for <strong style={{ color: "var(--lp-ink-2)", fontFamily: "var(--lp-mono)" }}>techcrunch.com</strong> via <strong style={{ color: "var(--lp-ink-2)" }}>Adsy</strong>
              </p>
            </div>
            <button style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid var(--lp-line)",
              background: "#fff", cursor: "pointer", color: "var(--lp-mute)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="x" size={14} />
            </button>
          </header>

          <div style={{ padding: "20px 24px" }}>
            {/* SECTION 1 — niche pricing */}
            <Section idx={1} title="Content type & pricing" subtitle="Choose the topic category">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {D.niches.map(n => (
                  <NicheCard key={n.id} n={n} selected={n.id === niche.id} />
                ))}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginTop: 12, padding: "10px 12px", borderRadius: 8,
                background: "#fdf2dd", border: "1px solid #f5e1b7",
              }}>
                <Icon name="info" size={14} color="#a35d00" />
                <span style={{ fontSize: 12, color: "#7a4500" }}>
                  <strong>iGaming Content</strong> is a restricted niche — site owners charge a premium. The right price for restricted topics avoids order rejections later.
                </span>
              </div>
            </Section>

            {/* SECTION 2 — content creation */}
            <Section idx={2} title="Content creation" subtitle="Who writes the article?">
              <div style={{ display: "flex", gap: 10 }}>
                <ContentOptionCard
                  id="we" label="We'll write it" price="from $25" desc="Linkpricer's editorial team writes from your brief"
                  selected={true}
                />
                <ContentOptionCard
                  id="file" label="I'll provide the file" price="$0" desc=".doc / .docx / .pdf / .txt"
                />
                <ContentOptionCard
                  id="link" label="I have a link" price="$0" desc="Google Doc or shared URL"
                />
              </div>

              <div style={{
                marginTop: 14, padding: 14, borderRadius: 10, background: "var(--lp-bg-3)",
                border: "1px solid var(--lp-line-2)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Word count</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {D.wordCounts.map(w => (
                    <button key={w.w} style={{
                      flex: 1, padding: "10px 0", borderRadius: 8,
                      border: "1.5px solid " + (w.w === wc.w ? "var(--lp-accent)" : "var(--lp-line)"),
                      background: w.w === wc.w ? "#fff" : "#fff",
                      color: w.w === wc.w ? "var(--lp-accent-700)" : "var(--lp-ink-2)",
                      fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      boxShadow: w.w === wc.w ? "0 0 0 2px var(--lp-accent-50)" : "none",
                    }}>
                      <span>{w.w} words</span>
                      <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: "var(--lp-mute)" }}>+${w.p}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 8 }}>
                  Pricing is $0.05 per word. Includes 1 round of edits.
                </div>
              </div>
            </Section>

            {/* SECTION 3 — order details (form) */}
            <Section idx={3} title="Order details" subtitle="Tell us where the link goes">
              <div style={{ display: "grid", gap: 14 }}>
                <FormField label="Contact email" required defaultValue="anna@growthlab.io" />

                <div style={{ position: "relative" }}>
                  <AILabel>Target URL *</AILabel>
                  <input
                    defaultValue=""
                    placeholder="https://your-site.com/page-to-link-to"
                    style={inputStyle()}
                  />
                  {openAI === "target" && <AIPopover kind="target URL" items={D.aiTargets} />}
                </div>

                <div style={{ position: "relative" }}>
                  <AILabel>Anchor text *</AILabel>
                  <input
                    defaultValue="AI SEO platform"
                    style={inputStyle()}
                  />
                  {openAI === "anchor" && <AIPopover kind="anchor text" items={D.aiAnchors} />}
                </div>

                <div style={{ position: "relative" }}>
                  <AILabel>Article title *</AILabel>
                  <input
                    defaultValue=""
                    placeholder="The headline for your guest post"
                    style={inputStyle(openAI === "title")}
                  />
                  {openAI === "title" && <AIPopover kind="article title" items={D.aiTitles} />}
                </div>

                <div>
                  <label style={labelStyle()}>Additional requirements</label>
                  <textarea
                    rows={3}
                    placeholder="Any special instructions — internal links, tone, no-go topics…"
                    style={{ ...inputStyle(), minHeight: 84, resize: "vertical" }}
                    defaultValue="Please include 2 internal links — one to /features, one to /pricing. Avoid head-to-head comparisons with named competitors."
                  />
                </div>
              </div>
            </Section>

            {/* SECTION 4 — order summary */}
            <Section idx={4} title="Order summary" subtitle="Live preview · updates as you change options">
              <div style={{
                background: "var(--lp-bg-3)", borderRadius: 12, padding: "14px 18px",
                border: "1px solid var(--lp-line-2)",
              }}>
                <SumRow label="Service type" value={
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", background: "var(--lp-ink)", color: "#fff",
                    borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                  }}>
                    <Icon name="shield" size={11} /> Managed service
                  </span>
                } />
                <SumRow label="Content type" value={
                  <span style={{
                    padding: "3px 10px", background: "#fdf2dd", color: "#a35d00",
                    borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                  }}>iGaming · restricted</span>
                } />
                <SumRow label="Guest post price" value={`$${gp.toLocaleString()}`} mono />
                <SumRow label={`Content creation (${wc.w} words)`} value={`$${cp.toFixed(2)}`} mono />
                <SumRow label="Management fee (15%)" value={`$${fee.toFixed(2)}`} mono hint="Editorial, marketplace handling, follow-up" />
                <div style={{ height: 1, background: "var(--lp-line)", margin: "10px 0" }} />
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.4, textTransform: "uppercase" }}>Total</span>
                  <span style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--lp-mono)", letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
                    ${total.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 4, textAlign: "right" }}>
                  Charged to <strong>•••• 4242</strong> on order confirmation
                </div>
              </div>
            </Section>
          </div>

          {/* Sticky footer */}
          <footer style={{
            background: "#fff", borderTop: "1px solid var(--lp-line)",
            padding: "14px 24px", display: "flex", alignItems: "center", gap: 10,
            position: "sticky", bottom: 0,
          }}>
            <button style={{
              padding: "12px 20px", borderRadius: 10, border: "1px solid var(--lp-line)",
              background: "#fff", color: "var(--lp-ink-2)", fontWeight: 600, fontSize: 13.5,
              cursor: "pointer",
            }}>Cancel</button>
            <div style={{ flex: 1, fontSize: 12, color: "var(--lp-mute)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="shield" size={12} color="var(--lp-good)" /> 14-day refund if order fails
              </span>
            </div>
            <button style={{
              padding: "12px 22px", borderRadius: 10, border: "none",
              background: "linear-gradient(180deg, var(--lp-accent), var(--lp-accent-700))",
              color: "#fff", fontWeight: 700, fontSize: 14,
              boxShadow: "0 6px 16px rgba(44,100,240,0.32)",
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="check" size={14} /> Confirm order — ${total.toFixed(2)}
            </button>
          </footer>
        </div>
      </div>
    );
  };

  return { App };
})();

const FormField = ({ label, required, defaultValue, placeholder }) => (
  <div>
    <label style={labelStyle()}>{label}{required && " *"}</label>
    <input defaultValue={defaultValue} placeholder={placeholder} style={inputStyle()} />
  </div>
);
function labelStyle() {
  return { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--lp-ink-2)", marginBottom: 6, letterSpacing: 0.2 };
}
function inputStyle(focused = false) {
  return {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1.5px solid " + (focused ? "var(--lp-accent)" : "var(--lp-line)"),
    background: "#fff", fontSize: 13.5, color: "var(--lp-ink)",
    fontFamily: "var(--lp-sans)", outline: "none", boxSizing: "border-box",
    boxShadow: focused ? "0 0 0 3px var(--lp-accent-50)" : "none",
  };
}
function SumRow({ label, value, mono, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <div>
        <span style={{ fontSize: 13, color: "var(--lp-ink-2)" }}>{label}</span>
        {hint && <div style={{ fontSize: 10.5, color: "var(--lp-mute)", marginTop: 1 }}>{hint}</div>}
      </div>
      <span style={{
        fontSize: 13.5, fontWeight: 700, color: "var(--lp-ink)",
        fontFamily: mono ? "var(--lp-mono)" : "var(--lp-sans)",
        fontVariantNumeric: "tabular-nums",
      }}>{value}</span>
    </div>
  );
}

window.PurchaseModal = PurchaseModal;
