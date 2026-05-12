// Variation 4 — Bold editorial
// Magazine-style: huge headlines, strong type contrast, accent color, two-column rows.
// Domain rows read like editorial cards with a giant price + ranked marketplace strip.

const V4 = (() => {
  const { Icon, fmt, flag } = LP;
  const data = LP_DATA;

  // Bold palette — paper + ink + electric coral
  const C = {
    bg: "#f5f3ee",
    paper: "#ffffff",
    ink: "#0c0c0e",
    ink2: "#222226",
    mute: "#6b6b72",
    line: "#dcd8cf",
    line2: "#e7e3da",
    accent: "#ff4d2e",
    accentInk: "#ffffff",
    good: "#0a8a4a",
    warn: "#b76e00",
    bad: "#c1300d",
  };

  // Score "ticker" — letter grade in a strong block
  const GradeBlock = ({ grade, score, big = false }) => {
    let bg = "#222226", fg = "#fff";
    if (grade?.startsWith("A")) { bg = C.ink; fg = "#fff"; }
    else if (grade === "B+" || grade === "B") { bg = "#fff"; fg = C.ink; }
    else if (grade === "B-") { bg = "#fff"; fg = C.warn; }
    else { bg = "#fff"; fg = C.mute; }
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: big ? "8px 14px" : "5px 10px",
        background: bg, color: fg, border: "2px solid " + C.ink,
        fontFamily: "var(--lp-display)", fontWeight: 900,
        letterSpacing: -0.6, fontSize: big ? 24 : 14,
      }}>
        <span>{grade || "—"}</span>
        <span style={{ fontSize: big ? 12 : 10, fontWeight: 700, fontFamily: "var(--lp-mono)", opacity: 0.7 }}>{score ?? ""}</span>
      </div>
    );
  };

  // ============== Hero ==============
  const Hero = () => (
    <section style={{ padding: "40px 0 32px", borderBottom: "2px solid " + C.ink, marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{
          display: "inline-block", padding: "3px 10px",
          background: C.ink, color: "#fff",
          fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
        }}>VOL.07</span>
        <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, letterSpacing: 0.4 }}>
          DOMAIN ANALYSIS · MAY 06 2026
        </span>
        <span style={{ flex: 1, height: 1, background: C.ink, marginLeft: 6 }} />
        <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute }}>7 MARKETPLACES · LIVE</span>
      </div>

      <h1 style={{
        margin: 0, fontFamily: "var(--lp-display)",
        fontSize: 88, lineHeight: 0.92, fontWeight: 900,
        letterSpacing: -3, color: C.ink,
      }}>
        The fairest<br /><span style={{ color: C.accent, fontStyle: "italic" }}>price</span> for every<br />backlink, in seconds.
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 40, marginTop: 36 }}>
        <div>
          <div style={{
            background: C.paper, border: "2px solid " + C.ink,
            padding: 0,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: "2px solid " + C.ink, background: C.ink, color: "#fff",
            }}>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}>
                01 · PASTE YOUR DOMAINS
              </span>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11 }}>
                <span style={{ color: C.accent }}>5</span>/200
              </span>
            </div>
            <div style={{
              padding: 18, fontFamily: "var(--lp-mono)", fontSize: 14,
              minHeight: 144, lineHeight: 1.7, color: C.ink2,
            }}>
              forbes.com<br />
              betimate.com<br />
              oneangrygamer.net<br />
              techcrunch.com <span style={{ color: C.accent, fontWeight: 700 }}>1100</span><br />
              healthline.com<br />
              <span style={{ color: C.mute }}>// add a price after the domain to compare</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {["forbes.com", "betimate.com", "oneangrygamer.net", "techcrunch.com", "healthline.com"].map(d => (
              <button key={d} style={{
                padding: "6px 11px", border: "1px solid " + C.ink,
                background: "transparent", fontFamily: "var(--lp-mono)",
                fontSize: 11.5, fontWeight: 700, color: C.ink, cursor: "pointer",
              }}>+ {d}</button>
            ))}
          </div>
        </div>

        <aside>
          <div style={{ borderTop: "2px solid " + C.ink, paddingTop: 14 }}>
            <div style={lbl4}>02 · NICHE</div>
            <div style={{ ...select4, fontSize: 18 }}>
              <span>General</span>
              <Icon name="chevronDown" size={16} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid " + C.line, paddingTop: 14, marginTop: 18 }}>
            <div style={lbl4}>03 · CURRENCY</div>
            <div style={{ display: "flex", border: "2px solid " + C.ink }}>
              {["USD $", "EUR €", "GBP £", "PLN zł"].map((c, i) => (
                <button key={c} style={{
                  flex: 1, padding: "12px 0", background: i === 0 ? C.ink : "transparent",
                  color: i === 0 ? "#fff" : C.ink, border: "none",
                  fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: 0.2,
                  borderRight: i < 3 ? "2px solid " + C.ink : "none",
                }}>{c}</button>
              ))}
            </div>
          </div>
          <button style={{
            display: "block", width: "100%", marginTop: 18,
            padding: "20px", background: C.accent, color: "#fff",
            border: "2px solid " + C.ink, fontFamily: "var(--lp-display)",
            fontWeight: 900, fontSize: 22, letterSpacing: -0.4,
            cursor: "pointer", textTransform: "uppercase",
            boxShadow: "8px 8px 0 " + C.ink,
          }}>
            Analyze →
          </button>
          <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, marginTop: 22, lineHeight: 1.6 }}>
            ⏱ Avg. 2.4s &nbsp;·&nbsp; 🛡 15% managed-buy fee &nbsp;·&nbsp; First 5 scans free
          </div>
        </aside>
      </div>
    </section>
  );

  // ============== Domain row ==============
  const DomainRow = ({ d, expanded = false }) => {
    if (d.notFound) return (
      <article style={{
        padding: "20px 0", borderTop: "1px solid " + C.line, color: C.mute,
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{
          fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, color: C.warn,
          padding: "3px 8px", border: "1px solid " + C.warn, letterSpacing: 0.4,
        }}>NOT FOUND</span>
        <span style={{ fontFamily: "var(--lp-mono)", fontSize: 14, color: C.ink2, fontWeight: 700 }}>{d.domain}</span>
        <span style={{ fontSize: 13 }}>— not in our database. Try a closer variant.</span>
      </article>
    );

    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    const top = offers[0];

    return (
      <article style={{
        borderTop: "1px solid " + C.line, padding: "28px 0",
        background: expanded ? "#fbf9f3" : "transparent",
        margin: expanded ? "0 -32px" : "0",
        paddingLeft: expanded ? 32 : 0, paddingRight: expanded ? 32 : 0,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 360px", gap: 32, alignItems: "start" }}>
          <div style={{
            fontFamily: "var(--lp-display)", fontSize: 38, fontWeight: 900,
            color: C.mute, letterSpacing: -1.5, lineHeight: 1, marginTop: 4,
          }}>
            {String(data.domains.indexOf(d) + 1).padStart(2, "0")}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <GradeBlock grade={d.grade} score={d.score} />
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, color: C.ink2 }}>
                {flag(d.country)} {d.country}
              </span>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute }}>·</span>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, textTransform: "uppercase", letterSpacing: 0.3 }}>
                {d.category}
              </span>
            </div>
            <h2 style={{
              margin: 0, fontFamily: "var(--lp-display)", fontWeight: 900,
              fontSize: 44, letterSpacing: -1.5, lineHeight: 1, color: C.ink,
            }}>
              {d.domain}
            </h2>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 28,
              marginTop: 16, fontFamily: "var(--lp-mono)",
            }}>
              {[
                { l: "DR", v: d.dr ?? "—" },
                { l: "TRAFFIC", v: fmt.num(d.traffic) },
                { l: "KEYWORDS", v: fmt.num(d.keywords) },
                { l: "REF.DOM", v: fmt.num(d.refDomains) },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 10, color: C.mute, fontWeight: 700, letterSpacing: 0.5 }}>{s.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: -0.5, marginTop: 2 }}>{s.v}</div>
                </div>
              ))}
            </div>
            {/* marketplace ranking strip */}
            {offers.length > 0 && (
              <div style={{
                marginTop: 18, display: "flex", alignItems: "center", gap: 0,
                background: C.paper, border: "2px solid " + C.ink,
              }}>
                {offers.slice(0, 4).map((o, i) => (
                  <div key={i} style={{
                    flex: 1, padding: "10px 14px", borderRight: i < 3 && i < offers.length - 1 ? "1px solid " + C.line : "none",
                    background: i === 0 ? C.ink : "transparent", color: i === 0 ? "#fff" : C.ink2,
                  }}>
                    <div style={{ fontFamily: "var(--lp-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, opacity: 0.7 }}>
                      #{i+1} {i === 0 && "★ BEST"}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: -0.2, marginTop: 2 }}>{o.name.replace(/^Vendor: /, "")}</div>
                    <div style={{ fontFamily: "var(--lp-mono)", fontSize: 13, marginTop: 4, fontWeight: 700 }}>
                      ${fmt.withFee(o.minPrice)}
                    </div>
                  </div>
                ))}
                {offers.length > 4 && (
                  <div style={{ padding: "10px 14px", fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, fontWeight: 700 }}>
                    +{offers.length - 4}<br />more
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, color: C.mute, letterSpacing: 0.4 }}>
              BEST PRICE · WITH FEE
            </div>
            <div style={{
              fontFamily: "var(--lp-display)", fontSize: 64, fontWeight: 900,
              letterSpacing: -3, lineHeight: 1, color: C.ink, marginTop: 4,
            }}>
              {d.bestPrice != null ? <><span style={{ color: C.accent }}>$</span>{fmt.withFee(d.bestPrice).toLocaleString()}</> : "—"}
            </div>
            {d.yourPrice != null && d.bestPrice != null && (
              <div style={{
                fontFamily: "var(--lp-mono)", fontSize: 12, fontWeight: 700, marginTop: 6,
                color: fmt.withFee(d.bestPrice) <= d.yourPrice ? C.good : C.bad,
              }}>
                {fmt.withFee(d.bestPrice) <= d.yourPrice
                  ? `↓ ${Math.round((1 - fmt.withFee(d.bestPrice) / d.yourPrice) * 100)}% UNDER YOUR $${d.yourPrice}`
                  : `↑ ${Math.round((fmt.withFee(d.bestPrice) / d.yourPrice - 1) * 100)}% OVER YOUR $${d.yourPrice}`}
              </div>
            )}
            {d.bestPrice != null ? (
              <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                <button style={btn4("ghost")}>♡</button>
                <button style={btn4("primary")}>Buy managed →</button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <button style={btn4("disabled")} disabled>{d.noPrice ? "No pricing" : "No offers"}</button>
              </div>
            )}
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 12, background: "none", border: "none",
              fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 11.5,
              color: C.ink, cursor: "pointer", letterSpacing: 0.4,
              borderBottom: "2px solid " + C.ink, padding: 0,
            }}>
              {expanded ? "HIDE OFFERS" : `COMPARE ${offers.length} OFFERS`}
            </button>
          </div>
        </div>

        {expanded && offers.length > 0 && (
          <ExpandedPanel d={d} />
        )}
      </article>
    );
  };

  // ============== Expanded ==============
  const ExpandedPanel = ({ d }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    return (
      <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid " + C.line }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{
              fontFamily: "var(--lp-display)", fontWeight: 900, fontSize: 22,
              letterSpacing: -0.6, color: C.ink,
            }}>The marketplaces</span>
            <span style={{ fontFamily: "var(--lp-mono)", fontSize: 12, color: C.mute, letterSpacing: 0.3 }}>
              {offers.length} STOCK THIS DOMAIN · SORTED BY PRICE
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={ghostSm()}>Niche: General</button>
            <button style={ghostSm()}>Show all ({offers.length})</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {offers.slice(0, 3).map((o, i) => <MarketplaceCard4 key={i} o={o} rank={i + 1} yourPrice={d.yourPrice} />)}
        </div>
      </div>
    );
  };

  const MarketplaceCard4 = ({ o, rank, yourPrice }) => {
    const ourPrice = fmt.withFee(o.minPrice);
    const linkGood = o.link === "Dofollow";
    const cmp = (() => {
      if (!yourPrice) return null;
      const diff = ((ourPrice - yourPrice) / yourPrice) * 100;
      const r = Math.round(Math.abs(diff));
      if (r < 1) return { c: C.mute, label: "= same price" };
      if (diff < 0) return { c: C.good, label: `↓ ${r}% cheaper` };
      return { c: C.bad, label: `↑ ${r}% more` };
    })();

    return (
      <div style={{
        border: "2px solid " + C.ink, padding: 0, background: C.paper,
        boxShadow: rank === 1 ? "8px 8px 0 " + C.accent : "none",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", background: rank === 1 ? C.ink : "transparent",
          color: rank === 1 ? "#fff" : C.ink, borderBottom: "2px solid " + C.ink,
        }}>
          <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 11, letterSpacing: 0.4 }}>
            #{String(rank).padStart(2, "0")} {rank === 1 && "· ★ BEST"}
          </span>
          <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, opacity: 0.7 }}>
            {o.type === "API" ? "LIVE API" : o.type === "DB" ? "SYNCED" : "VENDOR"}
          </span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{
            fontFamily: "var(--lp-display)", fontWeight: 800,
            fontSize: 22, letterSpacing: -0.4, color: C.ink,
          }}>{o.name}</div>
          <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, marginTop: 2 }}>
            UPD {o.updated} · {"★".repeat(o.quality)}{"·".repeat(5 - o.quality)}
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: yourPrice ? "1fr 1fr 1fr" : "1fr 1fr",
            marginTop: 14, border: "1px solid " + C.line,
          }}>
            <div style={priceCell4}>
              <div style={priceLbl4}>Marketplace</div>
              <div style={priceVal4}>{fmt.range(o.minPrice, o.maxPrice)}</div>
            </div>
            <div style={{ ...priceCell4, background: C.ink, color: "#fff" }}>
              <div style={{ ...priceLbl4, color: "#bbb" }}>Our price</div>
              <div style={priceVal4}>${ourPrice}</div>
            </div>
            {yourPrice && (
              <div style={priceCell4}>
                <div style={priceLbl4}>You quoted</div>
                <div style={priceVal4}>${yourPrice}</div>
                {cmp && <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: cmp.c, fontWeight: 700, marginTop: 2 }}>{cmp.label}</div>}
              </div>
            )}
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            marginTop: 14, fontFamily: "var(--lp-mono)", fontSize: 11.5,
          }}>
            <div style={editKv}>
              <span style={editKvL}>Delivery</span>
              <span style={editKvV}>{o.delivery} days</span>
            </div>
            <div style={editKv}>
              <span style={editKvL}>Avg. TAT</span>
              <span style={editKvV}>{o.tat} days</span>
            </div>
            <div style={editKv}>
              <span style={editKvL}>Link</span>
              <span style={{
                ...editKvV,
                color: linkGood ? C.good : C.warn,
                fontWeight: 800,
              }}>{linkGood ? "✓ DOFOLLOW" : "✗ NOFOLLOW"}</span>
            </div>
            <div style={editKv}>
              <span style={editKvL}>Source</span>
              <span style={editKvV}>{o.type}</span>
            </div>
          </div>

          {o.example ? (
            <a href="#" onClick={e => e.preventDefault()} style={{
              display: "flex", alignItems: "center", gap: 10,
              marginTop: 14, padding: "10px 12px",
              border: "2px solid " + C.ink, textDecoration: "none", color: C.ink,
              background: C.bg,
            }}>
              <span style={{ fontFamily: "var(--lp-display)", fontWeight: 900, fontSize: 18 }}>↗</span>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11.5, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 700 }}>
                {o.example.replace(/^https?:\/\//, "")}
              </span>
            </a>
          ) : (
            <div style={{
              marginTop: 14, padding: "10px 12px", border: "2px dashed " + C.line,
              color: C.mute, fontFamily: "var(--lp-mono)", fontSize: 11, textAlign: "center",
            }}>NO PUBLISHED EXAMPLE</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <button style={btn4("primary")}>Buy managed</button>
            <button style={btn4("ghost")}>Buy direct ↗</button>
          </div>
        </div>
      </div>
    );
  };

  const App = () => (
    <div className="lp-reset" style={{
      width: 1440, minHeight: 1100, background: C.bg, padding: "0 32px 60px",
      fontFamily: "var(--lp-display)",
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 0", borderBottom: "2px solid " + C.ink,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--lp-display)", fontWeight: 900, fontSize: 20, letterSpacing: -0.4 }}>LINKPRICER</span>
          <span style={{ fontFamily: "var(--lp-mono)", fontSize: 11, color: C.mute, marginLeft: 18 }}>/ APP / DOMAIN ANALYSIS</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {["Analyze", "Lists", "Orders", "Vendors"].map((l, i) => (
            <a key={l} href="#" style={{
              padding: "10px 16px", fontFamily: "var(--lp-mono)", fontSize: 12, fontWeight: 700,
              color: i === 0 ? "#fff" : C.ink, background: i === 0 ? C.ink : "transparent",
              textDecoration: "none", letterSpacing: 0.4,
            }}>{l.toUpperCase()}</a>
          ))}
        </nav>
      </header>

      <Hero />

      <section>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6,
        }}>
          <h2 style={{
            margin: 0, fontFamily: "var(--lp-display)", fontWeight: 900,
            fontSize: 56, letterSpacing: -2, color: C.ink, lineHeight: 1,
          }}>Results.</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={ghostSm()}>Sort: Best value</button>
            <button style={ghostSm()}><Icon name="filter" size={11} /> Filter</button>
            <button style={ghostSm()}><Icon name="download" size={11} /> CSV</button>
          </div>
        </div>
        <div style={{ fontFamily: "var(--lp-mono)", fontSize: 12, color: C.mute, marginBottom: 12, letterSpacing: 0.3 }}>
          5 DOMAINS · 12 OFFERS · AVG SAVINGS <span style={{ color: C.good, fontWeight: 700 }}>28%</span>
        </div>

        {data.domains.slice(0, 7).map((d, i) => (
          <DomainRow key={d.domain} d={d} expanded={i === 0} />
        ))}
      </section>
    </div>
  );

  return { App };
})();

