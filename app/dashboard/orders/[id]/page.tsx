"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

function LoadingSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f6f8" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e8eaed", borderTopColor: "#0052cc", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type OrderStatus = "pending" | "writing" | "approved" | "waiting" | "published" | "invoiced";

const STAGES: { id: OrderStatus; label: string }[] = [
  { id: "pending",   label: "Order placed" },
  { id: "writing",   label: "Writing" },
  { id: "approved",  label: "Approved" },
  { id: "waiting",   label: "On marketplace" },
  { id: "published", label: "Live · URL delivered" },
  { id: "invoiced",  label: "Payment due" },
];

interface Message {
  id: string;
  type: "client" | "admin" | "system";
  who?: string;
  role?: string;
  at?: string;
  text?: string;
  attachment?: { type: "doc"; name: string; size: string } | { type: "url"; title: string; url: string };
}

const SAMPLE_MESSAGES: Message[] = [
  {
    id: "m1", type: "system",
    text: "Order placed · May 4, 14:00",
  },
  {
    id: "m2", type: "admin", who: "Maya R.", role: "Editor", at: "May 4, 14:12",
    text: "Hi! I've picked up your order and I'm reviewing the brief now. I'll send a structure outline before I start writing so you can confirm the angle. Expected first draft: Friday EOD.",
  },
  {
    id: "m3", type: "client", who: "You", role: "Client", at: "May 4, 14:28",
    text: "Great, thank you! Just to confirm — we'd prefer a case-study angle rather than a listicle. The target audience is B2B fintech decision-makers.",
  },
  {
    id: "m4", type: "admin", who: "Maya R.", role: "Editor", at: "May 4, 14:45",
    text: "Noted — case-study angle, B2B fintech focus. I'll draft the outline with that framing. Here's a previous piece I did in the same niche for reference:",
    attachment: { type: "url", title: "How Stripe Scaled Their Compliance Stack", url: "https://techcrunch.com/2024/stripe-compliance" },
  },
  {
    id: "m5", type: "system",
    text: "Status changed: Pending → Writing",
  },
  {
    id: "m6", type: "admin", who: "Maya R.", role: "Editor", at: "May 6, 09:30",
    text: "First draft is ready for your review! The article follows the case-study structure we agreed on. Please check section 3 in particular — I used an Acme reference there which you may want to swap with your own example.",
    attachment: { type: "doc", name: "Draft_v1_techcrunch.docx", size: "42 KB" },
  },
  {
    id: "m7", type: "client", who: "You", role: "Client", at: "May 6, 11:15",
    text: "Reading the draft now — small note: in section 3, can we change the example from 'B2B SaaS' to 'B2B fintech'? Closer to our ICP. Otherwise it looks great!",
  },
];

