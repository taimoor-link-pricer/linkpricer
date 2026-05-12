// Variation 3 — Friendly card grid
// Each domain is a generous card with prominent BUY + grade ring.
// Marketplace expansion is a vertical stack of marketplace cards.

const V3 = (() => {
  const { Icon, fmt, flag, Stars } = LP;
  const data = LP_DATA;

  // Warm soft palette
  const C = {
    bg: "#fbfaf7",
    surface: "#ffffff",
    soft: "#f5f1ea",
    line: "#ece7de",
    line2: "#f3eee5",
    ink: "#1c1a17",
    ink2: "#3a3631",
    mute: "#6e6963",
    accent: "#3a6df0",
    accentSoft: "#eaf0fe",
    good: "#0e9655",
    goodSoft: "#e2f5ec",
    warn: "#c2762a",
    warnSoft: "#f8eedb",
    bad: "#c1300d",
    badSoft: "#fce4dd",
  };

  // Score ring component — value grade as filled circle
  const ScoreRing = ({ score = 0, grade = "—", size = 64 }) => {
    const r = size / 2 - 5;
    const cir = 2 * Math.PI * r;
    const off = cir - (score / 100) * cir;
    let color = C.mute;
    if (grade.startsWith("A")) color = C.good;
    else if (grade === "B+" || grade === "B") color = C.accent;
    else if (grade === "B-") color = C.warn;
    else if (grade === "C" || grade === "F") color = C.mute;
    return (
      <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
        <svg width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.line} strokeWidth="5" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" strokeDasharray={cir} strokeDashoffset={off}
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontWeight: 800, fontSize: 17, color }}>{grade}</div>
          <div style={{ fontSize: 9, color: C.mute, fontWeight: 600, letterSpacing: 0.4 }}>{score}/100</div>
        </div>
      </div>
    );
  };

  const StatChip = ({ label, value, hint }) => (
    <div style={{
      flex: 1, padding: "10px 12px",
      background: C.soft, borderRadius: 12,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, fontFamily: "var(--lp-mono)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: C.mute }}>{hint}</div>}
    </div>
  );

  const Pill3 = ({ children, color = "ink" }) => {
    const m = {
      ink: { bg: "#efeae0", fg: "#3a3631" },
      blue: { bg: C.accentSoft, fg: C.accent },
      green: { bg: C.goodSoft, fg: C.good },
      warn: { bg: C.warnSoft, fg: C.warn },
      bad: { bg: C.badSoft, fg: C.bad },
    }[color];
    return <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: 11,
      fontWeight: 600, background: m.bg, color: m.fg,
    }}>{children}</span>;
  };

  // ============== Hero ==============
  const Hero = () => (
    <section style={{
      background: C.surface, borderRadius: 24, padding: 32, marginBottom: 24,
      border: "1px solid " + C.line, display: "grid",
      gridTemplateColumns: "1.4fr 1fr", gap: 32,
    }}>
      <div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", background: C.soft, borderRadius: 999,
          fontSize: 11.5, fontWeight: 600, color: C.ink2, marginBottom: 16,
        }}>
          <span style={{ width: 6, height: 6, background: C.good, borderRadius: 999 }} />
          7 marketplaces connected
        </span>
        <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: -0.6, color: C.ink, lineHeight: 1.1 }}>
          Find the best price<br />for every backlink.
        </h1>
        <p style={{ margin: "10px 0 22px", fontSize: 15, color: C.mute, maxWidth: 460, lineHeight: 1.5 }}>
          Paste up to 200 domains. We compare prices across every marketplace
          that stocks them — and surface the cheapest, most editorial-friendly option.
        </p>

        <div style={{
          background: C.bg, borderRadius: 18, border: "1px solid " + C.line,
          padding: 16,
        }}>
          <div style={{
            background: C.surface, borderRadius: 12, border: "1px solid " + C.line2,
            padding: 14, fontFamily: "var(--lp-mono)", fontSize: 13.5, color: C.ink2,
            lineHeight: 1.7, minHeight: 132,
          }}>
            forbes.com<br />
            betimate.com<br />
            oneangrygamer.net<br />
            techcrunch.com 1100<br />
            healthline.com<br />
            <span style={{ color: C.mute }}>Add more, one per line…</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill3 color="blue">5 / 200</Pill3>
              <Pill3 color="ink">1 with comparison price</Pill3>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={ghost3()}><Icon name="upload" size={13} /> CSV</button>
              <button style={ghost3()}><Icon name="clock" size={13} /> Recent</button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: C.mute, fontWeight: 600 }}>Try with:</span>
          {["forbes.com", "betimate.com", "oneangrygamer.net", "techcrunch.com"].map(d => (
            <button key={d} style={{
              padding: "6px 11px", borderRadius: 999, border: "1px solid " + C.line,
              background: C.surface, fontFamily: "var(--lp-mono)", fontSize: 12,
              fontWeight: 600, color: C.ink2, cursor: "pointer",
            }}>+ {d}</button>
          ))}
        </div>
      </div>

      <aside style={{
        background: C.bg, borderRadius: 18, padding: 24,
        border: "1px solid " + C.line, display: "flex", flexDirection: "column", gap: 20,
      }}>
        <div>
          <div style={lbl3}>Pricing column</div>
          <div style={select3}>
            <span>General</span>
            <Icon name="chevronDown" size={14} color={C.mute} />
          </div>
          <div style={{ fontSize: 11, color: C.mute, marginTop: 6 }}>
            Switch to a niche to see niche-specific prices for restricted categories.
          </div>
        </div>
        <div>
          <div style={lbl3}>Currency</div>
          <div style={{ display: "flex", gap: 4, padding: 4, background: C.surface, border: "1px solid " + C.line, borderRadius: 10 }}>
            {["USD", "EUR", "GBP"].map((c, i) => (
              <button key={c} style={{
                flex: 1, padding: "8px 0", borderRadius: 7,
                background: i === 0 ? C.ink : "transparent",
                color: i === 0 ? "#fff" : C.ink2, border: "none",
                fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>
        </div>
        <button style={{
          padding: "16px", background: C.ink, color: "#fff", border: "none",
          borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <Icon name="bolt" size={15} /> Analyze 5 domains
        </button>
        <div style={{ borderTop: "1px solid " + C.line, paddingTop: 16, fontSize: 11.5, color: C.mute, lineHeight: 1.6 }}>
          Average scan time: <strong style={{ color: C.ink2 }}>2.4s</strong><br />
          Linkpricer fee: <strong style={{ color: C.ink2 }}>15%</strong> on managed buys
        </div>
      </aside>
    </section>
  );

  // ============== Domain card ==============
  const DomainCard = ({ d, expanded = false }) => {
    if (d.notFound) return (
      <div style={{
        background: C.surface, border: "1px dashed " + C.line, borderRadius: 18,
        padding: "18px 24px", display: "flex", alignItems: "center", gap: 14,
        color: C.mute,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: C.soft,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="search" size={14} /></div>
        <div>
          <div style={{ fontFamily: "var(--lp-mono)", fontWeight: 600, color: C.ink2 }}>{d.domain}</div>
          <div style={{ fontSize: 12 }}>Not found in our database — try a closer variant.</div>
        </div>
      </div>
    );

    return (
      <div style={{
        background: C.surface, borderRadius: 20, border: "1px solid " + C.line,
        boxShadow: "0 1px 0 rgba(28,26,23,0.02)", overflow: "hidden",
      }}>
        <div style={{ padding: 22, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 20, alignItems: "center" }}>
          <ScoreRing score={d.score} grade={d.grade} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 18, color: C.ink, letterSpacing: -0.3 }}>{d.domain}</span>
              <Pill3 color="ink">{flag(d.country)} {d.country}</Pill3>
              <Pill3 color="ink">{d.category}</Pill3>
              {d.lang && <Pill3 color="ink">{d.lang}</Pill3>}
            </div>
            <div style={{ fontSize: 12.5, color: C.mute, marginBottom: 12 }}>
              {d.offers?.length || 0} marketplaces stock this domain · last refresh 2 min ago
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <StatChip label="DR" value={d.dr ?? "—"} hint="Ahrefs" />
              <StatChip label="Traffic" value={fmt.num(d.traffic)} hint="monthly" />
              <StatChip label="Keywords" value={fmt.num(d.keywords)} hint="ranking" />
              <StatChip label="Ref. domains" value={fmt.num(d.refDomains)} hint="external" />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, minWidth: 220 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Best price · with fee</div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--lp-mono)", color: C.ink, letterSpacing: -1 }}>
                {d.bestPrice != null ? "$" + fmt.withFee(d.bestPrice).toLocaleString() : "—"}
              </div>
              {d.yourPrice != null && d.bestPrice != null && (
                <div style={{ fontSize: 11.5, color: fmt.withFee(d.bestPrice) <= d.yourPrice ? C.good : C.bad, fontWeight: 600, marginTop: 2 }}>
                  {fmt.withFee(d.bestPrice) <= d.yourPrice
                    ? `${Math.round((1 - fmt.withFee(d.bestPrice) / d.yourPrice) * 100)}% under your $${d.yourPrice}`
                    : `${Math.round((fmt.withFee(d.bestPrice) / d.yourPrice - 1) * 100)}% over your $${d.yourPrice}`}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={iconBtn3()} aria-label="Favourite">
                <Icon name="heart" size={15} color={C.ink2} />
              </button>
              {d.bestPrice != null ? (
                <>
                  <button style={btn3("primary")}>
                    <Icon name="shield" size={14} /> Buy managed
                  </button>
                </>
              ) : d.noPrice ? (
                <button style={btn3("disabled")} disabled>No pricing</button>
              ) : (
                <button style={btn3("disabled")} disabled>No offers</button>
              )}
            </div>
            <button style={{
              background: "transparent", border: "none", color: C.accent,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              {expanded ? "Hide" : "Compare"} {d.offers?.length || 0} marketplaces
              <Icon name={expanded ? "chevronUp" : "chevronDown"} size={12} />
            </button>
          </div>
        </div>
        {expanded && <ExpandedPanel d={d} />}
      </div>
    );
  };

  // ============== Marketplace expanded ==============
  const MarketplaceCard3 = ({ o, isBest, yourPrice }) => {
    const ourPrice = fmt.withFee(o.minPrice);
    const linkGood = o.link === "Dofollow";
    const cmp = (() => {
      if (!yourPrice) return null;
      const diff = ((ourPrice - yourPrice) / yourPrice) * 100;
      const r = Math.round(Math.abs(diff));
      if (r < 1) return { color: "ink", label: "Same price" };
      if (diff < 0) return { color: "green", label: `${r}% cheaper` };
      return { color: "bad", label: `${r}% more expensive` };
    })();
    return (
      <div style={{
        background: C.surface, borderRadius: 16,
        border: "1px solid " + (isBest ? C.good : C.line),
        padding: 18, position: "relative",
      }}>
        {isBest && (
          <span style={{
            position: "absolute", top: 14, right: 14,
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 9px", background: C.good, color: "#fff",
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
            textTransform: "uppercase", borderRadius: 999,
          }}>★ Best price</span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: C.soft,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 13, color: C.ink2,
          }}>{o.name.replace(/^Vendor: /, "").slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{o.name}</div>
            <div style={{ fontSize: 11, color: C.mute, display: "flex", gap: 8 }}>
              <span>{o.type === "API" ? "Live API" : o.type === "DB" ? "Synced" : "Direct vendor"}</span>
              <span>·</span>
              <span>Updated {o.updated.split(" ")[0]}</span>
            </div>
          </div>
          <Stars n={o.quality} />
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: yourPrice ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: 12, marginBottom: 14,
        }}>
          <div style={priceBox3}>
            <div style={priceLbl3}>Marketplace price</div>
            <div style={priceVal3}>{fmt.range(o.minPrice, o.maxPrice)}</div>
          </div>
          <div style={{ ...priceBox3, background: C.accentSoft }}>
            <div style={priceLbl3}>Our price <Icon name="info" size={11} color={C.mute} /></div>
            <div style={{ ...priceVal3, color: C.accent }}>${ourPrice}</div>
            <div style={{ fontSize: 10, color: C.mute, marginTop: 2 }}>incl. 15% fee</div>
          </div>
          {yourPrice && (
            <div style={priceBox3}>
              <div style={priceLbl3}>Your price</div>
              <div style={priceVal3}>${yourPrice}</div>
              {cmp && <div style={{ marginTop: 4 }}><Pill3 color={cmp.color}>{cmp.label}</Pill3></div>}
            </div>
          )}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12,
          padding: "12px 14px", background: C.bg, borderRadius: 12, marginBottom: 12,
        }}>
          <div>
            <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Delivery guarantee</div>
            <div style={{ fontWeight: 700, color: C.ink, marginTop: 2 }}>{o.delivery} days</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Avg. TAT</div>
            <div style={{ fontWeight: 700, color: C.ink, marginTop: 2 }}>{o.tat} days</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Link type</div>
            <div style={{ marginTop: 4 }}>
              <Pill3 color={linkGood ? "green" : "warn"}>
                {linkGood ? "✓ Dofollow" : "✗ Nofollow"}
              </Pill3>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Source</div>
            <div style={{ marginTop: 4 }}>
              <Pill3 color="ink">{o.type}</Pill3>
            </div>
          </div>
        </div>

        {o.example && (
          <a href="#" onClick={e => e.preventDefault()} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 12px", borderRadius: 12,
            background: C.bg, border: "1px solid " + C.line2,
            textDecoration: "none", color: C.ink2, marginBottom: 12,
          }}>
            <div className="lp-imgph" style={{ width: 36, height: 28, borderRadius: 6 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: C.mute, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Published example</div>
              <div style={{ fontFamily: "var(--lp-mono)", fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.example.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <Icon name="external" size={14} color={C.accent} />
          </a>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button style={btn3("primary")}><Icon name="shield" size={13} /> Buy managed</button>
          <button style={btn3("ghost")}>Buy direct <Icon name="external" size={11} /></button>
        </div>
      </div>
    );
  };

  const ExpandedPanel = ({ d }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    return (
      <div style={{
        background: C.bg, borderTop: "1px solid " + C.line, padding: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.mute, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Marketplace comparison</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.ink, marginTop: 2 }}>Top 3 best prices</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={ghost3()}>Sort: Price ↑</button>
            <button style={ghost3()}>Show all ({offers.length})</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {offers.slice(0, 3).map((o, i) => (
            <MarketplaceCard3 key={i} o={o} isBest={i === 0} yourPrice={d.yourPrice} />
          ))}
        </div>
      </div>
    );
  };

  // ============== Results ==============
  const Results = ({ count = 5, expandedIndex = 1 }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.ink }}>5 domains analyzed</h2>
          <div style={{ fontSize: 12.5, color: C.mute, marginTop: 4 }}>
            12 offers across 4 marketplaces · Avg savings vs. retail: <strong style={{ color: C.good }}>28%</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={ghost3()}>Sort: Best value</button>
          <button style={ghost3()}><Icon name="filter" size={12} /> Filter</button>
          <button style={ghost3()}><Icon name="download" size={12} /> Export CSV</button>
        </div>
      </div>
      {data.domains.slice(0, count).map((d, i) => (
        <DomainCard key={d.domain} d={d} expanded={i === expandedIndex} />
      ))}
    </div>
  );

  const App = () => (
    <div className="lp-reset" style={{
      width: 1440, minHeight: 1100, background: C.bg, padding: "20px 32px 40px",
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 0 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: C.ink, letterSpacing: -0.2 }}>Linkpricer</span>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {["Analyze", "Lists", "Orders", "Vendors"].map((l, i) => (
            <a key={l} href="#" style={{
              padding: "9px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              color: i === 0 ? "#fff" : C.ink2, background: i === 0 ? C.ink : "transparent",
              textDecoration: "none",
            }}>{l}</a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={ghost3()}><Icon name="search" size={13} /> Search</button>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: "linear-gradient(135deg, #f59e0b, #ef4444)" }} />
        </div>
      </header>
      <Hero />
      <Results count={5} expandedIndex={1} />
    </div>
  );

  return { App };
})();

const lbl3 = { fontSize: 10.5, color: "#6e6963", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 };
const select3 = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 14px", background: "#fff", border: "1px solid #ece7de",
  borderRadius: 10, fontWeight: 700, fontSize: 13.5, color: "#1c1a17",
};
function btn3(kind) {
  const k = {
    primary: { bg: "#1c1a17", fg: "#fff", border: "none" },
    ghost: { bg: "#fff", fg: "#3a3631", border: "1px solid #ece7de" },
    disabled: { bg: "#f5f1ea", fg: "#9c958c", border: "none", cursor: "not-allowed" },
  }[kind];
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "10px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13,
    background: k.bg, color: k.fg, border: k.border, cursor: k.cursor || "pointer",
  };
}
function ghost3() {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 12px", borderRadius: 999, border: "1px solid #ece7de",
    background: "#fff", fontWeight: 600, fontSize: 12.5, color: "#3a3631", cursor: "pointer",
  };
}
function iconBtn3() {
  return {
    width: 38, height: 38, borderRadius: 10,
    background: "#fff", border: "1px solid #ece7de",
    display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  };
}
const priceBox3 = {
  background: "#fbfaf7", borderRadius: 12, padding: "10px 12px",
  display: "flex", flexDirection: "column", gap: 2,
};
const priceLbl3 = { fontSize: 10.5, color: "#6e6963", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 };
const priceVal3 = { fontSize: 18, fontWeight: 800, color: "#1c1a17", fontFamily: "var(--lp-mono)", fontVariantNumeric: "tabular-nums" };

window.V3 = V3;
