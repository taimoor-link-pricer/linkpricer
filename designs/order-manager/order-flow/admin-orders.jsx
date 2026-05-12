// Admin Order Management — back-office page
// Power-user table: inline status editing, link monitoring badges, smart empty cells

const AdminOrders = (() => {
  const { Icon, fmt } = LP;
  const orders = LP_ORDER_FLOW.orders;

  const STATUS = {
    pending: { label: "Pending", bg: "#fdf2dd", fg: "#a35d00", dot: "#d97706" },
    writing: { label: "Writing", bg: "#dbeafe", fg: "#1e40af", dot: "#2563eb" },
    approved: { label: "Approved", bg: "#dcfce7", fg: "#166534", dot: "#16a34a" },
    waiting: { label: "Waiting for publication", bg: "#ede9fe", fg: "#5b21b6", dot: "#7c3aed" },
    published: { label: "Published", bg: "#d1fae5", fg: "#065f46", dot: "#059669" },
    cancelled: { label: "Cancelled", bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626" },
  };

  const MONITOR = {
    pending: { label: "Pending", icon: "clock", bg: "#f1f5f9", fg: "#475569" },
    active: { label: "Active", icon: "check", bg: "#d1fae5", fg: "#065f46" },
    missing: { label: "Missing", icon: "x", bg: "#fee2e2", fg: "#991b1b" },
    modified: { label: "Modified", icon: "info", bg: "#fef3c7", fg: "#92400e" },
    error: { label: "Error", icon: "x", bg: "#fee2e2", fg: "#991b1b" },
  };

  const StatusBadge = ({ status, editing = false }) => {
    const s = STATUS[status];
    return (
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
        background: s.bg, color: s.fg,
        border: "1px solid " + (editing ? s.fg : "transparent"),
        cursor: "pointer", letterSpacing: 0.1, position: "relative",
        boxShadow: editing ? "0 0 0 3px rgba(15,22,32,0.06)" : "none",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }} />
        <span>{s.label}</span>
        <Icon name="chevronDown" size={10} color={s.fg} />
      </button>
    );
  };

  const StatusDropdown = () => (
    <div style={{
      position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
      background: "#fff", borderRadius: 10, minWidth: 220,
      border: "1px solid var(--lp-line)",
      boxShadow: "0 12px 28px rgba(15,22,32,0.14)",
      overflow: "hidden",
    }}>
      <header style={{
        padding: "8px 12px", borderBottom: "1px solid var(--lp-line-2)",
        fontSize: 10.5, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.4, textTransform: "uppercase",
      }}>Change status</header>
      {Object.entries(STATUS).map(([k, s]) => (
        <button key={k} style={{
          width: "100%", padding: "9px 12px", textAlign: "left", border: "none",
          background: k === "writing" ? "var(--lp-bg-3)" : "#fff",
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          fontSize: 12.5, color: "var(--lp-ink-2)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: s.dot }} />
          <span style={{ fontWeight: 600 }}>{s.label}</span>
          {k === "writing" && <span style={{ marginLeft: "auto", color: "var(--lp-mute)", fontSize: 10.5 }}>current</span>}
        </button>
      ))}
    </div>
  );

  const MonitorBadge = ({ status, lastCheck, nextCheck, note }) => {
    if (!status) return (
      <button style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
        color: "var(--lp-mute)", background: "transparent",
        border: "1px dashed var(--lp-line)", cursor: "pointer",
      }}>
        <Icon name="bolt" size={10} /> Start monitoring
      </button>
    );
    const m = MONITOR[status];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: m.bg, color: m.fg, alignSelf: "flex-start",
        }}>
          <Icon name={m.icon} size={10} /> {m.label}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>
          chk {lastCheck} · next {nextCheck}
        </span>
      </div>
    );
  };

  const IndexedBadge = ({ indexed }) => {
    if (indexed === null) return <span style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>—</span>;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 5, fontSize: 10.5, fontWeight: 700,
        background: indexed ? "#dcfce7" : "#fef3c7",
        color: indexed ? "#166534" : "#92400e",
      }}>
        {indexed ? "✓ Indexed" : "⏳ Not indexed"}
      </span>
    );
  };

  const FilterBar = () => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
      padding: "12px 16px", background: "#fff",
      border: "1px solid var(--lp-line)", borderRadius: 12,
    }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderRadius: 8, background: "var(--lp-bg-3)",
        border: "1px solid var(--lp-line-2)",
      }}>
        <Icon name="search" size={14} color="var(--lp-mute)" />
        <input
          defaultValue=""
          placeholder="Search by email, domain, article title or order ID…"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--lp-ink)" }}
        />
        <kbd style={{
          padding: "1px 6px", borderRadius: 4, fontSize: 10.5,
          background: "#fff", border: "1px solid var(--lp-line)", color: "var(--lp-mute)",
          fontFamily: "var(--lp-mono)",
        }}>⌘K</kbd>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {[
          { l: "All", n: orders.length, active: true },
          { l: "Pending", n: orders.filter(o => o.status === "pending").length },
          { l: "Writing", n: orders.filter(o => o.status === "writing").length },
          { l: "Waiting", n: orders.filter(o => o.status === "waiting").length },
          { l: "Published", n: orders.filter(o => o.status === "published").length },
          { l: "Cancelled", n: orders.filter(o => o.status === "cancelled").length },
        ].map(t => (
          <button key={t.l} style={{
            padding: "7px 12px", borderRadius: 8,
            background: t.active ? "var(--lp-ink)" : "#fff",
            color: t.active ? "#fff" : "var(--lp-ink-2)",
            border: "1px solid " + (t.active ? "var(--lp-ink)" : "var(--lp-line)"),
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {t.l}
            <span style={{
              padding: "0 6px", borderRadius: 4,
              background: t.active ? "rgba(255,255,255,0.15)" : "var(--lp-bg-3)",
              color: t.active ? "#fff" : "var(--lp-mute)",
              fontSize: 10.5, fontWeight: 700,
            }}>{t.n}</span>
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 24, background: "var(--lp-line)" }} />

      <button style={{
        padding: "7px 12px", borderRadius: 8, background: "#fff",
        border: "1px solid var(--lp-line)", color: "var(--lp-ink-2)",
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <Icon name="filter" size={12} /> More filters
      </button>
    </div>
  );

  const OrderRow = ({ o, isStatusOpen = false }) => {
    const s = STATUS[o.status];
    return (
      <tr style={{ background: "#fff", verticalAlign: "top" }}>
        <td style={cell()}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--lp-ink)" }}>{o.clientName}</span>
            <span style={{ fontSize: 11.5, color: "var(--lp-mute)", fontFamily: "var(--lp-mono)" }}>{o.client}</span>
            <span style={{ fontSize: 10.5, color: "var(--lp-mute)", marginTop: 2 }}>{o.id} · {o.createdAt}</span>
          </div>
        </td>
        <td style={cell()}>
          <div style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "var(--lp-mono)" }}>{o.domain}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{
              padding: "1px 6px", background: "var(--lp-bg-3)", borderRadius: 4,
              fontSize: 10.5, fontWeight: 700, color: "var(--lp-ink-2)", fontFamily: "var(--lp-mono)",
            }}>DR {o.dr}</span>
            <span style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>{o.marketplace}</span>
          </div>
        </td>
        <td style={cell({ maxWidth: 220 })}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lp-ink)", lineHeight: 1.35 }}>
            {o.title}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--lp-mute)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span>{o.contentOption}</span>
            {o.wordCount && <span>· {o.wordCount} words</span>}
            <span>· {o.niche}</span>
          </div>
        </td>
        <td style={cell()}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--lp-mono)", color: "var(--lp-ink)", fontVariantNumeric: "tabular-nums" }}>
            {o.currency === "EUR" ? "€" : "$"}{o.total.toLocaleString()}
          </div>
          <span style={{
            display: "inline-block", padding: "1px 6px", marginTop: 3,
            background: o.currency === "EUR" ? "#dbeafe" : "#dcfce7",
            color: o.currency === "EUR" ? "#1e40af" : "#166534",
            fontSize: 10, fontWeight: 700, borderRadius: 4,
          }}>{o.currency}</span>
        </td>
        <td style={{ ...cell(), position: "relative" }}>
          <StatusBadge status={o.status} editing={isStatusOpen} />
          {isStatusOpen && <StatusDropdown />}
        </td>
        <td style={cell()}>
          <MonitorBadge status={o.monitor} lastCheck={o.lastCheck} nextCheck={o.nextCheck} />
          {o.status === "published" && (
            <div style={{ marginTop: 4 }}>
              <IndexedBadge indexed={o.indexed} />
            </div>
          )}
        </td>
        <td style={cell({ maxWidth: 240 })}>
          {o.publishedUrl ? (
            <div>
              <a href="#" onClick={e => e.preventDefault()} style={{
                fontSize: 11.5, color: "var(--lp-accent)", fontFamily: "var(--lp-mono)",
                textDecoration: "none", display: "block",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{o.publishedUrl}</a>
              <button style={editLink()}><Icon name="edit" size={10} /> Edit</button>
            </div>
          ) : (
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 9px", borderRadius: 6,
              background: "var(--lp-accent-50)", color: "var(--lp-accent-700)",
              border: "1px dashed var(--lp-accent)", fontSize: 11.5, fontWeight: 700,
              cursor: "pointer",
            }}>+ Add URL →</button>
          )}
        </td>
        <td style={cell()}>
          <div style={{ display: "flex", gap: 4 }}>
            <IconBtn icon="search" tooltip="View details" />
            <IconBtn icon="download" tooltip="Download content" />
            <IconBtn icon="edit" tooltip="Edit notes" />
            <IconBtn icon="bolt" tooltip="Start monitoring" />
          </div>
        </td>
      </tr>
    );
  };

  const App = ({ openStatusFor = "ord_2k4f1" } = {}) => (
    <div className="lp-reset" style={{
      width: 1500, minHeight: 1100, background: "var(--lp-bg)", padding: "20px 28px 40px",
      fontFamily: "var(--lp-sans)",
    }}>
      {/* Mini admin shell */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 0 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
          <span style={{
            marginLeft: 8, padding: "2px 8px", borderRadius: 4,
            background: "var(--lp-ink)", color: "#fff",
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          }}>ADMIN</span>
          <span style={{ marginLeft: 14, color: "var(--lp-mute)", fontSize: 12 }}>/ admin / orders</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["Orders", "Users", "Marketplaces", "Reports", "Settings"].map((l, i) => (
            <a key={l} href="#" style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: i === 0 ? "var(--lp-ink)" : "var(--lp-mute)",
              background: i === 0 ? "var(--lp-bg-3)" : "transparent",
              textDecoration: "none",
            }}>{l}</a>
          ))}
        </nav>
      </header>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.6, color: "var(--lp-ink)" }}>
            Order management
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--lp-mute)", fontSize: 13 }}>
            Process, fulfill and track every customer order across the marketplace network.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={ghostBtn()}><Icon name="filter" size={12} /> Saved views</button>
          <button style={ghostBtn()}><Icon name="download" size={12} /> Export orders</button>
          <button style={{ ...ghostBtn(), background: "var(--lp-ink)", color: "#fff", border: "none" }}>
            <Icon name="user" size={12} /> + New manual order
          </button>
        </div>
      </div>

      {/* KPIs strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { l: "Open orders", v: "47", d: "12 awaiting publication", color: "var(--lp-accent)" },
          { l: "Past 30d revenue", v: "$48,210", d: "+18% vs last month", color: "var(--lp-good)" },
          { l: "Avg fulfillment", v: "6.2 days", d: "-0.8d vs last month", color: "var(--lp-good)" },
          { l: "Live monitored links", v: "312", d: "4 missing · 2 modified", color: "#a35d00" },
          { l: "SLA breaches (7d)", v: "2", d: "Both resolved today", color: "var(--lp-bad)" },
        ].map(k => (
          <div key={k.l} style={{
            padding: "12px 14px", background: "#fff", borderRadius: 10,
            border: "1px solid var(--lp-line)",
          }}>
            <div style={{ fontSize: 10.5, color: "var(--lp-mute)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--lp-mono)", letterSpacing: -0.4, marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: k.color, fontWeight: 700, marginTop: 2 }}>{k.d}</div>
          </div>
        ))}
      </div>

      <FilterBar />

      {/* Orders table */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "1px solid var(--lp-line)", overflow: "visible",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--lp-bg-3)" }}>
              {["Client", "Domain", "Article", "Total", "Status", "Link monitor", "Published URL", "Actions"].map(h => (
                <th key={h} style={th()}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <OrderRow key={o.id} o={o} isStatusOpen={o.id === openStatusFor} />
            ))}
          </tbody>
        </table>
        <footer style={{
          padding: "12px 16px", borderTop: "1px solid var(--lp-line-2)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, color: "var(--lp-mute)",
        }}>
          <span>Showing 8 of 47 orders</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={ghostBtn()}>‹ Prev</button>
            <button style={{ ...ghostBtn(), background: "var(--lp-ink)", color: "#fff", border: "none" }}>1</button>
            <button style={ghostBtn()}>2</button>
            <button style={ghostBtn()}>3</button>
            <button style={ghostBtn()}>Next ›</button>
          </div>
        </footer>
      </div>
    </div>
  );

  return { App };
})();

