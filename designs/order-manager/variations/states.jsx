// State variants based on V1 (the recommended baseline).
// Empty / Loading / Mobile / Comparison / Not-found

const States = (() => {
  const { Icon, fmt, flag } = LP;
  const data = LP_DATA;
  const { Pill, GradeBadge, Hero, MarketplaceCard } = V1;

  // ============ Empty (first-time, before analyze) ============
  const Empty = () => (
    <div className="lp-reset" style={{
      width: 1100, minHeight: 760, background: "var(--lp-bg)", padding: "24px 28px",
    }}>
      <Hero domainCount={0} />
      <div style={{
        background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16,
        padding: "60px 24px", textAlign: "center", marginTop: 8,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: "var(--lp-accent-50)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "var(--lp-accent)", marginBottom: 14,
        }}>
          <Icon name="bolt" size={26} />
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>No domains analyzed yet</h3>
        <p style={{ margin: "6px auto 18px", maxWidth: 420, color: "var(--lp-mute)", fontSize: 13.5 }}>
          Paste a list of domains above and click <strong>Analyze domains</strong> to see prices across every connected marketplace.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {["forbes.com", "techcrunch.com", "betimate.com"].map(d => (
            <button key={d} style={{
              padding: "8px 14px", borderRadius: 999, border: "1px dashed var(--lp-line)",
              background: "#fff", fontFamily: "var(--lp-mono)", fontSize: 12.5,
              fontWeight: 600, color: "var(--lp-ink-3)",
            }}>+ {d}</button>
          ))}
        </div>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, textAlign: "left", maxWidth: 640, margin: "24px auto 0" }}>
          {[
            { i: "plug", l: "Live API marketplaces", v: "Adsy, Getlinks (real-time pricing)" },
            { i: "db", l: "Synced marketplaces", v: "Sedo, Linkbuilder.io and 4 more" },
            { i: "user", l: "Direct vendors", v: "12 vetted sellers in your network" },
          ].map(b => (
            <div key={b.l} style={{ padding: 14, background: "var(--lp-bg-3)", borderRadius: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--lp-ink-2)", marginBottom: 4 }}>
                <Icon name={b.i} size={14} /> <span style={{ fontWeight: 700, fontSize: 12.5 }}>{b.l}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--lp-mute)" }}>{b.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ============ Loading / streaming ============
  const SkRow = ({ progress = 1 }) => (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "32px 1.4fr 1.5fr 0.7fr 0.5fr 0.5fr 0.6fr 0.6fr 0.9fr",
          gap: 12, alignItems: "center", padding: "16px 14px",
          borderBottom: "1px solid var(--lp-line-2)",
          opacity: progress,
        }}>
          <div />
          <div>
            <div style={{ ...sk(150, 13), }} />
            <div style={{ ...sk(80, 10), marginTop: 6 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={sk(28, 28, 8)} />
            <div style={sk(110, 30, 8)} />
          </div>
          <div style={sk(46, 22, 6)} />
          <div style={sk(28, 14)} />
          <div style={sk(28, 14)} />
          <div style={sk(36, 14)} />
          <div style={sk(46, 14)} />
          <div style={sk(120, 22, 999)} />
        </div>
      </td>
    </tr>
  );

  const Loading = () => (
    <div className="lp-reset" style={{ width: 1100, minHeight: 760, background: "var(--lp-bg)", padding: 24 }}>
      <div style={{
        background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16, overflow: "hidden",
      }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid var(--lp-line)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 15 }}>Domain analysis results</strong>
            <Pill color="blue">3 of 7 ready</Pill>
            <span style={{ fontSize: 12, color: "var(--lp-mute)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="lp-spin" /> Streaming results — live API queries
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={ghostBtn()}><Icon name="x" size={11} /> Cancel</button>
          </div>
        </header>
        {/* progress strip */}
        <div style={{ height: 3, background: "var(--lp-line-2)", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0, width: "42%",
            background: "linear-gradient(90deg, var(--lp-accent), #7c3aed)",
            animation: "lp-bar 1.4s ease-in-out infinite",
          }} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafbfd" }}>
            <tr>
              {["", "DOMAIN", "ACTIONS", "VALUE", "CC", "DR", "TRAFFIC", "KEYWORDS", "CATEGORY"].map(h => (
                <th key={h} style={{
                  padding: "10px 12px", fontSize: 11, fontWeight: 600,
                  color: "var(--lp-mute)", letterSpacing: 0.3, textTransform: "uppercase",
                  borderBottom: "1px solid var(--lp-line)", textAlign: "left",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 3 done rows */}
            {data.domains.slice(0, 3).map(d => (
              <DoneRow key={d.domain} d={d} />
            ))}
            <SkRow progress={1} />
            <SkRow progress={0.7} />
            <SkRow progress={0.45} />
            <SkRow progress={0.3} />
          </tbody>
        </table>
        <div style={{ padding: "10px 18px", fontSize: 11.5, color: "var(--lp-mute)", borderTop: "1px solid var(--lp-line-2)", display: "flex", justifyContent: "space-between" }}>
          <span>Adsy ✓ &nbsp; Getlinks ✓ &nbsp; Sedo <span className="lp-spin sm" /> &nbsp; Linkbuilder pending…</span>
          <span>~3s remaining</span>
        </div>
      </div>
    </div>
  );

  const DoneRow = ({ d }) => (
    <tr>
      <td style={tdL(36)}><span style={{ display: "inline-flex", width: 16, height: 16, color: "var(--lp-good)" }}><Icon name="check" size={14} /></span></td>
      <td style={tdL()}>
        <div style={{ fontFamily: "var(--lp-mono)", fontWeight: 600, fontSize: 13 }}>{d.domain}</div>
        <div style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>{d.offers?.length || 0} offers</div>
      </td>
      <td style={tdL()}>
        {d.bestPrice != null
          ? <button style={smallPrimary()}>Buy ${fmt.withFee(d.bestPrice)}</button>
          : <span style={{ fontSize: 12, color: "var(--lp-mute)" }}>—</span>}
      </td>
      <td style={tdL()}><GradeBadge grade={d.grade} score={d.score} /></td>
      <td style={tdL()}>{d.country}</td>
      <td style={tdL()}>{d.dr}</td>
      <td style={tdL()}>{fmt.num(d.traffic)}</td>
      <td style={tdL()}>{fmt.num(d.keywords)}</td>
      <td style={tdL()}><Pill color="ink">{d.category}</Pill></td>
    </tr>
  );

  // ============ Mobile (375 wide) ============
  const Mobile = () => (
    <div className="lp-reset" style={{
      width: 390, minHeight: 800, background: "var(--lp-bg)", padding: 16,
      fontFamily: "var(--lp-sans)",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={iconCircle()}><Icon name="search" size={14} /></button>
          <button style={iconCircle()}><Icon name="user" size={14} /></button>
        </div>
      </header>

      {/* Compact hero */}
      <div style={{ background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>Domain analysis</h1>
        <p style={{ margin: "2px 0 10px", color: "var(--lp-mute)", fontSize: 12 }}>
          Up to 200 domains. Compare prices instantly.
        </p>
        <textarea defaultValue="forbes.com&#10;betimate.com&#10;oneangrygamer.net" style={{
          width: "100%", minHeight: 78, padding: 10, border: "1px solid var(--lp-line)",
          borderRadius: 9, fontFamily: "var(--lp-mono)", fontSize: 12.5,
          background: "var(--lp-bg-3)", outline: "none", resize: "none",
        }} spellCheck={false} />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <Pill color="blue">3 / 200</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
          <button style={{ ...select({}), height: 38 }}>Niche · General <Icon name="chevronDown" size={11} color="var(--lp-mute)" /></button>
          <button style={{ ...select({}), height: 38 }}>USD $ <Icon name="chevronDown" size={11} color="var(--lp-mute)" /></button>
        </div>
        <button style={{
          width: "100%", padding: "12px", marginTop: 10,
          background: "var(--lp-ink)", color: "#fff", border: "none",
          borderRadius: 10, fontWeight: 700, fontSize: 13.5,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Icon name="bolt" size={13} /> Analyze
        </button>
      </div>

      {/* Cards */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Results · 3</span>
        <button style={{ background: "none", border: "none", color: "var(--lp-accent)", fontSize: 12, fontWeight: 600 }}>Sort: Best value</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.domains.slice(0, 3).map((d, i) => (
          <MobileCard key={d.domain} d={d} expanded={i === 0} />
        ))}
      </div>
    </div>
  );

  const MobileCard = ({ d, expanded }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    return (
      <div style={{
        background: "#fff", border: "1px solid " + (expanded ? "var(--lp-accent)" : "var(--lp-line)"),
        borderRadius: 14, padding: 14,
        boxShadow: expanded ? "0 0 0 3px var(--lp-accent-50)" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.domain}
          </span>
          <span style={{ fontSize: 13 }}>{flag(d.country)}</span>
          <GradeBadge grade={d.grade} score={d.score} />
        </div>
        <div style={{ fontSize: 11, color: "var(--lp-mute)", marginBottom: 10 }}>{d.category}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { l: "DR", v: d.dr },
            { l: "Traffic", v: fmt.num(d.traffic) },
            { l: "Keywords", v: fmt.num(d.keywords) },
            { l: "Ref.", v: fmt.num(d.refDomains) },
          ].map(s => (
            <div key={s.l} style={{ background: "var(--lp-bg-3)", borderRadius: 8, padding: "6px 8px" }}>
              <div style={{ fontSize: 9.5, color: "var(--lp-mute)", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{s.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--lp-mono)" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: "var(--lp-mute)", fontWeight: 700, letterSpacing: 0.4 }}>BEST PRICE · WITH FEE</span>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--lp-mono)" }}>
            {d.bestPrice != null ? "$" + fmt.withFee(d.bestPrice) : "—"}
          </span>
        </div>
        <button style={{
          width: "100%", padding: "11px", background: "var(--lp-ink)", color: "#fff",
          border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Icon name="shield" size={13} /> Buy managed</button>
        <button style={{
          width: "100%", marginTop: 8, padding: "10px",
          background: "transparent", border: "1px solid var(--lp-line)",
          borderRadius: 10, fontWeight: 600, fontSize: 12.5, color: "var(--lp-ink-2)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          {expanded ? "Hide" : "Compare"} {offers.length} marketplaces
          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={11} />
        </button>

        {expanded && offers[0] && (
          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--lp-line)",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {offers.slice(0, 2).map((o, i) => (
              <div key={i} style={{
                padding: 10, borderRadius: 10,
                border: "1px solid " + (i === 0 ? "var(--lp-accent)" : "var(--lp-line)"),
                background: i === 0 ? "var(--lp-accent-50)" : "#fff",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{o.name}</span>
                  <span style={{ fontWeight: 800, fontFamily: "var(--lp-mono)", fontSize: 14 }}>${fmt.withFee(o.minPrice)}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  <Pill color="ink">{o.delivery}d delivery</Pill>
                  <Pill color="ink">{o.tat}d TAT</Pill>
                  <Pill color={o.link === "Dofollow" ? "green" : "amber"}>
                    {o.link === "Dofollow" ? "✓ Dofollow" : "✗ Nofollow"}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============ Comparison view (user provided prices) ============
  const Comparison = () => {
    const rows = data.domains.filter(d => d.bestPrice != null && !d.notFound).slice(0, 4).map(d => ({
      ...d, yourPrice: d.yourPrice || Math.round(d.bestPrice * (0.85 + Math.random() * 0.4)),
    }));
    return (
      <div className="lp-reset" style={{ width: 1100, minHeight: 760, background: "var(--lp-bg)", padding: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Comparison view</h2>
          <p style={{ margin: "4px 0 0", color: "var(--lp-mute)", fontSize: 13 }}>
            You provided prices for 4 domains. We compare those against the best price across our marketplaces.
          </p>
        </div>
        <div style={{
          background: "#fff", borderRadius: 16, border: "1px solid var(--lp-line)", overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafbfd" }}>
              <tr>
                {["DOMAIN", "VALUE", "YOUR PRICE", "OUR BEST", "DELTA", "WINNING MARKETPLACE", ""].map(h => (
                  <th key={h} style={th()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const ours = fmt.withFee(d.bestPrice);
                const diff = ((ours - d.yourPrice) / d.yourPrice) * 100;
                const r = Math.round(Math.abs(diff));
                const winner = d.offers?.[0]?.name || "—";
                const c = diff < -0.5 ? "var(--lp-good)" : diff > 0.5 ? "var(--lp-bad)" : "var(--lp-mute)";
                return (
                  <tr key={d.domain}>
                    <td style={td()}>
                      <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700 }}>{d.domain}</span>
                      <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>{d.category} · {d.country}</div>
                    </td>
                    <td style={td()}><GradeBadge grade={d.grade} score={d.score} /></td>
                    <td style={tdNum()}>${d.yourPrice}</td>
                    <td style={tdNum("var(--lp-accent-700)")}>${ours}</td>
                    <td style={td()}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 999,
                        background: diff < -0.5 ? "var(--lp-good-bg)" : diff > 0.5 ? "var(--lp-bad-bg)" : "var(--lp-bg-3)",
                        color: c, fontWeight: 700, fontSize: 12,
                      }}>
                        {diff < 0 ? "↓" : diff > 0 ? "↑" : "="} {r}% {diff < 0 ? "cheaper" : diff > 0 ? "more" : "same"}
                      </span>
                      <div style={{
                        marginTop: 8, height: 5, background: "var(--lp-bg-3)", borderRadius: 3,
                        position: "relative", overflow: "hidden", maxWidth: 140,
                      }}>
                        <div style={{
                          position: "absolute", left: 0, top: 0, bottom: 0,
                          width: `${Math.min(50 - diff/2, 95)}%`,
                          background: c,
                        }} />
                        <div style={{
                          position: "absolute", left: "50%", top: -2, bottom: -2,
                          width: 1, background: "var(--lp-mute)",
                        }} />
                      </div>
                    </td>
                    <td style={td()}>
                      <Pill color="blue">{winner}</Pill>
                    </td>
                    <td style={td()}>
                      <button style={smallPrimary()}>Buy ${ours}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{
            padding: "14px 18px", borderTop: "1px solid var(--lp-line-2)", background: "#fafbfd",
            display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5,
          }}>
            <span style={{ color: "var(--lp-ink-3)" }}>
              <strong>Overall:</strong> Linkpricer is <strong style={{ color: "var(--lp-good)" }}>17% cheaper</strong> on average across these 4 domains.
            </span>
            <button style={smallPrimary()}>Buy all winning offers — $3,289 total</button>
          </div>
        </div>
      </div>
    );
  };

  // ============ Not found ============
  const NotFound = () => (
    <div className="lp-reset" style={{ width: 1100, minHeight: 600, background: "var(--lp-bg)", padding: 24 }}>
      <div style={{
        background: "#fff", borderRadius: 16, border: "1px solid var(--lp-line)", overflow: "hidden",
      }}>
        <header style={{ padding: "14px 18px", borderBottom: "1px solid var(--lp-line)" }}>
          <strong style={{ fontSize: 15 }}>Domain analysis results</strong>
          <span style={{ marginLeft: 10 }}>
            <Pill color="blue">3 domains · 1 not found</Pill>
          </span>
        </header>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {[data.domains[0], data.domains[6], data.domains[1], { domain: "totally-made-up.example", notFound: true }].map(d => (
              d.notFound ? (
                <tr key={d.domain}>
                  <td colSpan={9} style={{
                    padding: "16px 20px", borderBottom: "1px solid var(--lp-line-2)",
                    background: "#fcfaf6", display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 30, height: 30, borderRadius: 8, background: "#fdf2dd", color: "#a35d00",
                    }}>
                      <Icon name="search" size={14} />
                    </span>
                    <div>
                      <div style={{ fontFamily: "var(--lp-mono)", fontWeight: 700, fontSize: 13.5 }}>{d.domain}</div>
                      <div style={{ fontSize: 12, color: "var(--lp-mute)" }}>
                        Not found in our database. Try a closer variant — we have 1.4M+ indexed domains.
                      </div>
                    </div>
                    <button style={{ ...ghostBtn(), marginLeft: "auto" }}>
                      <Icon name="user" size={11} /> Request from vendors
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={d.domain}>
                  <td style={td()}><span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700 }}>{d.domain}</span></td>
                  <td style={td()}><GradeBadge grade={d.grade} score={d.score} /></td>
                  <td style={td()}>{flag(d.country)} {d.country}</td>
                  <td style={tdNum()}>{d.dr}</td>
                  <td style={tdNum()}>{fmt.num(d.traffic)}</td>
                  <td style={td()}><Pill color="ink">{d.category}</Pill></td>
                  <td style={td()}>
                    {d.bestPrice ? <button style={smallPrimary()}>Buy ${fmt.withFee(d.bestPrice)}</button> : <span style={{ color: "var(--lp-mute)", fontSize: 12 }}>No pricing</span>}
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return { Empty, Loading, Mobile, Comparison, NotFound };
})();

// styling helpers shared in this file
function sk(w, h, r = 4) {
  return {
    width: w, height: h, borderRadius: r,
    background: "linear-gradient(90deg, #eef0f4 0%, #f6f7f9 50%, #eef0f4 100%)",
    backgroundSize: "200% 100%", animation: "lp-shimmer 1.4s infinite",
    display: "inline-block",
  };
}
function ghostBtn() {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 10px", borderRadius: 7, border: "1px solid var(--lp-line)",
    background: "#fff", fontSize: 12, fontWeight: 600, color: "var(--lp-ink-3)", cursor: "pointer",
  };
}
function smallPrimary() {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 11px", borderRadius: 7, border: "1px solid var(--lp-ink)",
    background: "var(--lp-ink)", color: "#fff",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  };
}
function iconCircle() {
  return {
    width: 36, height: 36, borderRadius: 999, border: "1px solid var(--lp-line)",
    background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--lp-ink-3)", cursor: "pointer",
  };
}
function select({}) {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 10px", border: "1px solid var(--lp-line)", borderRadius: 8,
    background: "#fff", fontSize: 12.5, fontWeight: 600, color: "var(--lp-ink-2)", gap: 6,
  };
}
function th() {
  return {
    padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--lp-mute)",
    letterSpacing: 0.3, textTransform: "uppercase", textAlign: "left",
    borderBottom: "1px solid var(--lp-line)",
  };
}
function td() {
  return { padding: "14px 12px", fontSize: 13, color: "var(--lp-ink-2)", borderBottom: "1px solid var(--lp-line-2)" };
}
function tdL(w) { return { ...td(), width: w }; }
function tdNum(color) {
  return { ...td(), fontFamily: "var(--lp-mono)", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color || "var(--lp-ink)" };
}

window.States = States;