const ORDER = {
  id: "ord_2k4f1",
  status: "writing" as OrderStatus,
  title: "The Future of AI in Enterprise Software",
  domain: "techcrunch.com",
  dr: 92,
  marketplace: "Editorial",
  createdAt: "4 May 2025",
  targetUrl: "https://yourcompany.com/blog/ai-enterprise",
  anchorText: "AI enterprise software guide",
  wordCount: 1000,
  contentOption: "We Write",
  gpPrice: 700,
  contentPrice: 120,
  total: 850,
  currency: "USD",
  specialRequirements: "Case-study angle, B2B fintech audience. Avoid listicle format. No AI-sounding language.",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function Timeline({ status }: { status: OrderStatus }) {
  const currentIdx = STAGES.findIndex(s => s.id === status);

  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#111827" }}>Progress</h3>
        <span style={{
          padding: "3px 10px", background: "#dbeafe", color: "#1e40af",
          fontSize: 11, fontWeight: 700, borderRadius: 999,
        }}>In progress</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {STAGES.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const dotColor = done ? "#059669" : active ? "#0052cc" : "#e8eaed";
          const lineColor = i < currentIdx ? "#059669" : "#e8eaed";
          const labelColor = done ? "#059669" : active ? "#0052cc" : "#9ca3af";

          return (
            <div key={stage.id} style={{ display: "flex", alignItems: "flex-start", flex: i < STAGES.length - 1 ? 1 : "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                  background: done ? "#059669" : active ? "#eff6ff" : "#fff",
                  border: `2px solid ${dotColor}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : active ? (
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: "#0052cc" }} />
                  ) : null}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: labelColor, textAlign: "center", lineHeight: 1.3, whiteSpace: "nowrap" }}>
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ flex: 1, height: 2, background: lineColor, marginTop: 14, marginLeft: -1, marginRight: -1 }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 18, padding: "10px 14px", borderRadius: 10,
        background: "#eff6ff", border: "1px solid #c7d8fb",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Maya is drafting your article</div>
          <div style={{ fontSize: 11.5, color: "#374151" }}>First draft expected <strong>Friday EOD</strong> · ETA 2 days</div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 600, flexShrink: 0, paddingRight: 12 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600, fontFamily: mono ? "monospace" : "inherit", textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

function DetailsCard() {
  const fee = ORDER.total - ORDER.gpPrice - ORDER.contentPrice;
  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 22 }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#111827" }}>Order details</h3>
      <KV label="Order ID" value={ORDER.id} mono />
      <KV label="Domain" value={
        <span>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{ORDER.domain}</span>
          <span style={{ marginLeft: 6, fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#f3f4f6", color: "#374151", fontWeight: 700 }}>DR {ORDER.dr}</span>
        </span>
      } />
      <KV label="Marketplace" value={ORDER.marketplace} />
      <KV label="Article title" value={ORDER.title} />
      <KV label="Target URL" value={
        <a href={ORDER.targetUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 12, color: "#0052cc", textDecoration: "none" }}>
          {ORDER.targetUrl} ↗
        </a>
      } />
      <KV label="Anchor text" value={`"${ORDER.anchorText}"`} mono />
      <KV label="Word count" value={`${ORDER.wordCount} words`} />
      <KV label="Content" value={ORDER.contentOption} />

      {ORDER.specialRequirements && (
        <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 9, background: "#f9fafb", border: "1px dashed #e8eaed" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Special requirements</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{ORDER.specialRequirements}</div>
        </div>
      )}

      <div style={{ height: 1, background: "#e8eaed", margin: "14px 0" }} />

      <KV label="Guest post" value={`$${ORDER.gpPrice}`} mono />
      <KV label="Content writing" value={`$${ORDER.contentPrice}`} mono />
      <KV label="Management fee" value={`$${fee.toFixed(2)}`} mono />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 0", marginTop: 2 }}>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 800 }}>Total</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 800, fontFamily: "monospace" }}>
          {ORDER.currency === "EUR" ? "€" : "$"}{ORDER.total}
        </span>
      </div>

      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, background: "#f9fafb", border: "1px dashed #e8eaed", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
          <strong>Not yet invoiced.</strong> You'll be billed once the article goes live and we deliver the publication URL.
        </div>
      </div>
    </div>
  );
}

function Avatar({ from }: { from: "client" | "admin" }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 999, flexShrink: 0,
      background: from === "admin"
        ? "linear-gradient(135deg, #2c64f0, #4f46e5)"
        : "linear-gradient(135deg, #f59e0b, #ef4444)",
      color: "#fff", fontWeight: 800, fontSize: 12,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "2px solid #fff", boxShadow: "0 0 0 1px #e8eaed",
    }}>
      {from === "admin" ? "MR" : "ME"}
    </div>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const isClient = msg.type === "client";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isClient ? "row-reverse" : "row" }}>
      <Avatar from={isClient ? "client" : "admin"} />
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 5, alignItems: isClient ? "flex-end" : "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{msg.who}</span>
          <span style={{
            fontSize: 10.5, padding: "1px 7px", borderRadius: 4, fontWeight: 700,
            background: msg.type === "admin" ? "#eff6ff" : "#f3f4f6",
            color: msg.type === "admin" ? "#1d4ed8" : "#6b7280",
          }}>{msg.role}</span>
          <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{msg.at}</span>
        </div>
        {msg.text && (
          <div style={{
            padding: "11px 14px", borderRadius: 14,
            borderTopLeftRadius: isClient ? 14 : 4,
            borderTopRightRadius: isClient ? 4 : 14,
            background: isClient ? "#0052cc" : "#fff",
            color: isClient ? "#fff" : "#111827",
            fontSize: 13.5, lineHeight: 1.55,
            border: isClient ? "none" : "1px solid #e8eaed",
            boxShadow: isClient ? "0 1px 0 #003a99" : "0 1px 0 rgba(15,22,32,0.02)",
          }}>
            {msg.text}
          </div>
        )}
        {msg.attachment && <AttachmentCard a={msg.attachment} isClient={isClient} />}
      </div>
    </div>
  );
}

function AttachmentCard({ a, isClient }: { a: NonNullable<Message["attachment"]>; isClient: boolean }) {
  if (a.type === "doc") return (
    <a href="#" onClick={e => e.preventDefault()} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10, textDecoration: "none",
      background: "#fff", border: "1px solid #e8eaed", color: "#111827",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eff6ff", color: "#0052cc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.name}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af" }}>Word doc · {a.size} · click to download</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", flexShrink: 0 }}>Review →</span>
    </a>
  );

  if (a.type === "url") return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 10, textDecoration: "none",
      background: isClient ? "rgba(255,255,255,0.12)" : "#f9fafb",
      border: `1px solid ${isClient ? "rgba(255,255,255,0.18)" : "#e8eaed"}`,
      color: isClient ? "#fff" : "#111827",
      maxWidth: 320,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isClient ? "#fff" : "#0052cc"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>{a.title}</div>
        <div style={{ fontSize: 10.5, fontFamily: "monospace", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.url}</div>
      </div>
    </a>
  );

  return null;
}

function SystemEvent({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
      <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
      <span style={{
        padding: "3px 12px", borderRadius: 999, background: "#f3f4f6",
        fontSize: 10.5, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: "#e8eaed" }} />
    </div>
  );
}

function TypingDots() {
  return (
    <>
      <style>{`
        @keyframes lp-typing {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar from="admin" />
        <div style={{
          padding: "12px 16px", borderRadius: 14, borderTopLeftRadius: 4,
          background: "#fff", border: "1px solid #e8eaed",
          display: "inline-flex", gap: 4, alignItems: "center",
        }}>
          {[0, 0.15, 0.3].map((delay, i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: 999, background: "#9ca3af",
              display: "inline-block",
              animation: `lp-typing 1.2s infinite ${delay}s`,
            }} />
          ))}
        </div>
      </div>
    </>
  );
}

function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = message.trim();
    if (!text) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      type: "client",
      who: "You",
      role: "Client",
      at: "Just now",
      text,
    };
    setMessages(prev => [...prev, newMsg]);
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  const QUICK_ACTIONS = [
    { l: "👍 Looks good, ship it", primary: true },
    { l: "Request revisions" },
    { l: "Schedule a call" },
    { l: "Approve & publish" },
  ];

  return (
    <div style={{
      background: "#fff", border: "1px solid #e8eaed", borderRadius: 14,
      display: "flex", flexDirection: "column", height: "calc(100vh - 180px)", minHeight: 600, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid #e8eaed",
        display: "flex", alignItems: "center", gap: 12, background: "#fafbfd", flexShrink: 0,
      }}>
        <div style={{ display: "flex" }}>
          <Avatar from="admin" />
          <div style={{ marginLeft: -10 }}><Avatar from="client" /></div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>Order conversation</h3>
            <span style={{
              padding: "1px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
              background: "#dcfce7", color: "#166534",
              display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#16a34a" }} />
              Maya online
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            You & <strong>Maya R.</strong> (Editor) · Replies in &lt; 2 hours
          </div>
        </div>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 11px", borderRadius: 7,
          background: "#fff", border: "1px solid #e8eaed",
          color: "#b91c1c", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Report
        </button>
      </div>

      {/* Pinned context */}
      <div style={{
        padding: "8px 18px", background: "#fffbeb", borderBottom: "1px solid #fde68a",
        display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#374151", flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>
          Conversation for <strong style={{ fontFamily: "monospace" }}>{ORDER.domain}</strong> · <em>"{ORDER.title}"</em>
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#9ca3af", whiteSpace: "nowrap" }}>Stored for 2 years</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "18px 18px", display: "flex", flexDirection: "column", gap: 16, background: "#f5f6f8" }}>
        {messages.map(msg =>
          msg.type === "system"
            ? <SystemEvent key={msg.id} text={msg.text!} />
            : <Bubble key={msg.id} msg={msg} />
        )}
        <TypingDots />
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div style={{ padding: 14, borderTop: "1px solid #e8eaed", background: "#fff", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {QUICK_ACTIONS.map(q => (
            <button key={q.l} onClick={() => setMessage(q.l)} style={{
              padding: "5px 11px", borderRadius: 999,
              background: q.primary ? "#eff6ff" : "#fff",
              color: q.primary ? "#1d4ed8" : "#374151",
              border: `1px solid ${q.primary ? "#93c5fd" : "#e8eaed"}`,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>{q.l}</button>
          ))}
        </div>

        <div style={{
          border: `1.5px solid ${message ? "#0052cc" : "#e8eaed"}`,
          borderRadius: 12, padding: "10px 12px",
          boxShadow: message ? "0 0 0 3px #dbeafe" : "none",
          transition: "box-shadow 0.15s, border-color 0.15s",
          background: "#fff",
        }}>
          <textarea
            rows={2}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply to Maya — drag files, paste URLs…"
            style={{
              width: "100%", border: "none", outline: "none", resize: "none",
              fontSize: 13.5, fontFamily: "inherit", color: "#111827",
              minHeight: 44, background: "transparent", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <button style={composerIconStyle()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button style={composerIconStyle()}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              <kbd style={{ padding: "0 5px", borderRadius: 4, fontSize: 10.5, background: "#f3f4f6", border: "1px solid #e8eaed", color: "#9ca3af", fontFamily: "monospace" }}>⌘</kbd>
              {" + "}
              <kbd style={{ padding: "0 5px", borderRadius: 4, fontSize: 10.5, background: "#f3f4f6", border: "1px solid #e8eaed", color: "#9ca3af", fontFamily: "monospace" }}>↵</kbd>
              {" to send"}
            </span>
            <button
              onClick={send}
              style={{
                padding: "7px 16px", borderRadius: 8, border: "none",
                background: message.trim() ? "#0052cc" : "#e8eaed",
                color: message.trim() ? "#fff" : "#9ca3af",
                fontWeight: 700, fontSize: 12.5, cursor: message.trim() ? "pointer" : "default",
                display: "inline-flex", alignItems: "center", gap: 5,
                transition: "background 0.15s",
              }}
            >
              Send
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function composerIconStyle(): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7, border: "none",
    background: "transparent", color: "#9ca3af",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { loading } = useAuthContext();

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <style>{`
        .order-detail-page { padding: 28px 36px; max-width: 1300px; margin: 0 auto; }
        @media (max-width: 1024px) { .order-detail-page { padding: 20px 20px; } }
        @media (max-width: 768px) { .order-detail-page { padding: 16px 12px; } .order-detail-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div className="order-detail-page">

        {/* Back */}
        <Link href={ROUTES.orders} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 13, color: "#6b7280", textDecoration: "none",
          fontWeight: 500, marginBottom: 18,
        }}>
          ← Back to orders
        </Link>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 5, fontFamily: "monospace" }}>
              ORDER · {ORDER.id}
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: "#111827", lineHeight: 1.1 }}>
              {ORDER.title}
            </h1>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 6 }}>
              <span style={{ fontFamily: "monospace", color: "#374151", fontWeight: 700 }}>{ORDER.domain}</span>
              {" · via "}{ORDER.marketplace}{" · placed "}{ORDER.createdAt}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #e8eaed",
              background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download brief
            </button>
            <button style={{
              padding: "8px 14px", borderRadius: 8, border: "1px solid #e8eaed",
              background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Reorder domain
            </button>
          </div>
        </div>

        {/* Split layout */}
        <div
          className="order-detail-grid"
          style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 460px", gap: 18, alignItems: "flex-start" }}
        >
          {/* Left: Timeline + Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Timeline status={ORDER.status} />
            <DetailsCard />
          </div>

          {/* Right: Chat */}
          <Chat />
        </div>

      </div>
    </>
  );
}