function cell(opts = {}) {
  return {
    padding: "14px 14px", borderBottom: "1px solid var(--lp-line-2)",
    verticalAlign: "top", maxWidth: opts.maxWidth, color: "var(--lp-ink-2)",
  };
}
function th() {
  return {
    padding: "10px 14px", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
    textTransform: "uppercase", color: "var(--lp-mute)", textAlign: "left",
    borderBottom: "1px solid var(--lp-line)",
  };
}
function ghostBtn() {
  return {
    padding: "6px 10px", borderRadius: 7, border: "1px solid var(--lp-line)",
    background: "#fff", color: "var(--lp-ink-2)", fontSize: 12, fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
  };
}
function editLink() {
  return {
    display: "inline-flex", alignItems: "center", gap: 4, marginTop: 3,
    padding: "1px 6px", borderRadius: 4, background: "transparent", border: "none",
    color: "var(--lp-mute)", fontSize: 10, fontWeight: 600, cursor: "pointer",
  };
}
function IconBtn({ icon, tooltip }) {
  return (
    <button title={tooltip} style={{
      width: 28, height: 28, borderRadius: 7, background: "#fff",
      border: "1px solid var(--lp-line)", color: "var(--lp-ink-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
    }}><LP.Icon name={icon} size={12} /></button>
  );
}

window.AdminOrders = AdminOrders;
