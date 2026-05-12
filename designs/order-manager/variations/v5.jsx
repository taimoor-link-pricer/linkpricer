// Variation 5 — Hybrid table-card rows
// Each "row" is a single horizontal card that's table-aligned but card-rich:
// has the row stats AND a built-in mini marketplace strip + persistent "Compare" mini-panel.
// Color: cool slate with a teal accent.

const V5 = (() => {
  const { Icon, fmt, flag, Stars, MicroBar } = LP;
  const data = LP_DATA;

  const C = {
    bg: "#f4f6fa",
    surface: "#ffffff",
    surface2: "#f7f9fc",
    line: "#e3e7ee",
    line2: "#edf0f5",
    ink: "#0f1620",
    ink2: "#1f2937",
    mute: "#6b7484",
    mute2: "#9aa3b3",
    accent: "#0fa48a",
    accentSoft: "#dcf3ee",
    accentDark: "#0a7d6a",
    good: "#0a8a4a",
    warn: "#b76e00",
    bad: "#c1300d",
  };

  // ============== Hero — compact horizontal ==============
  const Hero = () => (
    <section style={{
      background: C.surface, borderRadius: 18,
      border: "1px solid " + C.line, marginBottom: 18,
      padding: 24, display: "grid", gridTemplateColumns: "1fr 280px", gap: 18,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: -0.3 }}>
            Domain analysis
          </h1>
          <span style={{ fontSize: 13, color: C.mute }}>· compare prices across every marketplace</span>
        </div>

        <div style={{
          background: C.surface2, border: "1px solid " + C.line, borderRadius: 12,
          padding: 0, marginTop: 8, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 14px", background: "#fff", borderBottom: "1px solid " + C.line,
          }}>
            <span style={{ fontSize: 11.5, color: C.mute, fontWeight: 600 }}>
              Paste up to 200 domains. Append a price to compare.
            </span>
            <span style={{ display: "inline-flex", gap: 6 }}>
              <span style={pillSm(C.accentSoft, C.accentDark)}>5 / 200</span>
              <span style={pillSm(C.line2, C.ink2)}>1 priced</span>
            </span>
          </div>
          <textarea
            spellCheck={false}
            defaultValue={`forbes.com
betimate.com
oneangrygamer.net
techcrunch.com 1100
healthline.com`}
            style={{
              width: "100%", minHeight: 124, padding: 14, border: "none", outline: "none",
              resize: "vertical", fontFamily: "var(--lp-mono)", fontSize: 13.5,
              color: C.ink2, background: "transparent", lineHeight: 1.6,
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: C.mute, fontWeight: 600, marginRight: 4 }}>Quick start:</span>
          {["forbes.com", "betimate.com", "oneangrygamer.net", "techcrunch.com"].map(d => (
            <button key={d} style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid " + C.line,
              background: "#fff", fontFamily: "var(--lp-mono)", fontSize: 11.5,
              color: C.ink2, cursor: "pointer",
            }}>{d}</button>
          ))}
        </div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", gap: 12,
        padding: 14, background: C.surface2, borderRadius: 12, border: "1px solid " + C.line,
      }}>
        <div>
          <div style={lbl5}>Niche / pricing</div>
          <div style={select5}>General <Icon name="chevronDown" size={13} color={C.mute} /></div>
        </div>
        <div>
          <div style={lbl5}>Currency</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["USD", "EUR", "GBP"].map((c, i) => (
              <button key={c} style={{
                flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: "1px solid " + (i === 0 ? C.accent : C.line),
                background: i === 0 ? C.accentSoft : "#fff",
                color: i === 0 ? C.accentDark : C.ink2,
              }}>{c}</button>
            ))}
          </div>
        </div>
        <button style={{
          padding: "12px", background: C.accent, color: "#fff", border: "none",
          borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 1px 0 " + C.accentDark,
        }}>
          <Icon name="bolt" size={14} /> Analyze 5 domains
        </button>
      </div>
    </section>
  );

  // ============== Hybrid row ==============
  const HybridRow = ({ d, expanded = false, fav = false }) => {
    if (d.notFound) return (
      <div style={{
        background: C.surface, border: "1px dashed " + C.line, borderRadius: 14,
        padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
        color: C.mute,
      }}>
        <span style={pillSm(C.line2, C.mute, true)}>NOT FOUND</span>
        <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 600, color: C.ink2, fontSize: 13.5 }}>{d.domain}</span>
        <span style={{ fontSize: 12.5 }}>not in our database — try a closer variant.</span>
      </div>
    );

    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    const best = offers[0];
    const linkBest = best?.link === "Dofollow";

    // value bar — width by score
    const score = d.score || 0;
    let valueColor = C.mute;
    if (d.grade?.startsWith("A")) valueColor = C.good;
    else if (d.grade === "B+" || d.grade === "B") valueColor = "#1f6feb";
    else if (d.grade === "B-") valueColor = C.warn;

    return (
      <div style={{
        background: C.surface, borderRadius: 14, border: "1px solid " + (expanded ? C.accent : C.line),
        boxShadow: expanded ? "0 0 0 3px " + C.accentSoft : "0 1px 0 rgba(15,22,32,0.02)",
        overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "auto 260px 1fr 200px 180px",
          gap: 18, alignItems: "center",
          padding: "16px 18px",
        }}>
          {/* expand */}
          <button style={chev5(expanded)} aria-label="Toggle">
            <Icon name="chevron" size={13} color={expanded ? "#fff" : C.mute} />
          </button>

          {/* domain + meta */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 14.5, color: C.ink, letterSpacing: -0.1 }}>
                {d.domain}
              </span>
              <span style={pillSm(C.line2, C.ink2)}>
                {flag(d.country)} {d.country}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.mute, fontWeight: 600 }}>
              {d.category} · {d.lang}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Value</span>
              <span style={{ fontWeight: 800, fontSize: 13, color: valueColor }}>{d.grade}</span>
              <span style={{
                flex: 1, height: 6, background: C.line2, borderRadius: 3,
                overflow: "hidden", maxWidth: 80,
              }}>
                <div style={{ width: `${score}%`, height: "100%", background: valueColor, borderRadius: 3 }} />
              </span>
              <span style={{ fontFamily: "var(--lp-mono)", fontSize: 10.5, color: C.mute, fontVariantNumeric: "tabular-nums" }}>{score}/100</span>
            </div>
          </div>

          {/* stats inline */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontFamily: "var(--lp-mono)" }}>
            {[
              { l: "DR", v: d.dr ?? "—", t: d.drTrend },
              { l: "Traffic", v: fmt.num(d.traffic) },
              { l: "Keywords", v: fmt.num(d.keywords) },
              { l: "Ref. dom", v: fmt.num(d.refDomains) },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 9.5, color: C.mute, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{s.l}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {s.v}
                  {s.t === "up" && <span style={{ color: C.good, fontSize: 10, marginLeft: 4 }}>↑</span>}
                  {s.t === "down" && <span style={{ color: C.bad, fontSize: 10, marginLeft: 4 }}>↓</span>}
                </div>
              </div>
            ))}
          </div>

          {/* marketplace mini-strip */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 9.5, color: C.mute, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
              {offers.length} marketplaces
            </div>
            <div style={{
              display: "flex", gap: 2, height: 22, borderRadius: 5, overflow: "hidden",
              background: C.line2,
            }}>
              {offers.length > 0 ? offers.map((o, i) => {
                const span = (offers[offers.length - 1].minPrice - offers[0].minPrice) || 1;
                const pos = (o.minPrice - offers[0].minPrice) / span;
                return (
                  <div key={i} style={{
                    flex: i === 0 ? 1.2 : 1, background: i === 0 ? C.accent : `rgba(15,164,138,${0.55 - pos * 0.4})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "var(--lp-mono)",
                  }}>${fmt.withFee(o.minPrice)}</div>
                );
              }) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: C.mute, fontWeight: 600 }}>
                  no offers
                </div>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: C.mute, display: "flex", justifyContent: "space-between", fontFamily: "var(--lp-mono)" }}>
              <span>cheapest</span>
              <span>most expensive</span>
            </div>
          </div>

          {/* price + buy */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9.5, color: C.mute, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Best · with fee</div>
            <div style={{
              fontFamily: "var(--lp-mono)", fontSize: 26, fontWeight: 800,
              color: C.ink, letterSpacing: -0.5, lineHeight: 1.1, marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}>
              {d.bestPrice != null ? "$" + fmt.withFee(d.bestPrice).toLocaleString() : "—"}
            </div>
            {d.yourPrice != null && d.bestPrice != null && (() => {
              const ourPrice = fmt.withFee(d.bestPrice);
              const diff = ((ourPrice - d.yourPrice) / d.yourPrice) * 100;
              const r = Math.round(Math.abs(diff));
              const c = diff < -0.5 ? C.good : diff > 0.5 ? C.bad : C.mute;
              return (
                <div style={{ fontSize: 11, fontWeight: 700, color: c, marginTop: 2 }}>
                  {diff < 0 ? "↓" : diff > 0 ? "↑" : "="} {r}% {diff < 0 ? "under" : diff > 0 ? "over" : ""} your ${d.yourPrice}
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
              <button style={iconBtn5(fav)} aria-label="Favourite">
                <Icon name={fav ? "heartFill" : "heart"} size={13} color={fav ? "#e11d48" : C.ink2} />
              </button>
              {d.bestPrice != null ? (
                <button style={btn5("primary", "sm")}>
                  <Icon name="shield" size={12} /> Buy managed
                </button>
              ) : d.noPrice ? (
                <button style={btn5("disabled", "sm")} disabled>No pricing</button>
              ) : (
                <button style={btn5("disabled", "sm")} disabled>No offers</button>
              )}
            </div>
          </div>
        </div>

        {expanded && <ExpandedPanel d={d} />}
      </div>
    );
  };

  // ============== Expanded ==============
  const ExpandedPanel = ({ d }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    return (
      <div style={{ background: C.surface2, padding: "18px 22px", borderTop: "1px solid " + C.line }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>Top 3 best prices</span>
            <span style={{ fontSize: 12, color: C.mute }}>· {offers.length} marketplaces stock {d.domain}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={pillSm(C.line2, C.ink2)}>Niche: General</span>
            <button style={btn5("ghost", "sm")}>Show all ({offers.length})</button>
            <button style={btn5("ghost", "sm")}><Icon name="filter" size={11} /> Filter</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {offers.slice(0, 3).map((o, i) => <MarketplaceCard5 key={i} o={o} isBest={i === 0} yourPrice={d.yourPrice} />)}
        </div>
      </div>
    );
  };

  const MarketplaceCard5 = ({ o, isBest, yourPrice }) => {
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
        background: "#fff", borderRadius: 12,
        border: "1px solid " + (isBest ? C.accent : C.line),
        boxShadow: isBest ? "0 0 0 2px " + C.accentSoft : "none",
        padding: 14, position: "relative", display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: o.type === "Vendor" ? "#fdf2dd" : o.type === "API" ? C.accentSoft : C.line2,
            color: o.type === "Vendor" ? "#a35d00" : o.type === "API" ? C.accentDark : C.ink2,
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11,
          }}>{o.name.replace(/^Vendor: /, "").slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
              {o.name}
              {isBest && <span style={pillSm(C.accent, "#fff", true)}>★ BEST</span>}
            </div>
            <div style={{ fontSize: 10.5, color: C.mute }}>Updated {o.updated.split(" ")[0]}</div>
          </div>
          <Stars n={o.quality} size={11} />
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: yourPrice ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: 1, background: C.line2, border: "1px solid " + C.line2, borderRadius: 8, overflow: "hidden",
        }}>
          <div style={priceBox5}>
            <div style={priceLbl5}>Marketplace <Icon name="info" size={10} color={C.mute2} /></div>
            <div style={priceVal5}>{fmt.range(o.minPrice, o.maxPrice)}</div>
          </div>
          <div style={{ ...priceBox5, background: C.accentSoft }}>
            <div style={priceLbl5}>Our price <Icon name="info" size={10} color={C.mute2} /></div>
            <div style={{ ...priceVal5, color: C.accentDark }}>${ourPrice}</div>
          </div>
          {yourPrice && (
            <div style={priceBox5}>
              <div style={priceLbl5}>You quoted</div>
              <div style={priceVal5}>${yourPrice}</div>
              {cmp && <div style={{ fontSize: 10.5, color: cmp.c, fontWeight: 700, marginTop: 2 }}>{cmp.label}</div>}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
          <div style={kvRow5}><span style={kvL5}>Delivery</span><span style={kvV5}>{o.delivery} days</span></div>
          <div style={kvRow5}><span style={kvL5}>Avg. TAT</span><span style={kvV5}>{o.tat} days</span></div>
          <div style={kvRow5}><span style={kvL5}>Link</span>
            <span style={pillSm(linkGood ? C.accentSoft : "#fdf2dd", linkGood ? C.accentDark : "#a35d00", true)}>
              {linkGood ? "✓ Dofollow" : "✗ Nofollow"}
            </span>
          </div>
          <div style={kvRow5}><span style={kvL5}>Source</span>
            <span style={pillSm(C.line2, C.ink2, true)}>{o.type === "API" ? "Live API" : o.type === "DB" ? "Synced" : "Vendor"}</span>
          </div>
        </div>

        {o.example ? (
          <a href="#" onClick={e => e.preventDefault()} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 10px", borderRadius: 8, background: C.surface2,
            textDecoration: "none", color: C.ink2, border: "1px solid " + C.line2,
          }}>
            <div className="lp-imgph" style={{ width: 28, height: 22, borderRadius: 4 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, color: C.mute, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Published example</div>
              <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.example.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <Icon name="external" size={13} color={C.accentDark} />
          </a>
        ) : (
          <div style={{
            padding: "8px 10px", borderRadius: 8, background: C.surface2,
            border: "1px dashed " + C.line, fontSize: 11, color: C.mute, textAlign: "center",
          }}>No published example</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button style={btn5("primary", "sm")}><Icon name="shield" size={11} /> Buy managed</button>
          <button style={btn5("ghost", "sm")}>Buy direct <Icon name="external" size={10} /></button>
        </div>
      </div>
    );
  };

  // ============== Main ==============
  const App = () => (
    <div className="lp-reset" style={{
      width: 1440, minHeight: 1100, background: C.bg, padding: "16px 28px 40px",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.2, color: C.ink }}>Linkpricer</span>
          <span style={{ marginLeft: 14, color: C.mute, fontSize: 12 }}>/ app / domain analysis</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["Analyze", "Lists", "Orders", "Vendors"].map((l, i) => (
            <a key={l} href="#" style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: i === 0 ? C.accentDark : C.mute,
              background: i === 0 ? C.accentSoft : "transparent",
              textDecoration: "none",
            }}>{l}</a>
          ))}
        </nav>
      </header>

      <Hero />

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink }}>5 domains analyzed</h2>
            <div style={{ fontSize: 12, color: C.mute, marginTop: 3 }}>
              12 offers · avg savings vs. retail <strong style={{ color: C.good }}>28%</strong> · sorted by best value
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btn5("ghost", "sm")}>Sort: Value ↓</button>
            <button style={btn5("ghost", "sm")}><Icon name="filter" size={11} /> Filter</button>
            <button style={btn5("ghost", "sm")}><Icon name="download" size={11} /> CSV</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.domains.slice(0, 7).map((d, i) => (
            <HybridRow key={d.domain} d={d} expanded={i === 0} fav={i === 1} />
          ))}
        </div>
      </section>
    </div>
  );

  return { App };
})();

const lbl5 = { fontSize: 10, color: "#6b7484", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 };
const select5 = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "8px 12px", background: "#fff", border: "1px solid #e3e7ee",
  borderRadius: 8, fontWeight: 600, fontSize: 12.5, color: "#0f1620",
};
function btn5(kind, size = "md") {
  const s = size === "sm"
    ? { padding: "6px 10px", fontSize: 12, height: 30 }
    : { padding: "10px 14px", fontSize: 13.5, height: 38 };
  const k = {
    primary: { bg: "#0fa48a", fg: "#fff", border: "1px solid #0fa48a" },
    ghost: { bg: "#fff", fg: "#1f2937", border: "1px solid #e3e7ee" },
    disabled: { bg: "#edf0f5", fg: "#9aa3b3", border: "1px solid #e3e7ee", cursor: "not-allowed" },
  }[kind];
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: s.padding, fontSize: s.fontSize, height: s.height, fontWeight: 700,
    background: k.bg, color: k.fg, border: k.border, borderRadius: 7,
    whiteSpace: "nowrap", cursor: k.cursor || "pointer",
  };
}
function chev5(open) {
  return {
    width: 26, height: 26, borderRadius: 7,
    border: "1px solid " + (open ? "#0fa48a" : "#e3e7ee"),
    background: open ? "#0fa48a" : "#fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", transform: open ? "rotate(90deg)" : "none",
    transition: "transform .15s",
  };
}
function iconBtn5(active) {
  return {
    width: 32, height: 30, borderRadius: 7,
    background: active ? "#fdecea" : "#fff",
    border: "1px solid #e3e7ee",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  };
}
function pillSm(bg, fg, bold = false) {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 999, background: bg, color: fg,
    fontSize: 10, fontWeight: 700, letterSpacing: bold ? 0.3 : 0,
  };
}
const priceBox5 = { padding: "8px 10px", background: "#fff", display: "flex", flexDirection: "column", gap: 1 };
const priceLbl5 = { fontSize: 9.5, color: "#6b7484", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 3 };
const priceVal5 = { fontSize: 16, fontWeight: 800, color: "#0f1620", fontFamily: "var(--lp-mono)", fontVariantNumeric: "tabular-nums" };
const kvRow5 = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #edf0f5" };
const kvL5 = { fontSize: 10.5, color: "#6b7484", fontWeight: 600 };
const kvV5 = { fontSize: 12, fontWeight: 700, color: "#1f2937", fontVariantNumeric: "tabular-nums" };

window.V5 = V5;
