// Variation 2 — Trading Terminal
// Dense data grid, sharp corners, tabular-nums everywhere, monospace identifiers.
// Single-pixel borders, color-coded deltas (green/red), inline expand below row.

const V2 = (() => {
  const { Icon, fmt, flag } = LP;
  const data = LP_DATA;

  // V2 palette overrides — slate grid + electric green accent
  const T = {
    bg: "#0e1014",
    grid: "#1c2026",
    panel: "#15181d",
    panel2: "#11141a",
    line: "#1f2329",
    line2: "#262b33",
    ink: "#e5e7eb",
    ink2: "#cbd0d8",
    mute: "#7d8694",
    mute2: "#586071",
    accent: "#22d27a",
    accent2: "#0ea5e9",
    bad: "#f0533d",
    warn: "#f5b74a",
  };

  // Background must wrap whole variation
  const Wrapper = ({ children }) => (
    <div className="lp-reset" style={{
      width: 1440, minHeight: 1100, background: T.bg, color: T.ink,
      fontFamily: "var(--lp-mono)", padding: 0, fontSize: 12.5,
    }}>{children}</div>
  );

  const TopBar = () => (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 24px", borderBottom: "1px solid " + T.line, background: T.panel2,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ color: T.accent, fontWeight: 700, letterSpacing: 0.5 }}>◆ LINKPRICER</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{ color: T.mute }}>TERMINAL / DOMAIN-SCAN</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{ color: T.mute, fontSize: 11 }}>UPDATED 14:32:08 UTC</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11.5 }}>
        <span style={{ color: T.mute }}>FX</span>
        <span style={{ color: T.ink }}>USD</span>
        <span style={{ color: T.mute }}>·</span>
        <span style={{ color: T.mute }}>MKT</span>
        <span style={{ color: T.accent }}>● LIVE</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{ color: T.ink }}>SEO@AGENCY</span>
      </div>
    </header>
  );

  // Status strip — small KPI bar above the grid
  const StatusStrip = ({ found = 6, mkts = 12, best = 184, savings = 28 }) => (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
      borderBottom: "1px solid " + T.line, background: T.panel2,
    }}>
      {[
        { l: "DOMAINS", v: `${found}/200`, c: T.ink },
        { l: "FOUND", v: `${found - 1}`, c: T.accent },
        { l: "NOT FOUND", v: "1", c: T.warn },
        { l: "MARKETPLACES", v: String(mkts), c: T.ink },
        { l: "BEST PRICE", v: "$" + best, c: T.accent },
        { l: "AVG SAVINGS", v: savings + "%", c: T.accent },
      ].map((k, i) => (
        <div key={i} style={{ padding: "10px 16px", borderRight: i < 5 ? "1px solid " + T.line : "none" }}>
          <div style={{ fontSize: 10, color: T.mute, letterSpacing: 0.4 }}>{k.l}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: k.c, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{k.v}</div>
        </div>
      ))}
    </div>
  );

  // ============== Hero ==============
  const Hero = () => (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 360px", borderBottom: "1px solid " + T.line }}>
      <div style={{ padding: "20px 24px", borderRight: "1px solid " + T.line }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, background: T.accent, display: "inline-block" }} />
          <span style={{ color: T.mute, fontSize: 11, letterSpacing: 0.4 }}>// QUERY INPUT</span>
        </div>
        <div style={{
          background: T.panel, border: "1px solid " + T.line2,
          padding: 12, fontSize: 13, lineHeight: 1.7,
          minHeight: 168, color: T.ink,
        }}>
{`forbes.com
betimate.com
oneangrygamer.net
techcrunch.com 1100
healthline.com
pitchfork.com
obscure-blog-2017.example`.split("\n").map((line, i) => (
  <div key={i} style={{ display: "flex", gap: 12 }}>
    <span style={{ color: T.mute2, width: 22, textAlign: "right" }}>{String(i+1).padStart(2, "0")}</span>
    <span>{line}</span>
  </div>
))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 12, color: T.mute, fontSize: 11 }}>
          <span>DOMAINS <span style={{ color: T.accent }}>7</span>/200</span>
          <span>·</span>
          <span>WITH PRICE <span style={{ color: T.accent }}>1</span></span>
          <span>·</span>
          <span>WITHIN LIMIT</span>
        </div>
      </div>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={lblT}>NICHE / PRICING SET</div>
          <div style={selectT}>
            <span>GENERAL</span>
            <Icon name="chevronDown" size={12} color={T.mute} />
          </div>
        </div>
        <div>
          <div style={lblT}>CCY</div>
          <div style={{ display: "flex", border: "1px solid " + T.line2 }}>
            {["USD","EUR","GBP","PLN"].map((c, i) => (
              <button key={c} style={{
                flex: 1, padding: "8px 0", background: i === 0 ? T.accent : "transparent",
                color: i === 0 ? T.bg : T.mute, border: "none",
                fontFamily: "inherit", fontWeight: 700, letterSpacing: 0.3, fontSize: 11.5,
              }}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={lblT}>OUTPUT</div>
          <div style={{ display: "flex", border: "1px solid " + T.line2 }}>
            {["GRID","CHART","CSV"].map((c, i) => (
              <button key={c} style={{
                flex: 1, padding: "8px 0", background: i === 0 ? T.line2 : "transparent",
                color: i === 0 ? T.ink : T.mute, border: "none", borderRight: i < 2 ? "1px solid " + T.line2 : "none",
                fontFamily: "inherit", fontWeight: 600, fontSize: 11.5,
              }}>{c}</button>
            ))}
          </div>
        </div>
        <button style={{
          padding: "14px", background: T.accent, color: T.bg,
          border: "none", fontFamily: "inherit", fontWeight: 800, fontSize: 13,
          letterSpacing: 1.2, cursor: "pointer",
        }}>▶ EXECUTE SCAN</button>
      </div>
    </section>
  );

  // ============== Grid ==============
  const cellHead = {
    padding: "8px 10px", background: T.panel2, color: T.mute,
    fontSize: 10.5, letterSpacing: 0.4, fontWeight: 600,
    borderRight: "1px solid " + T.line, borderBottom: "1px solid " + T.line,
    textAlign: "left", whiteSpace: "nowrap",
  };
  const cell = {
    padding: "10px 10px", borderRight: "1px solid " + T.line,
    borderBottom: "1px solid " + T.line, fontVariantNumeric: "tabular-nums",
    color: T.ink2, whiteSpace: "nowrap", verticalAlign: "middle", fontSize: 12.5,
  };

  const GradeBox = ({ grade, score }) => {
    let c = T.mute;
    if (!grade) c = T.mute;
    else if (grade.startsWith("A")) c = T.accent;
    else if (grade === "B+" || grade === "B") c = T.accent2;
    else if (grade === "B-") c = T.warn;
    else c = T.bad;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "2px 8px", border: "1px solid " + c, color: c,
        fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
      }}>
        {grade || "—"} <span style={{ color: T.mute, fontWeight: 400 }}>{score ?? ""}</span>
      </span>
    );
  };

  const Row = ({ d, expanded = false }) => {
    if (d.notFound) return (
      <tr>
        <td colSpan={10} style={{ ...cell, color: T.mute, background: T.panel2, padding: "10px 14px", fontSize: 11.5 }}>
          <span style={{ color: T.warn }}>! NO DATA</span> &nbsp; {d.domain} &nbsp; <span style={{ color: T.mute2 }}>// not found in database</span>
        </td>
      </tr>
    );
    return (
      <>
        <tr style={{ background: expanded ? T.panel : "transparent" }}>
          <td style={{ ...cell, width: 30, textAlign: "center", color: T.mute }}>
            <span style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .12s" }}>▸</span>
          </td>
          <td style={{ ...cell, color: T.ink, fontWeight: 600 }}>{d.domain}</td>
          <td style={{ ...cell, textAlign: "right" }}>{flag(d.country)} {d.country || "—"}</td>
          <td style={cell}><GradeBox grade={d.grade} score={d.score} /></td>
          <td style={{ ...cell, textAlign: "right", color: d.dr >= 80 ? T.accent : d.dr >= 50 ? T.ink : T.mute }}>{d.dr ?? "—"}</td>
          <td style={{ ...cell, textAlign: "right" }}>{fmt.num(d.traffic)}</td>
          <td style={{ ...cell, textAlign: "right", color: T.mute }}>{fmt.num(d.keywords)}</td>
          <td style={{ ...cell, textAlign: "right", color: T.mute }}>{fmt.num(d.refDomains)}</td>
          <td style={{ ...cell, color: T.mute }}>{(d.category || "—").toUpperCase()}</td>
          <td style={{ ...cell, textAlign: "right", borderRight: "none" }}>
            {d.bestPrice != null ? (
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: T.accent, fontWeight: 700, fontSize: 13.5 }}>${fmt.withFee(d.bestPrice)}</span>
                <button style={miniBtn(T.accent, T.bg)}>BUY ▸</button>
              </span>
            ) : d.noPrice ? (
              <span style={{ color: T.mute }}>NO PRICE</span>
            ) : (
              <span style={{ color: T.mute }}>—</span>
            )}
          </td>
        </tr>
        {expanded && (
          <tr>
            <td colSpan={10} style={{ padding: 0, background: T.panel, borderBottom: "1px solid " + T.line }}>
              <ExpandedPanel d={d} />
            </td>
          </tr>
        )}
      </>
    );
  };

  // ============== Expanded (terminal style) ==============
  const ExpandedPanel = ({ d }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    return (
      <div style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, color: T.mute, fontSize: 11 }}>
          <span style={{ color: T.accent }}>▸</span>
          <span>OFFERS // {d.domain.toUpperCase()}</span>
          <span style={{ color: T.mute2 }}>·</span>
          <span>{offers.length} MARKETPLACES</span>
          <span style={{ color: T.mute2, marginLeft: "auto" }}>SORT BY: PRICE ↑</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["MARKETPLACE", "TYPE", "PRICE", "OUR PRICE", "Δ vs YOU", "QUALITY", "DELIV", "TAT", "LINK", "NICHE", "EXAMPLE", ""].map(h => (
                <th key={h} style={{ ...cellHead, background: T.bg, fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offers.map((o, i) => {
              const ourPrice = fmt.withFee(o.minPrice);
              const cmp = d.yourPrice ? ((ourPrice - d.yourPrice) / d.yourPrice) * 100 : null;
              return (
                <tr key={i} style={{ background: i === 0 ? "rgba(34,210,122,0.06)" : "transparent" }}>
                  <td style={{ ...cell, color: T.ink, fontWeight: 600 }}>
                    {i === 0 && <span style={{ color: T.accent, marginRight: 6 }}>★</span>}
                    {o.name}
                    <div style={{ fontSize: 10, color: T.mute2, fontWeight: 400 }}>UPD {o.updated}</div>
                  </td>
                  <td style={{ ...cell, color: T.mute, fontSize: 10.5 }}>{o.type}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{fmt.range(o.minPrice, o.maxPrice)}</td>
                  <td style={{ ...cell, textAlign: "right", color: T.accent, fontWeight: 700 }}>${ourPrice}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {cmp == null ? <span style={{ color: T.mute }}>—</span> : (
                      <span style={{ color: cmp < 0 ? T.accent : cmp > 0 ? T.bad : T.mute, fontWeight: 700 }}>
                        {cmp > 0 ? "+" : ""}{cmp.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td style={{ ...cell, color: T.warn }}>{"★".repeat(o.quality) + "·".repeat(5 - o.quality)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{o.delivery}d</td>
                  <td style={{ ...cell, textAlign: "right", color: T.mute }}>{o.tat}d</td>
                  <td style={cell}>
                    <span style={{ color: o.link === "Dofollow" ? T.accent : T.warn, fontWeight: 700, fontSize: 11 }}>
                      {o.link === "Dofollow" ? "✓ DO" : "✗ NO"}
                    </span>
                  </td>
                  <td style={{ ...cell, color: T.mute, fontSize: 10.5 }}>
                    {o.gambling ? `GAMB $${o.gambling[0]}` : "—"}
                    {o.crypto ? <><br /><span style={{ color: T.mute2 }}>CRYP ${o.crypto[0]}</span></> : null}
                  </td>
                  <td style={cell}>
                    {o.example ? (
                      <a href="#" onClick={e => e.preventDefault()} style={{ color: T.accent2, textDecoration: "none", fontSize: 11 }}>
                        {o.example.replace(/^https?:\/\//, "").slice(0, 22)}… ↗
                      </a>
                    ) : <span style={{ color: T.mute2 }}>—</span>}
                  </td>
                  <td style={{ ...cell, textAlign: "right", borderRight: "none" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <button style={miniBtn(T.accent, T.bg)}>MGD</button>
                      <button style={miniBtn("transparent", T.ink, T.line2)}>DIR ↗</button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ============== Main grid ==============
  const Grid = ({ count = 6, expandedIndex = 0 }) => (
    <section>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 24px", borderBottom: "1px solid " + T.line, background: T.panel2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11.5 }}>
          <span style={{ color: T.mute }}>// RESULTS</span>
          <span style={{ color: T.ink, fontWeight: 700 }}>{count} ROWS</span>
          <span style={{ color: T.mute2 }}>·</span>
          <span style={{ color: T.accent }}>● LIVE</span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
          <button style={ghostBtnT}><Icon name="filter" size={11} /> FILTER</button>
          <button style={ghostBtnT}><Icon name="sort" size={11} /> SORT</button>
          <button style={ghostBtnT}><Icon name="download" size={11} /> EXPORT CSV</button>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["", "DOMAIN", "CC", "GRADE", "DR", "TRAFFIC", "KEYWORDS", "REF.DOM", "CATEGORY", "PRICE / ACTION"].map((h, i) => (
              <th key={h} style={{ ...cellHead, textAlign: i >= 4 && i <= 7 ? "right" : i === 9 ? "right" : "left", borderRight: i === 9 ? "none" : cellHead.borderRight }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.domains.slice(0, count).map((d, i) => (
            <Row key={d.domain} d={d} expanded={i === expandedIndex} />
          ))}
        </tbody>
      </table>
    </section>
  );

  const App = () => (
    <Wrapper>
      <TopBar />
      <StatusStrip />
      <Hero />
      <Grid count={7} expandedIndex={0} />
      <footer style={{ padding: "12px 24px", borderTop: "1px solid " + T.line, color: T.mute2, fontSize: 10.5, display: "flex", justifyContent: "space-between" }}>
        <span>READY · 7 ROWS · 12 OFFERS · NEXT REFRESH 00:14:32</span>
        <span>v3.4.1 · API STATUS: <span style={{ color: T.accent }}>OK</span></span>
      </footer>
    </Wrapper>
  );

  return { App };
})();

const lblT = { fontSize: 10, color: "#7d8694", letterSpacing: 0.4, marginBottom: 6, fontWeight: 600 };
const selectT = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "9px 12px", background: "#15181d", border: "1px solid #1f2329",
  color: "#e5e7eb", fontWeight: 600, fontSize: 12,
};
function miniBtn(bg, fg, border) {
  return {
    background: bg, color: fg,
    border: border ? "1px solid " + border : "none",
    padding: "4px 8px", fontFamily: "var(--lp-mono)",
    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, cursor: "pointer",
  };
}
const ghostBtnT = {
  background: "transparent", color: "#cbd0d8", border: "1px solid #262b33",
  padding: "5px 10px", fontFamily: "var(--lp-mono)", fontSize: 11,
  fontWeight: 600, letterSpacing: 0.3, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};

window.V2 = V2;
