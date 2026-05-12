// Order Detail (client side) — with per-order chat
// Two-column layout: left = order details + timeline, right = conversation thread
// Chat is the centrepiece — clearly threaded, with attachments, system events, typing indicator

const OrderDetail = (() => {
  const { Icon, fmt } = LP;
  const order = LP_ORDER_FLOW.orders[0]; // ord_2k4f1 — writing in progress
  const thread = LP_ORDER_FLOW.chatThread;

  // ============ Status timeline ============
  const STAGES = [
    { id: "pending", label: "Order placed", icon: "check" },
    { id: "writing", label: "Writing", icon: "edit" },
    { id: "approved", label: "Approved", icon: "check" },
    { id: "waiting", label: "On marketplace", icon: "clock" },
    { id: "published", label: "Live · URL delivered", icon: "external" },
    { id: "invoiced", label: "Payment due", icon: "shield" },
  ];

  const Timeline = () => {
    const currentIdx = STAGES.findIndex(s => s.id === order.status);
    return (
      <div style={{
        background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14,
        padding: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Progress</h3>
          <span style={{
            padding: "3px 10px", background: "#dbeafe", color: "#1e40af",
            fontSize: 11, fontWeight: 700, borderRadius: 999,
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <span className="lp-spin sm" style={{ borderColor: "#bfdbfe", borderTopColor: "#1e40af" }} /> In progress
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {STAGES.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const color = done ? "var(--lp-good)" : active ? "var(--lp-accent)" : "var(--lp-line)";
            const fg = done ? "var(--lp-good)" : active ? "var(--lp-accent)" : "var(--lp-mute)";
            return (
              <React.Fragment key={s.id}>
                <div style={{ flex: "0 0 auto", textAlign: "center" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999, margin: "0 auto",
                    background: done ? "var(--lp-good)" : active ? "var(--lp-accent-50)" : "#fff",
                    border: "2px solid " + color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: done ? "#fff" : fg,
                  }}>
                    <Icon name={s.icon} size={13} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: fg, marginTop: 6 }}>{s.label}</div>
                </div>
                {i < STAGES.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, background: i < currentIdx ? "var(--lp-good)" : "var(--lp-line)",
                    alignSelf: "center", marginTop: -22,
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{
          marginTop: 18, padding: "10px 14px", borderRadius: 10,
          background: "var(--lp-accent-50)", display: "flex", alignItems: "center", gap: 10,
          border: "1px solid #c7d8fb",
        }}>
          <Icon name="clock" size={16} color="var(--lp-accent-700)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--lp-ink)" }}>
              Maya is drafting your article
            </div>
            <div style={{ fontSize: 11.5, color: "var(--lp-ink-3)" }}>
              First draft expected <strong>Friday EOD</strong> · ETA 2 days
            </div>
          </div>
          <button style={{
            padding: "6px 12px", borderRadius: 7,
            border: "1px solid var(--lp-accent)", background: "#fff",
            color: "var(--lp-accent-700)", fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>View latest draft</button>
        </div>
      </div>
    );
  };

  // ============ Order details card ============
  const Details = () => (
    <div style={{
      background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14,
      padding: 22,
    }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>Order details</h3>
      <KV label="Order ID" value={order.id} mono />
      <KV label="Domain" value={
        <span>
          <span style={{ fontFamily: "var(--lp-mono)", fontWeight: 700 }}>{order.domain}</span>
          <span style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "var(--lp-bg-3)", color: "var(--lp-ink-2)", fontWeight: 700 }}>DR {order.dr}</span>
        </span>
      } />
      <KV label="Marketplace" value={order.marketplace} />
      <KV label="Article title" value={order.title} />
      <KV label="Target URL" value={
        <a href="#" onClick={e => e.preventDefault()} style={{
          fontFamily: "var(--lp-mono)", fontSize: 12, color: "var(--lp-accent)",
          textDecoration: "none",
        }}>{order.target} ↗</a>
      } />
      <KV label="Anchor text" value={`"${order.anchor}"`} mono />
      <KV label="Word count" value={`${order.wordCount} words`} />
      <KV label="Editor" value={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 999,
            background: "linear-gradient(135deg, #f59e0b, #ef4444)",
          }} />
          <span style={{ fontWeight: 700 }}>{order.assignee}</span>
        </span>
      } />
      <div style={{ height: 1, background: "var(--lp-line-2)", margin: "12px 0" }} />
      <KV label="Guest post" value={`$${order.gpPrice}`} mono />
      <KV label="Content (750w)" value={`$${order.contentPrice}`} mono />
      <KV label="Management fee" value={`$${(order.total - order.gpPrice - order.contentPrice).toFixed(2)}`} mono />
      <KV label="Total" value={`$${order.total}`} mono />
      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, background: "var(--lp-bg-3)", border: "1px dashed var(--lp-line)", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="shield" size={13} color="var(--lp-mute)" />
        <div style={{ fontSize: 11, color: "var(--lp-ink-3)", lineHeight: 1.4 }}>
          <strong>Not yet invoiced.</strong> You'll be billed once the article goes live and we deliver the publication URL.
        </div>
      </div>
    </div>
  );

  // ============ CHAT — the centerpiece ============
  const Avatar = ({ kind }) => {
    if (kind === "lp") return (
      <div style={{
        width: 36, height: 36, borderRadius: 999, flex: "0 0 auto",
        background: "linear-gradient(135deg, #2c64f0, #4f46e5)",
        color: "#fff", fontWeight: 800, fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px solid #fff", boxShadow: "0 0 0 1px var(--lp-line)",
      }}>MR</div>
    );
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 999, flex: "0 0 auto",
        background: "linear-gradient(135deg, #f59e0b, #ef4444)",
        color: "#fff", fontWeight: 800, fontSize: 13,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px solid #fff", boxShadow: "0 0 0 1px var(--lp-line)",
      }}>AK</div>
    );
  };

  const Bubble = ({ msg }) => {
    const mine = msg.from === "client";
    return (
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        flexDirection: mine ? "row-reverse" : "row",
      }}>
        <Avatar kind={msg.from} />
        <div style={{ maxWidth: 460, display: "flex", flexDirection: "column", gap: 6, alignItems: mine ? "flex-end" : "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--lp-ink)" }}>{msg.who}</span>
            <span style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 4, fontWeight: 700,
              background: msg.from === "lp" ? "var(--lp-accent-50)" : "var(--lp-bg-3)",
              color: msg.from === "lp" ? "var(--lp-accent-700)" : "var(--lp-mute)",
            }}>{msg.role}</span>
            <span style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>{msg.at}</span>
          </div>
          <div style={{
            padding: "11px 14px", borderRadius: 14,
            borderTopLeftRadius: mine ? 14 : 4, borderTopRightRadius: mine ? 4 : 14,
            background: mine ? "var(--lp-accent)" : "#fff",
            color: mine ? "#fff" : "var(--lp-ink)",
            fontSize: 13.5, lineHeight: 1.5,
            border: mine ? "none" : "1px solid var(--lp-line)",
            boxShadow: mine ? "0 1px 0 var(--lp-accent-700)" : "0 1px 0 rgba(15,22,32,0.02)",
          }}>
            {msg.text}
          </div>
          {msg.attachment && (
            <Attachment a={msg.attachment} mine={mine} />
          )}
        </div>
      </div>
    );
  };

  const Attachment = ({ a, mine }) => {
    if (a.type === "doc") return (
      <a href="#" onClick={e => e.preventDefault()} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 10, textDecoration: "none",
        background: "#fff", border: "1px solid var(--lp-line)",
        color: "var(--lp-ink)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: "var(--lp-accent-50)",
          color: "var(--lp-accent)", display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon name="download" size={15} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.name}</div>
          <div style={{ fontSize: 10.5, color: "var(--lp-mute)" }}>Word doc · {a.size} · click to download</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--lp-accent-700)" }}>Review →</span>
      </a>
    );
    if (a.type === "url") return (
      <a href="#" onClick={e => e.preventDefault()} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 10, textDecoration: "none",
        background: mine ? "rgba(255,255,255,0.12)" : "var(--lp-bg-3)",
        border: "1px solid " + (mine ? "rgba(255,255,255,0.18)" : "var(--lp-line)"),
        color: mine ? "#fff" : "var(--lp-ink)",
        maxWidth: 320,
      }}>
        <Icon name="external" size={14} color={mine ? "#fff" : "var(--lp-accent)"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>{a.title}</div>
          <div style={{ fontSize: 10.5, fontFamily: "var(--lp-mono)", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.url}</div>
        </div>
      </a>
    );
    return null;
  };

  const SystemEvent = ({ children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px" }}>
      <div style={{ flex: 1, height: 1, background: "var(--lp-line)" }} />
      <span style={{
        padding: "3px 12px", borderRadius: 999, background: "var(--lp-bg-3)",
        fontSize: 10.5, color: "var(--lp-mute)", fontWeight: 700, letterSpacing: 0.3,
      }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--lp-line)" }} />
    </div>
  );

  const Chat = () => (
    <div style={{
      background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 14,
      display: "flex", flexDirection: "column", height: 760, overflow: "hidden",
    }}>
      {/* Chat header */}
      <header style={{
        padding: "16px 20px", borderBottom: "1px solid var(--lp-line)",
        display: "flex", alignItems: "center", gap: 12, background: "#fafbfd",
      }}>
        <div style={{ display: "flex", marginLeft: -4 }}>
          <Avatar kind="lp" />
          <div style={{ marginLeft: -10 }}>
            <Avatar kind="client" />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Order conversation</h3>
            <span style={{
              padding: "1px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
              background: "#dcfce7", color: "#166534",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#16a34a" }} />
              Maya online
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--lp-mute)", marginTop: 2 }}>
            You & <strong>Maya R.</strong> (Editor) · Linkpricer support replies in &lt; 2 hours · {order.id}
          </div>
        </div>
        <button style={iconCircle()}><Icon name="search" size={13} /></button>
        <button style={iconCircle()}><Icon name="info" size={13} /></button>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          background: "#fff", border: "1px solid var(--lp-line)",
          color: "#a3372e", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          <Icon name="flag" size={12} color="#a3372e" />
          Report
        </button>
      </header>

      {/* Report panel — opens from header Report button */}
      <div style={{
        padding: "14px 20px", background: "#fef6f5", borderBottom: "1px solid #f4d3ce",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "#fde2dd", color: "#a3372e",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="flag" size={13} color="#a3372e" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7a2a23" }}>Report this order to Linkpricer</div>
            <div style={{ fontSize: 11.5, color: "#a3372e" }}>
              We'll review the conversation, draft, and any files within 2 business hours and reply privately — the editor won't see this.
            </div>
          </div>
          <button style={{
            background: "transparent", border: "none", color: "#a3372e",
            fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 4,
          }}>Dismiss</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            { label: "Late delivery", active: false },
            { label: "Quality below brief", active: true },
            { label: "Off-topic / not in niche", active: false },
            { label: "Editor unresponsive", active: false },
            { label: "Marketplace pulled the link", active: false },
            { label: "Other", active: false },
          ].map(c => (
            <span key={c.label} style={{
              padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
              background: c.active ? "#a3372e" : "#fff",
              color: c.active ? "#fff" : "#7a2a23",
              border: "1px solid " + (c.active ? "#a3372e" : "#f4d3ce"),
              cursor: "pointer",
            }}>{c.label}</span>
          ))}
        </div>

        <div style={{
          background: "#fff", border: "1px solid #f4d3ce", borderRadius: 10, padding: 12,
        }}>
          <textarea
            defaultValue={"Draft I received in section 3 reads more like an ad for our product than an editorial piece — Maya promised a case-study angle and the structure has drifted. Can support help re-align with the original brief or reassign?"}
            style={{
              width: "100%", minHeight: 84, border: "none", outline: "none", resize: "none",
              fontFamily: "inherit", fontSize: 12.5, color: "var(--lp-ink)", lineHeight: 1.5,
              background: "transparent",
            }}
          />
          <div style={{
            display: "flex", alignItems: "center", gap: 10, paddingTop: 10,
            borderTop: "1px solid var(--lp-line-2)",
          }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
              background: "#fff", border: "1px solid var(--lp-line)", color: "var(--lp-ink-2)", cursor: "pointer",
            }}>
              <Icon name="paperclip" size={11} /> Attach draft / screenshot
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--lp-ink-2)", cursor: "pointer" }}>
              <input type="checkbox" defaultChecked /> Pause delivery while support reviews
            </label>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--lp-mute)" }}>Private to support · editor not notified</span>
            <button style={{
              padding: "7px 14px", borderRadius: 8, background: "#a3372e", color: "#fff",
              border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Icon name="check" size={12} /> Submit report
            </button>
          </div>
        </div>
      </div>

      {/* Pinned context */}
      <div style={{
        padding: "10px 20px", background: "#fcfaf6", borderBottom: "1px solid var(--lp-line-2)",
        display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--lp-ink-2)",
      }}>
        <Icon name="info" size={13} color="#a35d00" />
        <span>
          Conversation is tied to <strong style={{ fontFamily: "var(--lp-mono)" }}>{order.domain}</strong> · Article: <em>"{order.title}"</em>
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--lp-mute)" }}>
          Files & messages stored for 2 years per agreement
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 18,
        background: "var(--lp-bg)",
      }}>
        <SystemEvent>Order placed · May 4, 14:00</SystemEvent>
        <Bubble msg={thread[0]} />
        <Bubble msg={thread[1]} />
        <Bubble msg={thread[2]} />
        <SystemEvent>Status changed: Pending → Writing</SystemEvent>
        <Bubble msg={thread[3]} />
        <Bubble msg={thread[4]} />
        <SystemEvent>Today · 8h ago</SystemEvent>
        <Bubble msg={thread[5]} />

        {/* Typing indicator */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Avatar kind="lp" />
          <div style={{
            padding: "12px 16px", borderRadius: 14, borderTopLeftRadius: 4,
            background: "#fff", border: "1px solid var(--lp-line)",
            display: "inline-flex", gap: 4,
          }}>
            <Dot delay={0} />
            <Dot delay={0.15} />
            <Dot delay={0.3} />
          </div>
        </div>
      </div>

      {/* Composer */}
      <div style={{
        padding: 14, borderTop: "1px solid var(--lp-line)", background: "#fff",
      }}>
        {/* Quick actions */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { l: "👍 Looks good, ship it", primary: true },
            { l: "Request revisions" },
            { l: "Schedule a call" },
            { l: "Approve & publish" },
          ].map(q => (
            <button key={q.l} style={{
              padding: "6px 11px", borderRadius: 999,
              background: q.primary ? "var(--lp-accent-50)" : "#fff",
              color: q.primary ? "var(--lp-accent-700)" : "var(--lp-ink-2)",
              border: "1px solid " + (q.primary ? "var(--lp-accent)" : "var(--lp-line)"),
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{q.l}</button>
          ))}
        </div>
        <div style={{
          border: "1.5px solid var(--lp-accent)",
          borderRadius: 12, padding: "10px 12px",
          boxShadow: "0 0 0 3px var(--lp-accent-50)",
        }}>
          <textarea
            rows={2}
            placeholder="Reply to Maya — drag files, paste URLs, @mention the team…"
            defaultValue="Reading the draft now — small note: in section 3, can we change the example from 'B2B SaaS' to 'B2B fintech'? Closer to our ICP."
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: 13.5, fontFamily: "var(--lp-sans)", color: "var(--lp-ink)",
              minHeight: 40, background: "transparent",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <button style={composerIcon()}><Icon name="upload" size={13} /></button>
            <button style={composerIcon()}><Icon name="external" size={13} /></button>
            <button style={composerIcon()}>@</button>
            <button style={composerIcon()}>✨</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--lp-mute)" }}>
              <kbd style={kbdStyle()}>⌘</kbd> + <kbd style={kbdStyle()}>↵</kbd> to send
            </span>
            <button style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: "var(--lp-ink)", color: "#fff",
              fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              Send <Icon name="external" size={11} style={{ transform: "rotate(-90deg)" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const Dot = ({ delay }) => (
    <span style={{
      width: 6, height: 6, borderRadius: 999, background: "var(--lp-mute)",
      animation: "lp-typing 1.2s infinite",
      animationDelay: delay + "s",
    }} />
  );

  const App = () => (
    <div className="lp-reset" style={{
      width: 1500, minHeight: 1100, background: "var(--lp-bg)", padding: "20px 28px 40px",
      fontFamily: "var(--lp-sans)",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "var(--lp-ink)" }}>Linkpricer</span>
          <span style={{ marginLeft: 14, color: "var(--lp-mute)", fontSize: 12 }}>
            <a href="#" onClick={e => e.preventDefault()} style={{ color: "var(--lp-mute)", textDecoration: "none" }}>Orders</a>
            <span style={{ margin: "0 8px" }}>›</span>
            <span style={{ color: "var(--lp-ink-2)", fontFamily: "var(--lp-mono)" }}>{order.id}</span>
          </span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {["Analyze", "Lists", "Orders", "Vendors"].map((l, i) => (
            <a key={l} href="#" style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: i === 2 ? "var(--lp-ink)" : "var(--lp-mute)",
              background: i === 2 ? "var(--lp-bg-3)" : "transparent",
              textDecoration: "none",
            }}>{l}</a>
          ))}
        </nav>
      </header>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.5, marginBottom: 6, fontFamily: "var(--lp-mono)" }}>
            ORDER · {order.id}
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "var(--lp-ink)", lineHeight: 1.1 }}>
            {order.title}
          </h1>
          <div style={{ fontSize: 13, color: "var(--lp-mute)", marginTop: 6 }}>
            <span style={{ fontFamily: "var(--lp-mono)", color: "var(--lp-ink-2)", fontWeight: 700 }}>{order.domain}</span>
            {" "}·{" "}
            via {order.marketplace} · placed {order.createdAt} · 750 words by Linkpricer
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--lp-line)", background: "#fff", color: "var(--lp-ink-2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon name="download" size={12} /> Download brief PDF
          </button>
          <button style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--lp-line)", background: "#fff", color: "var(--lp-ink-2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Icon name="bolt" size={12} /> Reorder this domain
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 460px", gap: 18, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Timeline />
          <Details />
        </div>
        <Chat />
      </div>
    </div>
  );

  return { App };
})();

function KV({ label, value, mono }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "5px 0" }}>
      <span style={{ fontSize: 11.5, color: "var(--lp-mute)", fontWeight: 600 }}>{label}</span>
      <span style={{
        fontSize: 12.5, color: "var(--lp-ink)", fontWeight: 600,
        fontFamily: mono ? "var(--lp-mono)" : "var(--lp-sans)",
        textAlign: "right", maxWidth: "60%",
      }}>{value}</span>
    </div>
  );
}
function iconCircle() {
  return {
    width: 32, height: 32, borderRadius: 8, border: "1px solid var(--lp-line)",
    background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "var(--lp-mute)", cursor: "pointer",
  };
}
function composerIcon() {
  return {
    width: 30, height: 30, borderRadius: 7, border: "1px solid transparent",
    background: "transparent", color: "var(--lp-mute)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 13, fontWeight: 700,
  };
}
function kbdStyle() {
  return {
    padding: "0 5px", borderRadius: 4, fontSize: 10.5,
    background: "var(--lp-bg-3)", border: "1px solid var(--lp-line)", color: "var(--lp-mute)",
    fontFamily: "var(--lp-mono)",
  };
}

window.OrderDetail = OrderDetail;
