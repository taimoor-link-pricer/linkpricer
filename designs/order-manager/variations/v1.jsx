// Variation 1 — Calm Enterprise SaaS
// Sober slate palette, structured table, balanced density.
// Hero: split — left = paste, right = niche / sample chips.

const V1 = (() => {
  const { Icon, Stars, fmt, gradeColor, flag } = LP;
  const data = LP_DATA;

  const Pill = ({ children, color = "ink", style = {} }) => {
    const map = {
      ink:    { bg: "#eef0f4", fg: "#374151" },
      blue:   { bg: "#e9f1fe", fg: "#1d4ed8" },
      green:  { bg: "#e6f6ed", fg: "#0a8a4a" },
      amber:  { bg: "#fdf2dd", fg: "#a35d00" },
      red:    { bg: "#fdecea", fg: "#b1280c" },
    };
    const c = map[color] || map.ink;
    return <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      letterSpacing: 0.1, background: c.bg, color: c.fg, ...style,
    }}>{children}</span>;
  };

  const GradeBadge = ({ grade, score, big = false }) => {
    const c = gradeColor(grade);
    return (
      <span style={{
        display: "inline-flex", alignItems: "baseline", gap: 6,
        padding: big ? "6px 12px" : "3px 9px",
        borderRadius: 8, background: c.bg, color: c.fg,
        fontWeight: 700, fontSize: big ? 16 : 12,
      }}>
        <span>{grade || "—"}</span>
        {score != null && <span style={{ fontSize: big ? 11 : 10, opacity: 0.7, fontWeight: 600 }}>{score}</span>}
      </span>
    );
  };

  // ============== Hero (search/input block) ==============
  const Hero = ({ inputText = LP.sampleInput, niche = "general", domainCount = 5, truncated = false, loading = false }) => (
    <section style={{
      background: "linear-gradient(180deg, #ffffff 0%, #f7f8fa 100%)",
      border: "1px solid var(--lp-line)",
      borderRadius: 16, padding: 28, marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 24 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--lp-mute)", fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
            <Icon name="bolt" size={14} /> Domain Analysis
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: -0.4, color: "var(--lp-ink)" }}>
            Analyze guest post opportunities
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--lp-ink-3)", fontSize: 14, maxWidth: 580 }}>
            Upload up to 200 domains and compare prices & conditions across every marketplace that stocks them.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={btn("ghost")}><Icon name="upload" size={14} /> Import CSV</button>
          <button style={btn("ghost")}><Icon name="clock" size={14} /> Recent searches</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* paste area */}
        <div style={{
          position: "relative", background: "#fff", border: "1px solid var(--lp-line)",
          borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--lp-line-2)", background: "#fafbfd" }}>
            <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>
              Paste domains — one per line. Append a price to compare:&nbsp;
              <span className="lp-mono" style={{ color: "var(--lp-ink-2)" }}>forbes.com 200</span>
            </span>
            <span style={{ display: "inline-flex", gap: 6 }}>
              <Pill color={truncated ? "red" : domainCount > 0 ? "blue" : "ink"}>
                {domainCount}/200 domains
              </Pill>
              {truncated && <Pill color="red">Truncated!</Pill>}
            </span>
          </div>
          <textarea
            defaultValue={inputText}
            spellCheck={false}
            style={{
              width: "100%", minHeight: 152, padding: 14,
              border: "none", outline: "none", resize: "vertical",
              fontFamily: "var(--lp-mono)", fontSize: 13.5, lineHeight: 1.7,
              color: "var(--lp-ink-2)", background: "transparent",
            }}
          />
        </div>

        {/* right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={lbl}>Niche / pricing column</label>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 10,
              padding: "10px 12px", fontWeight: 600, fontSize: 13.5,
            }}>
              <span>{data.niches.find(n => n.id === niche)?.label || "General"}</span>
              <Icon name="chevronDown" size={14} color="var(--lp-mute)" />
            </div>
          </div>

          <div>
            <label style={lbl}>Currency</label>
            <div style={{ display: "flex", gap: 6 }}>
              {["USD $", "EUR €", "GBP £"].map((c, i) => (
                <button key={c} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  border: "1px solid " + (i === 0 ? "var(--lp-accent)" : "var(--lp-line)"),
                  background: i === 0 ? "var(--lp-accent-50)" : "#fff",
                  color: i === 0 ? "var(--lp-accent-700)" : "var(--lp-ink-3)",
                }}>{c}</button>
              ))}
            </div>
          </div>

          <button style={{ ...btn("primary"), justifyContent: "center", padding: "14px 16px", fontSize: 14.5, marginTop: 4 }}>
            {loading ? <><span className="lp-spin" /> Analyzing…</> : <><Icon name="bolt" size={16} /> Analyze domains</>}
          </button>
        </div>
      </div>

      {/* sample chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--lp-mute)", fontWeight: 600 }}>Try with:</span>
        {["forbes.com", "betimate.com", "oneangrygamer.net", "techcrunch.com", "healthline.com"].map(d => (
          <button key={d} style={chip}>{d}</button>
        ))}
      </div>
    </section>
  );

  // ============== Results table ==============
  const Th = ({ children, style = {}, sortable = false, active = false, dir = "desc" }) => (
    <th style={{
      textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600,
      color: "var(--lp-mute)", letterSpacing: 0.3, textTransform: "uppercase",
      borderBottom: "1px solid var(--lp-line)", whiteSpace: "nowrap",
      ...style,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: sortable ? "pointer" : "default", color: active ? "var(--lp-ink-2)" : undefined }}>
        {children}
        {sortable && <Icon name={active ? (dir === "desc" ? "arrowDown" : "arrowUp") : "sort"} size={11} color={active ? "var(--lp-accent)" : "var(--lp-mute-2)"} />}
      </span>
    </th>
  );

  const Td = ({ children, style = {} }) => (
    <td style={{
      padding: "14px 12px", fontSize: 13.5, color: "var(--lp-ink-2)",
      borderBottom: "1px solid var(--lp-line-2)", verticalAlign: "middle",
      ...style,
    }}>{children}</td>
  );

  const TrendArrow = ({ dir }) => {
    if (dir === "up") return <Icon name="arrowUp" size={11} color="var(--lp-good)" />;
    if (dir === "down") return <Icon name="arrowDown" size={11} color="var(--lp-bad)" />;
    return <span style={{ display: "inline-block", width: 6, height: 1, background: "var(--lp-mute-2)", verticalAlign: "middle" }} />;
  };

  const DomainRow = ({ d, expanded = false, onToggle, fav = false }) => {
    if (d.notFound) {
      return (
        <tr>
          <td colSpan={9} style={{
            padding: "16px 12px", borderBottom: "1px solid var(--lp-line-2)",
            background: "#fafbfd", fontSize: 13,
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--lp-mute)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--lp-mute-2)" }} />
              <span className="lp-mono" style={{ color: "var(--lp-ink-3)", fontWeight: 600 }}>{d.domain}</span>
              <span>·</span>
              <span>Domain not found in our database</span>
            </span>
          </td>
        </tr>
      );
    }
    return (
      <>
        <tr style={{ background: expanded ? "#fafbfd" : "transparent" }}>
          <Td style={{ width: 36, paddingRight: 0 }}>
            <button onClick={onToggle} style={chev(expanded)} aria-label="Toggle">
              <Icon name="chevron" size={14} />
            </button>
          </Td>
          <Td style={{ minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: "var(--lp-bg-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--lp-mono)", fontSize: 11, fontWeight: 700, color: "var(--lp-ink-3)",
              }}>{d.domain.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="lp-mono" style={{ fontWeight: 600, fontSize: 13.5, color: "var(--lp-ink)" }}>{d.domain}</div>
                <div style={{ fontSize: 11, color: "var(--lp-mute)", marginTop: 2 }}>
                  {d.lang} · {d.refDomains ? fmt.num(d.refDomains) + " ref. domains" : "—"}
                </div>
              </div>
            </div>
          </Td>
          <Td style={{ width: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button style={iconBtn(fav)} aria-label="Favourite">
                <Icon name={fav ? "heartFill" : "heart"} size={14} color={fav ? "#e11d48" : "currentColor"} />
              </button>
              {d.bestPrice != null ? (
                <button style={btn("primary", "sm")}>
                  Buy {fmt.price(fmt.withFee(d.bestPrice))}
                </button>
              ) : d.noPrice ? (
                <button style={btn("disabled", "sm")} disabled>No pricing</button>
              ) : (
                <button style={btn("disabled", "sm")} disabled>No offers</button>
              )}
            </div>
          </Td>
          <Td><GradeBadge grade={d.grade} score={d.score} /></Td>
          <Td>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{flag(d.country)}</span>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{d.country || "—"}</span>
            </span>
          </Td>
          <Td>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="lp-mono lp-tnum" style={{ fontWeight: 600 }}>{d.dr ?? "—"}</span>
              <TrendArrow dir={d.drTrend} />
            </span>
          </Td>
          <Td><span className="lp-mono lp-tnum" style={{ fontWeight: 600 }}>{fmt.num(d.traffic)}</span></Td>
          <Td><span className="lp-mono lp-tnum" style={{ color: "var(--lp-ink-3)" }}>{fmt.num(d.keywords)}</span></Td>
          <Td><Pill color="ink">{d.category || "—"}</Pill></Td>
        </tr>
        {expanded && (
          <tr>
            <td colSpan={9} style={{ padding: 0, background: "#fafbfd", borderBottom: "1px solid var(--lp-line)" }}>
              <ExpandedPanel d={d} />
            </td>
          </tr>
        )}
      </>
    );
  };

  // ============== Expanded marketplace panel ==============
  const MarketplaceCard = ({ o, bestPrice, yourPrice }) => {
    const ourPrice = fmt.withFee(o.minPrice);
    const isBest = o.minPrice === bestPrice;
    const linkGood = o.link === "Dofollow";
    const cmp = (() => {
      if (yourPrice == null || ourPrice == null) return null;
      const diff = ((ourPrice - yourPrice) / yourPrice) * 100;
      const d = Math.round(Math.abs(diff));
      if (d < 1) return { color: "ink", label: "Same price" };
      if (diff < 0) return { color: "green", label: `${d}% cheaper` };
      return { color: "red", label: `${d}% more expensive` };
    })();

    const typeIcon = { API: "plug", DB: "db", Vendor: "user" }[o.type] || "plug";

    return (
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid " + (isBest ? "var(--lp-accent)" : "var(--lp-line)"),
        boxShadow: isBest ? "0 0 0 2px var(--lp-accent-50)" : "none",
        padding: 16, position: "relative", display: "flex", flexDirection: "column", gap: 12,
      }}>
        {isBest && (
          <span style={{
            position: "absolute", top: -10, left: 14, background: "var(--lp-accent)",
            color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px",
            borderRadius: 999, letterSpacing: 0.4, textTransform: "uppercase",
          }}>Best price</span>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: o.type === "Vendor" ? "#fdf2dd" : o.type === "API" ? "#e9f1fe" : "#eef0f4",
              color: o.type === "Vendor" ? "#a35d00" : o.type === "API" ? "#1d4ed8" : "#374151",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name={typeIcon} size={14} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--lp-ink)" }}>{o.name}</div>
              <div style={{ fontSize: 11, color: "var(--lp-mute)" }}>Updated {o.updated}</div>
            </div>
          </div>
          <Stars n={o.quality} />
        </div>

        {/* Pricing block */}
        <div style={{
          display: "grid",
          gridTemplateColumns: yourPrice ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: 1, background: "var(--lp-line-2)", border: "1px solid var(--lp-line-2)",
          borderRadius: 10, overflow: "hidden",
        }}>
          <div style={priceCell}>
            <div style={priceLbl}>Marketplace price <Icon name="info" size={11} color="var(--lp-mute-2)" /></div>
            <div style={priceVal}>{fmt.range(o.minPrice, o.maxPrice)}</div>
          </div>
          <div style={{ ...priceCell, background: "var(--lp-accent-50)" }}>
            <div style={priceLbl}>Our price <Icon name="info" size={11} color="var(--lp-mute-2)" /></div>
            <div style={{ ...priceVal, color: "var(--lp-accent-700)" }}>{fmt.price(ourPrice)}</div>
          </div>
          {yourPrice && (
            <div style={priceCell}>
              <div style={priceLbl}>Your price</div>
              <div style={priceVal}>{fmt.price(yourPrice)}</div>
              {cmp && <div style={{ marginTop: 4 }}><Pill color={cmp.color}>{cmp.label}</Pill></div>}
            </div>
          )}
        </div>

        {/* Editorial */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
          <div style={editRow}>
            <span style={editLbl}>Delivery guarantee</span>
            <span style={editVal}>{o.delivery} days</span>
          </div>
          <div style={editRow}>
            <span style={editLbl}>Avg. TAT</span>
            <span style={editVal}>{o.tat} days</span>
          </div>
          <div style={editRow}>
            <span style={editLbl}>Link type</span>
            <span style={{ ...editVal }}>
              <Pill color={linkGood ? "green" : "amber"}>
                <Icon name={linkGood ? "check" : "x"} size={10} /> {o.link}
              </Pill>
            </span>
          </div>
          <div style={editRow}>
            <span style={editLbl}>Source</span>
            <span style={editVal}>
              <Pill color="ink">{o.type === "API" ? "Live API" : o.type === "DB" ? "Synced" : "Vendor"}</Pill>
            </span>
          </div>
        </div>

        {/* Example post */}
        {o.example ? (
          <a href="#" onClick={e => e.preventDefault()} style={{
            display: "flex", alignItems: "center", gap: 10, padding: 10,
            border: "1px dashed var(--lp-line)", borderRadius: 8, textDecoration: "none",
            color: "var(--lp-ink-2)", background: "#fbfcfe",
          }}>
            <div style={{ width: 32, height: 24 }} className="lp-imgph" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--lp-mute)", fontWeight: 600 }}>Published example</div>
              <div className="lp-mono" style={{ fontSize: 11.5, color: "var(--lp-ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.example.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <Icon name="external" size={14} color="var(--lp-accent)" />
          </a>
        ) : (
          <div style={{ padding: 10, border: "1px dashed var(--lp-line)", borderRadius: 8, fontSize: 11.5, color: "var(--lp-mute)", textAlign: "center", background: "#fbfcfe" }}>
            No published example available
          </div>
        )}

        {/* Niche pricing */}
        {(o.gambling || o.crypto) && (
          <details style={{ borderTop: "1px solid var(--lp-line-2)", paddingTop: 10 }}>
            <summary style={{ cursor: "pointer", fontSize: 11, color: "var(--lp-mute)", fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", listStyle: "none" }}>
              Niche pricing ›
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontSize: 12 }}>
              {o.gambling && <div style={editRow}><span style={editLbl}>Gambling</span><span style={editVal} className="lp-mono">{fmt.range(o.gambling[0], o.gambling[1])}</span></div>}
              {o.crypto && <div style={editRow}><span style={editLbl}>Crypto</span><span style={editVal} className="lp-mono">{fmt.range(o.crypto[0], o.crypto[1])}</span></div>}
            </div>
          </details>
        )}

        {/* CTAs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button style={btn("primary", "sm")}>
            <Icon name="shield" size={13} /> Buy managed
          </button>
          <button style={btn("ghost", "sm")}>
            Buy direct <Icon name="external" size={12} />
          </button>
        </div>
      </div>
    );
  };

  const ExpandedPanel = ({ d }) => {
    const offers = (d.offers || []).slice().sort((a, b) => a.minPrice - b.minPrice);
    const top3 = offers.slice(0, 3);
    return (
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--lp-ink)" }}>Top 3 best prices</h3>
            <span style={{ fontSize: 12, color: "var(--lp-mute)" }}>{offers.length} marketplaces stock this domain</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("ghost", "sm")}>Show all ({offers.length})</button>
            <button style={btn("ghost", "sm")}><Icon name="filter" size={12} /> Filter</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {top3.map((o, i) => <MarketplaceCard key={i} o={o} bestPrice={offers[0].minPrice} yourPrice={d.yourPrice} />)}
        </div>
      </div>
    );
  };

  // ============== Results card wrapper ==============
  const Results = ({ count = 5, expandedIndex = 0, loading = false }) => (
    <section style={{
      background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 16,
      boxShadow: "var(--lp-shadow-1)", overflow: "hidden",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--lp-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Domain analysis results</h2>
          <Pill color="blue">{count} domains</Pill>
          {loading && <span style={{ fontSize: 12, color: "var(--lp-mute)" }}><span className="lp-spin" /> Streaming…</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn("ghost", "sm")}><Icon name="filter" size={12} /> Filter</button>
          <button style={btn("ghost", "sm")}><Icon name="download" size={12} /> Download CSV</button>
        </div>
      </header>
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead style={{ background: "#fafbfd" }}>
            <tr>
              <Th style={{ width: 36 }}></Th>
              <Th sortable>Domain</Th>
              <Th>Actions</Th>
              <Th sortable active dir="desc">Value</Th>
              <Th>Country</Th>
              <Th sortable>DR</Th>
              <Th sortable>Traffic</Th>
              <Th sortable>Keywords</Th>
              <Th>Category</Th>
            </tr>
          </thead>
          <tbody>
            {data.domains.slice(0, count).map((d, i) => (
              <DomainRow key={d.domain} d={d} expanded={i === expandedIndex} />
            ))}
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: 0 }}>
                  <SkeletonRow />
                  <SkeletonRow />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const SkeletonRow = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--lp-line-2)" }}>
      <div style={shimmer(20, 20, 6)} />
      <div style={{ flex: 1 }}>
        <div style={shimmer(140, 12, 4)} />
        <div style={{ ...shimmer(80, 10, 4), marginTop: 6 }} />
      </div>
      <div style={shimmer(110, 30, 8)} />
      <div style={shimmer(48, 22, 6)} />
      <div style={shimmer(32, 12, 4)} />
      <div style={shimmer(36, 12, 4)} />
      <div style={shimmer(48, 12, 4)} />
      <div style={shimmer(60, 12, 4)} />
      <div style={shimmer(110, 22, 999)} />
    </div>
  );

  // ============== Variation root (full layout) ==============
  const App = () => (
    <div className="lp-reset" style={{
      width: 1440, minHeight: 1100, background: "var(--lp-bg)",
      padding: "20px 32px 40px", fontFamily: "var(--lp-sans)",
    }}>
      <TopBar />
      <Hero domainCount={5} />
      <Results count={5} expandedIndex={0} />
    </div>
  );

  const TopBar = () => (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0 24px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
        <span style={{ marginLeft: 4, color: "var(--lp-mute)", fontSize: 12 }}>/ app / domain analysis</span>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {["Analyze", "Lists", "Orders", "Vendors", "Reports"].map((l, i) => (
          <a key={l} href="#" style={{
            padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            color: i === 0 ? "var(--lp-ink)" : "var(--lp-mute)",
            background: i === 0 ? "#eef0f4" : "transparent", textDecoration: "none",
          }}>{l}</a>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--lp-line)", margin: "0 10px" }} />
        <button style={btn("ghost", "sm")}><Icon name="search" size={13} /> Search</button>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: "linear-gradient(135deg, #2c64f0, #7c3aed)", marginLeft: 8 }} />
      </nav>
    </header>
  );

  return { App, Hero, Results, ExpandedPanel, MarketplaceCard, DomainRow, Pill, GradeBadge };
})();

// ============== shared style fns (used by V1 only) ==============
function btn(kind = "primary", size = "md") {
  const sizes = {
    sm: { padding: "7px 12px", fontSize: 12.5, gap: 6, height: 32 },
    md: { padding: "10px 14px", fontSize: 13.5, gap: 8, height: 40 },
  };
  const k = {
    primary: { bg: "var(--lp-ink)", fg: "#fff", border: "1px solid var(--lp-ink)" },
    ghost: { bg: "#fff", fg: "var(--lp-ink-2)", border: "1px solid var(--lp-line)" },
    disabled: { bg: "#f1f3f7", fg: "var(--lp-mute-2)", border: "1px solid var(--lp-line)", cursor: "not-allowed" },
  }[kind];
  return {
    display: "inline-flex", alignItems: "center", gap: sizes[size].gap,
    padding: sizes[size].padding, fontSize: sizes[size].fontSize,
    height: sizes[size].height, fontWeight: 600,
    background: k.bg, color: k.fg, border: k.border, borderRadius: 8,
    whiteSpace: "nowrap", cursor: k.cursor || "pointer",
    transition: "background .15s, transform .05s",
  };
}

function iconBtn(active) {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: "1px solid var(--lp-line)", background: active ? "#fdecea" : "#fff",
    color: active ? "#e11d48" : "var(--lp-mute)", display: "inline-flex",
    alignItems: "center", justifyContent: "center", cursor: "pointer",
  };
}

function chev(open) {
  return {
    width: 24, height: 24, borderRadius: 6, border: "1px solid var(--lp-line)",
    background: open ? "var(--lp-ink)" : "#fff",
    color: open ? "#fff" : "var(--lp-mute)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    transform: open ? "rotate(90deg)" : "rotate(0)",
    transition: "transform .15s, background .15s, color .15s",
  };
}

const lbl = { display: "block", fontSize: 11, color: "var(--lp-mute)", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 };
const chip = {
  padding: "6px 10px", borderRadius: 999, border: "1px dashed var(--lp-line)",
  background: "#fff", fontSize: 12, fontWeight: 600, color: "var(--lp-ink-3)",
  fontFamily: "var(--lp-mono)",
};
const priceCell = { padding: "12px 14px", background: "#fff", display: "flex", flexDirection: "column", gap: 4 };
const priceLbl = { fontSize: 10.5, color: "var(--lp-mute)", fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 };
const priceVal = { fontSize: 18, fontWeight: 700, color: "var(--lp-ink)", fontFamily: "var(--lp-mono)", fontVariantNumeric: "tabular-nums" };
const editRow = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed var(--lp-line-2)" };
const editLbl = { color: "var(--lp-mute)", fontSize: 11, fontWeight: 600 };
const editVal = { color: "var(--lp-ink-2)", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" };

function shimmer(w, h, r) {
  return {
    width: w, height: h, borderRadius: r,
    background: "linear-gradient(90deg, #eef0f4 0%, #f6f7f9 50%, #eef0f4 100%)",
    backgroundSize: "200% 100%", animation: "lp-shimmer 1.4s infinite",
  };
}

window.V1 = V1;
