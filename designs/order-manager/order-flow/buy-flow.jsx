// Buy flow — Cart, Checkout, Order placed (confirmation)
// Each is an artboard. They share visual language with V1.

const BuyFlow = (() => {
  const { Icon, fmt, flag } = LP;
  const data = LP_DATA;

  // Items in the cart
  const cartItems = [
    {
      domain: "techcrunch.com", country: "US", dr: 94, traffic: 51200000,
      marketplace: "Adsy", marketplaceType: "API",
      gpPrice: 1100, contentPrice: 120, link: "Dofollow",
      delivery: 14, anchor: "fintech onboarding flow",
      target: "https://yourbrand.com/blog/fintech-onboarding-guide",
      title: "Why fintech founders should rethink onboarding in 2026",
      brief: "Editorial piece — lead with industry insight; link appears naturally in section 3 (case study). Avoid promotional tone. Reference Stripe, Adyen, Plaid for context.",
      writeOurContent: true,
    },
    {
      domain: "forbes.com", country: "US", dr: 92, traffic: 84000000,
      marketplace: "Vendor: Marek K.", marketplaceType: "Vendor",
      gpPrice: 1450, contentPrice: 0, link: "Dofollow",
      delivery: 21, anchor: "CEE fintech market",
      target: "https://yourbrand.com/insights/cee-fintech-2026",
      title: "Fintech in CEE: 5 trends shaping 2026",
      brief: "We'll provide our own copy.",
      writeOurContent: false,
    },
    {
      domain: "oneangrygamer.net", country: "US", dr: 56, traffic: 410000,
      marketplace: "Adsy", marketplaceType: "API",
      gpPrice: 580, contentPrice: 120, link: "Dofollow",
      delivery: 10, anchor: "indie game economics",
      target: "https://yourbrand.com/blog/indie-launch-2026",
      title: "The economics of indie game launches in 2026",
      brief: "Industry-first commentary; we want to be quoted as a primary source.",
      writeOurContent: true,
    },
  ];

  const subtotal = cartItems.reduce((s, x) => s + x.gpPrice + x.contentPrice, 0);
  const fee = Math.round(subtotal * 0.15);
  const total = subtotal + fee;

  // Tiny domain row used in cart + checkout
  const ItemRow = ({ item, compact = false }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--lp-line-2)" }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, background: "var(--lp-bg-3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--lp-mono)", fontWeight: 800, fontSize: 14, color: "var(--lp-ink-2)",
      }}>{item.domain[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 13.5 }}>{item.domain}</span>
          <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "var(--lp-bg-3)", fontWeight: 700, color: "var(--lp-ink-2)" }}>DR {item.dr}</span>
          <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>✓ Dofollow</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 2 }}>
          via <strong style={{ color: "var(--lp-ink-2)" }}>{item.marketplace}</strong> · delivery {item.delivery} days · {fmt.num(item.traffic)} traffic
        </div>
      </div>
      {!compact && (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--lp-mono)", fontWeight: 800, fontSize: 16 }}>
            ${(item.gpPrice + item.contentPrice).toLocaleString()}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>
            ${item.gpPrice} GP {item.contentPrice ? `+ $${item.contentPrice} content` : "· own content"}
          </div>
        </div>
      )}
      {compact && (
        <div style={{ fontFamily: "var(--lp-mono)", fontWeight: 800, fontSize: 14 }}>
          ${(item.gpPrice + item.contentPrice).toLocaleString()}
        </div>
      )}
    </div>
  );

  // ============ Cart Drawer (modal-ish, 480 wide) ============
  const Cart = () => (
    <div className="lp-reset" style={{
      width: 1100, minHeight: 700, background: "rgba(15,22,32,0.5)",
      padding: "20px 28px", display: "flex", flexDirection: "column", justifyContent: "stretch",
    }}>
      {/* fake page behind */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* dimmed page mockup */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.45,
          background: "var(--lp-bg)", borderRadius: 14, overflow: "hidden",
          display: "flex", flexDirection: "column", padding: 18,
        }}>
          <div style={{ fontWeight: 700, color: "var(--lp-mute)", fontSize: 14 }}>Domain analysis · 5 results</div>
          <div style={{ marginTop: 12, height: 6, background: "var(--lp-line)", borderRadius: 3 }} />
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{ height: 56, background: "#fff", borderRadius: 10, margin: "8px 0", border: "1px solid var(--lp-line)" }} />
          ))}
        </div>
        {/* drawer */}
        <aside style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 480,
          background: "#fff", borderRadius: "14px 0 0 14px",
          boxShadow: "-20px 0 60px rgba(15,22,32,0.18)",
          display: "flex", flexDirection: "column",
          border: "1px solid var(--lp-line)",
        }}>
          <header style={{
            padding: "16px 20px", borderBottom: "1px solid var(--lp-line)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Your cart</h3>
              <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 2 }}>
                {cartItems.length} placements · saved 1 hour ago
              </div>
            </div>
            <button style={{
              width: 30, height: 30, borderRadius: 7, border: "1px solid var(--lp-line)",
              background: "#fff", color: "var(--lp-mute)", cursor: "pointer",
            }}><Icon name="x" size={13} /></button>
          </header>

          <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
            {cartItems.map(item => <ItemRow key={item.domain} item={item} />)}
            <button style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 14px", margin: "16px 0", width: "100%",
              borderRadius: 10, border: "1px dashed var(--lp-line)",
              background: "var(--lp-bg-3)", color: "var(--lp-ink-2)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              <Icon name="search" size={14} color="var(--lp-mute)" />
              Add another domain to this order
            </button>
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--lp-line)", background: "var(--lp-bg-3)" }}>
            <div style={summaryRow}><span>Subtotal</span><span style={mono14}>${subtotal.toLocaleString()}</span></div>
            <div style={summaryRow}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Linkpricer fee <span style={{ fontSize: 10, color: "var(--lp-mute)" }}>(15%)</span>
              </span>
              <span style={mono14}>${fee.toLocaleString()}</span>
            </div>
            <div style={{ ...summaryRow, paddingTop: 8, marginTop: 8, borderTop: "1px solid var(--lp-line-2)" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--lp-ink)" }}>Total</span>
              <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 800, fontSize: 22, color: "var(--lp-ink)", letterSpacing: -0.5 }}>
                ${total.toLocaleString()}
              </span>
            </div>
            <div style={{
              fontSize: 11.5, color: "var(--lp-mute)", margin: "10px 0 12px",
              padding: "8px 10px", background: "#fff", borderRadius: 8, border: "1px solid var(--lp-line-2)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="shield" size={14} color="var(--lp-good)" />
              <span><strong>Pay only after publication.</strong> No charge today — we invoice you once each article goes live and the URL is delivered.</span>
            </div>
            <button style={{
              width: "100%", padding: "14px", background: "var(--lp-ink)", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              Continue to brief <Icon name="external" size={12} style={{ transform: "rotate(-90deg)" }} />
            </button>
            <button style={{
              width: "100%", marginTop: 6, padding: "10px",
              background: "transparent", color: "var(--lp-mute)", border: "none",
              fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}>
              Save as list & buy later
            </button>
          </div>
        </aside>
      </div>
    </div>
  );

  // ============ Full Checkout Page ============
  const Checkout = () => {
    const [items, setItems] = React.useState(cartItems);
    const [expandedIdx, setExpandedIdx] = React.useState(0);
    
    const handleToggleCard = (idx) => setExpandedIdx(expandedIdx === idx ? -1 : idx);
    const handleChangeItem = (idx, updated) => {
      const newItems = [...items];
      newItems[idx] = updated;
      setItems(newItems);
    };
    const handlePlaceOrder = () => {
      window.parent.postMessage({ type: '__buyflow_place_order', items }, '*');
    };

    const subtotal = items.reduce((s, x) => s + x.gpPrice + x.contentPrice, 0);
    const fee = Math.round(subtotal * 0.15);
    const total = subtotal + fee;

    return (
    <div className="lp-reset" style={{
      width: 1500, minHeight: 1100, background: "var(--lp-bg)", padding: "20px 28px 40px",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
          <span style={{ marginLeft: 14, color: "var(--lp-mute)", fontSize: 12 }}>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--lp-mute)", textDecoration: "none" }}>Cart</a>
            <span style={{ margin: "0 8px" }}>›</span>
            <span style={{ color: "var(--lp-ink-2)" }}>Checkout</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--lp-mute)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="shield" size={13} color="var(--lp-good)" />
          Secure checkout · escrow protected
        </div>
      </header>

      {/* Stepper */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 0 22px",
      }}>
        {["Cart", "Article briefs", "Confirm order"].map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px", borderRadius: 999,
              background: i === 1 ? "var(--lp-accent)" : i < 1 ? "#fff" : "var(--lp-bg-3)",
              color: i === 1 ? "#fff" : i < 1 ? "var(--lp-ink-2)" : "var(--lp-mute)",
              border: i < 1 ? "1px solid var(--lp-line)" : "none",
              fontSize: 12, fontWeight: 700,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 999, fontSize: 10, fontWeight: 800,
                background: i === 1 ? "#fff" : i < 1 ? "var(--lp-good)" : "var(--lp-line)",
                color: i === 1 ? "var(--lp-accent)" : "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>{i < 1 ? "✓" : i + 1}</span>
              {s}
            </div>
            {i < 2 && <div style={{ flex: "0 0 24px", height: 1, background: "var(--lp-line)" }} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 18, alignItems: "flex-start" }}>
        {/* LEFT — briefs per item */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14,
            padding: "16px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Article briefs</h2>
              <span style={{ fontSize: 11.5, color: "var(--lp-mute)" }}>
                3 of 3 ready · briefs auto-saved
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--lp-mute)" }}>
              Tell us what to write. We assign editors fluent in your niche.
            </p>
          </div>

          {items.map((item, i) => (
            <BriefCard key={item.domain} item={item} idx={i} expanded={expandedIdx === i} onToggle={handleToggleCard} onChange={handleChangeItem} />
          ))}
        </div>

        {/* RIGHT — order summary + payment */}
        <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14, padding: 18,
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Estimated cost</h3>
            {items.map(item => <ItemRow key={item.domain} item={item} compact />)}
              <div style={{ marginTop: 14, fontSize: 13 }}>
              <div style={summaryRow}><span>{items.length} placements subtotal</span><span style={mono14}>${subtotal.toLocaleString()}</span></div>
              <div style={summaryRow}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Linkpricer fee
                  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--lp-bg-3)", color: "var(--lp-mute)", fontWeight: 700 }}>15%</span>
                </span>
                <span style={mono14}>${fee.toLocaleString()}</span>
              </div>
              <div style={summaryRow}>
                <span>VAT (added per invoice)</span>
                <span style={{ ...mono14, color: "var(--lp-mute)" }}>—</span>
              </div>
              <div style={{ ...summaryRow, paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--lp-line-2)" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--lp-ink)" }}>Estimated total</span>
                <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 800, fontSize: 24, color: "var(--lp-ink)", letterSpacing: -0.6 }}>
                  ${total.toLocaleString()}
                </span>
              </div>
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "var(--lp-good-bg)", border: "1px solid #bbf0c8", display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Icon name="shield" size={14} color="var(--lp-good)" />
                <div style={{ fontSize: 11.5, color: "#0d5e2e", lineHeight: 1.4 }}>
                  <strong>$0 charged today.</strong> Each placement is invoiced individually only after the publication URL is delivered and verified live.
                </div>
              </div>
            </div>
          </div>

          <button onClick={handlePlaceOrder} style={{
            padding: "16px", background: "var(--lp-ink)", color: "#fff",
            border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Icon name="check" size={14} /> Place order
          </button>
          <div style={{ fontSize: 11.5, color: "var(--lp-mute)", textAlign: "center", lineHeight: 1.5 }}>
            By placing this order you agree to the <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--lp-accent)", textDecoration: "none" }}>marketplace terms</a>. We'll send an invoice for each placement once the publication URL is delivered.
          </div>
        </div>
      </div>
    </div>
    );
  };

  const BriefCard = ({ item, idx, expanded, onToggle, onChange }) => {
    const ready = !!item.brief && !!item.target && !!item.anchor;
    return (
      <div style={{
        background: "#fff", border: "1px solid " + (expanded ? "var(--lp-accent)" : "var(--lp-line)"),
        borderRadius: 14, overflow: "hidden",
        boxShadow: expanded ? "0 0 0 3px var(--lp-accent-50)" : "none",
      }}>
        <header 
          onClick={() => onToggle(idx)}
          style={{
            padding: "14px 18px", display: "flex", alignItems: "center", gap: 14,
            borderBottom: expanded ? "1px solid var(--lp-line-2)" : "none",
            background: expanded ? "var(--lp-accent-50)" : "transparent",
            cursor: "pointer",
          }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: ready ? "var(--lp-good-bg)" : "#fdf2dd",
            color: ready ? "var(--lp-good)" : "#a35d00",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 12, border: "1px solid " + (ready ? "#bbf0c8" : "#f3d99c"),
          }}>{ready ? "✓" : idx + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 14 }}>{item.domain}</span>
              <span style={{ fontSize: 11, color: "var(--lp-mute)" }}>via {item.marketplace}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 2 }}>
              {item.title}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
            background: ready ? "var(--lp-good-bg)" : "#fdf2dd",
            color: ready ? "var(--lp-good)" : "#a35d00",
          }}>{ready ? "Ready" : "Brief needed"}</span>
          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={14} color="var(--lp-mute)" />
        </header>

        {expanded && (
          <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* left col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Article title">
                <input 
                  type="text" 
                  value={item.title || ""} 
                  onChange={(e) => onChange(idx, { ...item, title: e.target.value })}
                  style={input()} />
              </Field>
              <Field label="Target URL (where the link points)">
                <input 
                  type="url" 
                  value={item.target || ""} 
                  onChange={(e) => onChange(idx, { ...item, target: e.target.value })}
                  style={{ ...input(), fontFamily: "var(--lp-mono)" }} />
              </Field>
              <Field label="Anchor text">
                <input 
                  type="text" 
                  value={item.anchor || ""} 
                  onChange={(e) => onChange(idx, { ...item, anchor: e.target.value })}
                  style={{ ...input(), fontFamily: "var(--lp-mono)" }} />
                <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 4 }}>
                  Most-quoted by editors: branded · partial · exact match
                </div>
              </Field>
              <Field label="Niche / category">
                <select 
                  value={item.category || "Fintech"}
                  onChange={(e) => onChange(idx, { ...item, category: e.target.value })}
                  style={input()}>
                  <option>Fintech</option><option>SaaS</option><option>Crypto</option><option>Gambling</option>
                </select>
              </Field>
            </div>

            {/* right col */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Who writes the article?">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <button
                    onClick={() => onChange(idx, { ...item, contentMode: "linkpricer" })}
                    style={{
                      padding: "12px 10px", borderRadius: 10,
                      background: item.contentMode === "linkpricer" ? "var(--lp-accent-50)" : "#fff",
                      border: "1px solid " + (item.contentMode === "linkpricer" ? "var(--lp-accent)" : "var(--lp-line)"),
                      cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: item.contentMode === "linkpricer" ? "var(--lp-accent)" : "var(--lp-ink-2)" }}>
                      Linkpricer writes it
                    </div>
                    <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>
                      + ${item.contentPrice} · 750 words
                    </div>
                  </button>
                  <button
                    onClick={() => onChange(idx, { ...item, contentMode: "upload" })}
                    style={{
                      padding: "12px 10px", borderRadius: 10,
                      background: item.contentMode === "upload" ? "var(--lp-accent-50)" : "#fff",
                      border: "1px solid " + (item.contentMode === "upload" ? "var(--lp-accent)" : "var(--lp-line)"),
                      cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: item.contentMode === "upload" ? "var(--lp-accent)" : "var(--lp-ink-2)" }}>
                      I'll upload content
                    </div>
                    <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>
                      Free · .docx, .md, .pdf
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => onChange(idx, { ...item, contentMode: "url" })}
                  style={{
                    width: "100%", padding: "12px 10px", borderRadius: 10,
                    background: item.contentMode === "url" ? "var(--lp-accent-50)" : "#fff",
                    border: "1px solid " + (item.contentMode === "url" ? "var(--lp-accent)" : "var(--lp-line)"),
                    cursor: "pointer", textAlign: "left",
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: item.contentMode === "url" ? "var(--lp-accent)" : "var(--lp-ink-2)" }}>
                    Article already published
                  </div>
                  <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>
                    Free · provide URL to existing article
                  </div>
                </button>
              </Field>
              <Field label={
                item.contentMode === "linkpricer" ? "Brief for the editor" :
                item.contentMode === "upload" ? "Upload article" :
                "Article URL"
              }>
                {item.contentMode === "linkpricer" ? (
                  <textarea 
                    value={item.brief || ""}
                    onChange={(e) => onChange(idx, { ...item, brief: e.target.value })}
                    style={{ ...input(), minHeight: 110, resize: "vertical", lineHeight: 1.5 }} />
                ) : item.contentMode === "upload" ? (
                  <div style={{
                    border: "1.5px dashed var(--lp-line)", borderRadius: 9,
                    padding: 22, textAlign: "center", background: "var(--lp-bg-3)", cursor: "pointer",
                  }}>
                    <Icon name="upload" size={20} color="var(--lp-mute)" />
                    <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12.5 }}>Drop .docx, .md or .pdf</div>
                    <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>or click to choose · max 5 MB</div>
                  </div>
                ) : (
                  <input 
                    type="url"
                    placeholder="https://yourbrand.com/blog/article-title"
                    value={item.articleUrl || ""}
                    onChange={(e) => onChange(idx, { ...item, articleUrl: e.target.value })}
                    style={{ ...input(), fontFamily: "var(--lp-mono)" }} />
                )}
              </Field>
              <Field label="Tone">
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["Editorial", "Authoritative", "Friendly", "Technical"].map((t) => (
                    <button 
                      key={t}
                      onClick={() => onChange(idx, { ...item, tone: t })}
                      style={{
                        padding: "6px 11px", borderRadius: 999,
                        background: item.tone === t ? "var(--lp-ink)" : "#fff",
                        color: item.tone === t ? "#fff" : "var(--lp-ink-2)",
                        border: "1px solid " + (item.tone === t ? "var(--lp-ink)" : "var(--lp-line)"),
                        fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                      }}>{t}</button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============ Order Placed (confirmation) ============
  const OrderPlaced = () => (
    <div className="lp-reset" style={{
      width: 1500, minHeight: 950, background: "var(--lp-bg)", padding: "20px 28px 40px",
    }}>
      <header style={{ display: "flex", alignItems: "center", padding: "8px 0 18px", gap: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
      </header>

      <div style={{
        background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 18,
        padding: "44px 48px", maxWidth: 980, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: "var(--lp-good-bg)", color: "var(--lp-good)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "3px solid #bbf0c8", marginBottom: 14,
          }}>
            <Icon name="check" size={32} />
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Order confirmed.</h1>
          <p style={{ margin: "6px 0 0", color: "var(--lp-mute)", fontSize: 14 }}>
            <strong style={{ color: "#0d5e2e" }}>$0 charged today.</strong> Order ID <strong style={{ color: "var(--lp-ink)", fontFamily: "var(--lp-mono)" }}>#ord_2k4f1</strong>
          </p>
        </div>

        {/* What happens next */}
        <div style={{
          background: "var(--lp-bg-3)", borderRadius: 12, padding: "18px 22px", marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "var(--lp-mute)", textTransform: "uppercase", marginBottom: 12 }}>
            Next steps
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { i: "edit", t: "Editors assigned", d: "Within 24 hours, a specialist in your niche will be assigned to each article." },
              { i: "user", t: "Drafts ready to review", d: "2–3 days. Review drafts in your dashboard, request edits, or approve for publication." },
              { i: "external", t: "Published & invoiced", d: "Once a marketplace publishes your article, we verify it's live and invoice that placement." },
            ].map(s => (
              <div key={s.t} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: "#fff", border: "1px solid var(--lp-line)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "var(--lp-accent)",
                }}><Icon name={s.i} size={15} /></div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.t}</div>
                <div style={{ fontSize: 12, color: "var(--lp-mute)", lineHeight: 1.5 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Items snapshot */}
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 6px" }}>3 placements</h3>
        {cartItems.map(item => <ItemRow key={item.domain} item={item} compact />)}

        <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "center" }}>
          <button style={{
            padding: "12px 22px", background: "var(--lp-ink)", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="external" size={13} /> View your orders
          </button>
          <button style={{
            padding: "12px 22px", background: "#fff", color: "var(--lp-ink)",
            border: "1px solid var(--lp-line)", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="download" size={13} /> Download invoice
          </button>
        </div>
      </div>
    </div>
  );

  return { Cart, Checkout, OrderPlaced };
})();

const summaryRow = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", fontSize: 13, color: "var(--lp-ink-2)" };
const mono14 = { fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 14, color: "var(--lp-ink)", fontVariantNumeric: "tabular-nums" };

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--lp-ink-2)", letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function input() {
  return {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1px solid var(--lp-line)", background: "#fff",
    fontSize: 13, fontFamily: "var(--lp-sans)", color: "var(--lp-ink)",
    outline: "none", boxSizing: "border-box",
  };
}
function PaymentOption({ label, sub, selected, addNew }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
      background: selected ? "var(--lp-accent-50)" : "#fff",
      cursor: "pointer",
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 999,
        border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
        position: "relative", flex: "0 0 auto",
      }}>
        {selected && <span style={{
          position: "absolute", inset: 3, borderRadius: 999, background: "var(--lp-accent)",
        }} />}
      </span>
      {!addNew ? (
        <div style={{
          width: 36, height: 24, borderRadius: 4,
          background: "linear-gradient(135deg, #1a1f71, #1a1f71 60%, #f7b600 60%)",
          flex: "0 0 auto",
        }} />
      ) : (
        <div style={{
          width: 36, height: 24, borderRadius: 4, background: "var(--lp-bg-3)",
          color: "var(--lp-mute)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, flex: "0 0 auto",
        }}>+</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--lp-mute)" }}>{sub}</div>
      </div>
    </label>
  );
}
function RadioCard({ selected, title, sub }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 9,
      border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
      background: selected ? "var(--lp-accent-50)" : "#fff",
      cursor: "pointer", display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 999,
          border: "1.5px solid " + (selected ? "var(--lp-accent)" : "var(--lp-line)"),
          position: "relative", flex: "0 0 auto",
        }}>
          {selected && <span style={{ position: "absolute", inset: 3, borderRadius: 999, background: "var(--lp-accent)" }} />}
        </span>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>{title}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--lp-mute)", paddingLeft: 22 }}>{sub}</div>
    </div>
  );
}

window.BuyFlow = BuyFlow;