const lbl4 = { fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10, color: "#0c0c0e" };
const select4 = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 16px", border: "2px solid #0c0c0e", background: "#fff",
  fontFamily: "var(--lp-display)", fontWeight: 800, color: "#0c0c0e",
};
function btn4(kind) {
  const k = {
    primary: { bg: "#0c0c0e", fg: "#fff", border: "2px solid #0c0c0e" },
    ghost: { bg: "#fff", fg: "#0c0c0e", border: "2px solid #0c0c0e" },
    disabled: { bg: "#e7e3da", fg: "#a3a09a", border: "2px solid #dcd8cf", cursor: "not-allowed" },
  }[kind];
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 14px", fontFamily: "var(--lp-display)",
    fontWeight: 800, fontSize: 13, letterSpacing: -0.1,
    background: k.bg, color: k.fg, border: k.border,
    cursor: k.cursor || "pointer",
  };
}
function ghostSm() {
  return {
    padding: "6px 10px", fontFamily: "var(--lp-mono)", fontSize: 11,
    fontWeight: 700, color: "#0c0c0e", background: "#fff",
    border: "1.5px solid #0c0c0e", cursor: "pointer", letterSpacing: 0.3,
    display: "inline-flex", alignItems: "center", gap: 5,
  };
}
const priceCell4 = { padding: "8px 12px", borderRight: "1px solid #dcd8cf" };
const priceLbl4 = { fontFamily: "var(--lp-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, color: "#6b6b72", textTransform: "uppercase" };
const priceVal4 = { fontFamily: "var(--lp-display)", fontWeight: 900, fontSize: 22, letterSpacing: -0.6, marginTop: 2 };
const editKv = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px dashed #dcd8cf" };
const editKvL = { color: "#6b6b72", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", fontSize: 9.5 };
const editKvV = { color: "#0c0c0e", fontWeight: 800 };

window.V4 = V4;
