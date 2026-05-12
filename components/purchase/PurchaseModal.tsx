"use client";

import { useState, useEffect } from "react";

const FEE_RATE = 0.15;

const NICHES = [
  { id: "general",  label: "General / Tier 1",  desc: "News, tech, business, lifestyle", price: 280, restricted: false },
  { id: "finance",  label: "Finance & Fintech",  desc: "Banking, crypto, investment, insurance", price: 420, restricted: false },
  { id: "health",   label: "Health & Wellness",  desc: "Medical, nutrition, fitness, mental health", price: 380, restricted: false },
  { id: "igaming",  label: "iGaming Content",    desc: "Casino, sports betting, poker", price: 780, restricted: true },
  { id: "cbd",      label: "CBD & Cannabis",     desc: "Products, dispensaries, extracts", price: 680, restricted: true },
];

const WORD_COUNTS = [
  { w: 500,  p: 25 },
  { w: 750,  p: 38 },
  { w: 1000, p: 50 },
  { w: 1500, p: 75 },
];

const AI_TITLES = [
  "How Fintech Founders Are Rethinking Onboarding in 2026",
  "The Hidden Cost of a Clunky User Journey in B2B SaaS",
  "5 Data-Backed Strategies to Increase Trial-to-Paid Conversions",
  "Why Enterprise Buyers Care More About UX Than Price",
];

const AI_ANCHORS = [
  "fintech onboarding platform",
  "B2B SaaS conversion tool",
  "enterprise UX solution",
  "user onboarding software",
];

const AI_TARGETS = [
  { title: "Fintech onboarding guide", url: "https://yourbrand.com/blog/fintech-onboarding", traffic: "1.4k/mo" },
  { title: "B2B conversion playbook", url: "https://yourbrand.com/resources/conversions", traffic: "820/mo" },
  { title: "Product tour landing page", url: "https://yourbrand.com/product-tour", traffic: "3.1k/mo" },
];

type ContentMode = "we" | "file" | "link";
type AIField = "title" | "anchor" | "target" | null;

interface PurchaseModalProps {
  domain: string;
  marketplace: string;
  onClose: () => void;
  onConfirm?: (order: PurchaseOrder) => void;
}

interface PurchaseOrder {
  domain: string;
  marketplace: string;
  nicheId: string;
  contentMode: ContentMode;
  wordCount: number;
  targetUrl: string;
  anchorText: string;
  articleTitle: string;
  requirements: string;
  total: number;
}

export function PurchaseModal({ domain, marketplace, onClose, onConfirm }: PurchaseModalProps) {
  const [nicheId, setNicheId] = useState("finance");
  const [contentMode, setContentMode] = useState<ContentMode>("we");
  const [wordCount, setWordCount] = useState(750);
  const [targetUrl, setTargetUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const [activeAI, setActiveAI] = useState<AIField>(null);
  const [submitted, setSubmitted] = useState(false);

  const niche = NICHES.find(n => n.id === nicheId)!;
  const wc = WORD_COUNTS.find(w => w.w === wordCount)!;
  const contentPrice = contentMode === "we" ? wc.p : 0;
  const subtotal = niche.price + contentPrice;
  const fee = subtotal * FEE_RATE;
  const total = subtotal + fee;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleConfirm() {
    if (!targetUrl.trim() || !anchorText.trim() || !articleTitle.trim()) return;
    onConfirm?.({
      domain, marketplace, nicheId, contentMode, wordCount,
      targetUrl, anchorText, articleTitle, requirements, total,
    });
    setSubmitted(true);
  }

  if (submitted) return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle()}>
        <div style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: "#dcfce7", color: "#059669",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "3px solid #bbf7d0", marginBottom: 16,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#111827" }}>Order confirmed!</h2>
          <p style={{ margin: "0 0 4px", fontSize: 14, color: "#6b7280" }}>
            <strong style={{ color: "#059669" }}>$0 charged today.</strong> We'll invoice once the article goes live.
          </p>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: "#9ca3af", fontFamily: "monospace" }}>{domain}</p>
          <button onClick={onClose} style={{
            padding: "12px 28px", borderRadius: 10, border: "none",
            background: "#0052cc", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>View my orders</button>
        </div>
      </div>
    </Backdrop>
  );

  const canSubmit = targetUrl.trim() && anchorText.trim() && articleTitle.trim();

  return (
    <Backdrop onClose={onClose}>
      <div style={modalStyle()} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          background: "#fff", padding: "18px 22px",
          borderBottom: "1px solid #e8eaed",
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: "linear-gradient(135deg, #111827, #0052cc)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>Managed service</h2>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 4,
                background: "#eff6ff", color: "#1d4ed8",
              }}>RECOMMENDED</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6b7280" }}>
              Guest post order for{" "}
              <strong style={{ color: "#374151", fontFamily: "monospace" }}>{domain}</strong>
              {" "}via <strong style={{ color: "#374151" }}>{marketplace}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid #e8eaed",
            background: "#fff", cursor: "pointer", color: "#9ca3af",
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 0 }} onClick={() => setActiveAI(null)}>

          {/* Step 1 – Niche & pricing */}
          <StepSection idx={1} title="Content type & pricing" subtitle="Choose the topic category">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {NICHES.map(n => (
                <NicheCard key={n.id} n={n} selected={n.id === nicheId} onClick={() => setNicheId(n.id)} />
              ))}
            </div>
            {niche.restricted && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                marginTop: 10, padding: "10px 12px", borderRadius: 8,
                background: "#fffbeb", border: "1px solid #fde68a",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: "#92400e" }}>
                  <strong>{niche.label}</strong> is a restricted niche — publishers charge a premium. This pricing avoids order rejections.
                </span>
              </div>
            )}
          </StepSection>

          {/* Step 2 – Content creation */}
          <StepSection idx={2} title="Content creation" subtitle="Who writes the article?">
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { id: "we",   label: "We'll write it",      price: `from $${WORD_COUNTS[0].p}`, desc: "Linkpricer's editorial team writes from your brief" },
                { id: "file", label: "I'll provide the file", price: "Free",                    desc: ".doc / .docx / .pdf / .txt" },
                { id: "link", label: "I have a link",         price: "Free",                    desc: "Google Doc or shared URL" },
              ] as { id: ContentMode; label: string; price: string; desc: string }[]).map(opt => (
                <ContentOptionCard
                  key={opt.id}
                  {...opt}
                  selected={contentMode === opt.id}
                  onClick={() => setContentMode(opt.id)}
                />
              ))}
            </div>

            {contentMode === "we" && (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: "#f9fafb", border: "1px solid #f0f2f5" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Word count</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {WORD_COUNTS.map(w => (
                    <button key={w.w} onClick={() => setWordCount(w.w)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${w.w === wordCount ? "#0052cc" : "#e8eaed"}`,
                      background: "#fff",
                      boxShadow: w.w === wordCount ? "0 0 0 2px #dbeafe" : "none",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: w.w === wordCount ? "#1d4ed8" : "#374151" }}>{w.w}w</span>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>+${w.p}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>$0.05 per word · includes 1 round of edits</div>
              </div>
            )}
          </StepSection>

          {/* Step 3 – Order details */}
          <StepSection idx={3} title="Order details" subtitle="Tell us where the link goes">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }} onClick={e => e.stopPropagation()}>

              <FormField label="Target URL" required ai>
                <div style={{ position: "relative" }}>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={e => setTargetUrl(e.target.value)}
                    onFocus={() => setActiveAI("target")}
                    placeholder="https://your-site.com/page-to-link-to"
                    style={fieldInputStyle(activeAI === "target")}
                  />
                  {activeAI === "target" && (
                    <AIPopover kind="target URL" onClose={() => setActiveAI(null)}>
                      {AI_TARGETS.map((t, i) => (
                        <button key={i} onClick={() => { setTargetUrl(t.url); setActiveAI(null); }} style={aiItemStyle(i === 0)}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 2 }}>
                            {t.url} · <span style={{ color: "#059669" }}>{t.traffic}</span>
                          </div>
                        </button>
                      ))}
                    </AIPopover>
                  )}
                </div>
              </FormField>

              <FormField label="Anchor text" required ai>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={anchorText}
                    onChange={e => setAnchorText(e.target.value)}
                    onFocus={() => setActiveAI("anchor")}
                    placeholder="e.g. fintech onboarding platform"
                    style={fieldInputStyle(activeAI === "anchor")}
                  />
                  {activeAI === "anchor" && (
                    <AIPopover kind="anchor text" onClose={() => setActiveAI(null)}>
                      {AI_ANCHORS.map((a, i) => (
                        <button key={i} onClick={() => { setAnchorText(a); setActiveAI(null); }} style={aiItemStyle(i === 0)}>
                          <span style={{ fontSize: 13, color: "#374151" }}>{a}</span>
                        </button>
                      ))}
                    </AIPopover>
                  )}
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Best: branded · partial match · exact match</div>
                </div>
              </FormField>

              <FormField label="Article title" required ai>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={articleTitle}
                    onChange={e => setArticleTitle(e.target.value)}
                    onFocus={() => setActiveAI("title")}
                    placeholder="The headline for your guest post"
                    style={fieldInputStyle(activeAI === "title")}
                  />
                  {activeAI === "title" && (
                    <AIPopover kind="article title" onClose={() => setActiveAI(null)}>
                      {AI_TITLES.map((t, i) => (
                        <button key={i} onClick={() => { setArticleTitle(t); setActiveAI(null); }} style={aiItemStyle(i === 0)}>
                          <span style={{ fontSize: 13, color: "#374151" }}>{t}</span>
                        </button>
                      ))}
                    </AIPopover>
                  )}
                </div>
              </FormField>

              <FormField label="Additional requirements">
                <textarea
                  rows={3}
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                  placeholder="Special instructions — internal links, tone, topics to avoid…"
                  style={{ ...fieldInputStyle(), minHeight: 80, resize: "vertical", lineHeight: 1.5 }}
                />
              </FormField>
            </div>
          </StepSection>

          {/* Step 4 – Summary */}
          <StepSection idx={4} title="Order summary" subtitle="Live preview · updates as you change options">
            <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 18px", border: "1px solid #f0f2f5" }}>
              <SumRow label="Service type" value={
                <span style={{ padding: "2px 10px", background: "#111827", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Managed service</span>
              } />
              <SumRow label="Content type" value={
                <span style={{ padding: "2px 10px", background: niche.restricted ? "#fdf2dd" : "#f3f4f6", color: niche.restricted ? "#a35d00" : "#374151", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  {niche.label}{niche.restricted ? " · restricted" : ""}
                </span>
              } />
              <SumRow label="Guest post price" value={`$${niche.price.toLocaleString()}`} mono />
              {contentMode === "we" && <SumRow label={`Content (${wordCount} words)`} value={`$${contentPrice}`} mono />}
              <SumRow label="Management fee (15%)" value={`$${fee.toFixed(2)}`} mono hint="Editorial, marketplace handling, follow-up" />
              <div style={{ height: 1, background: "#e8eaed", margin: "10px 0" }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.4, textTransform: "uppercase" }}>Total</span>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", letterSpacing: -0.6, color: "#111827" }}>
                  ${total.toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3, textAlign: "right" }}>Invoiced after publication · $0 today</div>
            </div>
          </StepSection>

        </div>

        {/* Footer */}
        <div style={{
          background: "#fff", borderTop: "1px solid #e8eaed",
          padding: "14px 22px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "11px 18px", borderRadius: 10, border: "1px solid #e8eaed",
            background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13.5, cursor: "pointer",
          }}>Cancel</button>
          <div style={{ flex: 1, fontSize: 12, color: "#9ca3af", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            14-day refund if order fails
          </div>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            style={{
              padding: "12px 22px", borderRadius: 10, border: "none",
              background: canSubmit ? "linear-gradient(180deg, #0052cc, #003a99)" : "#e8eaed",
              color: canSubmit ? "#fff" : "#9ca3af",
              fontWeight: 700, fontSize: 14,
              boxShadow: canSubmit ? "0 6px 16px rgba(0,82,204,0.28)" : "none",
              cursor: canSubmit ? "pointer" : "default",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all 0.15s",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Confirm order — ${total.toFixed(2)}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15,22,32,0.48)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        backdropFilter: "blur(2px)",
      }}
    >
      {children}
    </div>
  );
}

function modalStyle(): React.CSSProperties {
  return {
    width: "100%", maxWidth: 720,
    maxHeight: "calc(100vh - 40px)",
    background: "#f5f6f8",
    borderRadius: 20,
    boxShadow: "0 24px 80px rgba(15,22,32,0.32), 0 4px 16px rgba(15,22,32,0.12)",
    border: "1px solid rgba(15,22,32,0.08)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
}

function StepSection({ idx, title, subtitle, children }: { idx: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          fontSize: 10.5, fontFamily: "monospace", fontWeight: 700,
          color: "#9ca3af", letterSpacing: 0.6,
          padding: "2px 8px", border: "1px solid #e8eaed", borderRadius: 999,
        }}>STEP 0{idx}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>{title}</h3>
        {subtitle && <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function NicheCard({ n, selected, onClick }: { n: typeof NICHES[number]; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
      padding: "13px 15px", borderRadius: 11, cursor: "pointer",
      border: `1.5px solid ${selected ? "#0052cc" : "#e8eaed"}`,
      background: selected ? "#eff6ff" : "#fff",
      boxShadow: selected ? "0 0 0 3px #dbeafe" : "none",
      transition: "all .12s",
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 999, flexShrink: 0,
        border: `2px solid ${selected ? "#0052cc" : "#cbd5e1"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ width: 8, height: 8, borderRadius: 999, background: "#0052cc" }} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: "#111827" }}>{n.label}</span>
          {n.restricted && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, padding: "1px 6px",
              background: "#fdf2dd", color: "#a35d00", borderRadius: 4,
            }}>RESTRICTED</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{n.desc}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: n.restricted ? "#a35d00" : "#111827", letterSpacing: -0.4 }}>
          ${n.price}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>guest post</div>
      </div>
    </button>
  );
}

function ContentOptionCard({ id, label, price, desc, selected, onClick }: { id: string; label: string; price: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 14, textAlign: "left", borderRadius: 11, cursor: "pointer",
      border: `1.5px solid ${selected ? "#0052cc" : "#e8eaed"}`,
      background: selected ? "#eff6ff" : "#fff",
      boxShadow: selected ? "0 0 0 3px #dbeafe" : "none",
      display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
        <span style={{
          width: 16, height: 16, borderRadius: 999, flexShrink: 0,
          border: `2px solid ${selected ? "#0052cc" : "#cbd5e1"}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {selected && <span style={{ width: 7, height: 7, borderRadius: 999, background: "#0052cc" }} />}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{label}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>{price}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", lineHeight: 1.4, marginLeft: 23 }}>{desc}</div>
    </button>
  );
}

function AIPopover({ kind, children, onClose }: { kind: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 18 }} />
      <div style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 19,
        background: "#fff", border: "1px solid #e8eaed", borderRadius: 12,
        boxShadow: "0 12px 32px rgba(15,22,32,0.12)", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 13px",
          background: "linear-gradient(90deg, #faf5ff, #eff6ff)",
          borderBottom: "1px solid #f0f2f5",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6", display: "flex", alignItems: "center", gap: 5 }}>
            ✨ AI suggestions for {kind}
          </span>
          <span style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600 }}>Tap to use</span>
        </div>
        <div style={{ maxHeight: 200, overflow: "auto" }}>{children}</div>
      </div>
    </>
  );
}

function aiItemStyle(highlight: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "9px 13px", textAlign: "left", border: "none", cursor: "pointer",
    background: highlight ? "#f9fafb" : "#fff", display: "block",
  };
}

function FormField({ label, required, ai, children }: { label: string; required?: boolean; ai?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <label style={{ fontSize: 11.5, fontWeight: 700, color: "#374151", letterSpacing: 0.2 }}>
          {label}{required && " *"}
        </label>
        {ai && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "1px 8px", borderRadius: 999,
            background: "linear-gradient(135deg, #ede9fe, #dbeafe)",
            color: "#5b21b6", fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
          }}>✨ AI suggestions</span>
        )}
      </div>
      {children}
    </div>
  );
}

function fieldInputStyle(focused = false): React.CSSProperties {
  return {
    width: "100%", padding: "10px 13px", borderRadius: 9,
    border: `1.5px solid ${focused ? "#0052cc" : "#e8eaed"}`,
    background: "#fff", fontSize: 13.5, color: "#111827",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: focused ? "0 0 0 3px #dbeafe" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

function SumRow({ label, value, mono, hint }: { label: string; value: React.ReactNode; mono?: boolean; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
      <div>
        <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
        {hint && <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 1 }}>{hint}</div>}
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", fontFamily: mono ? "monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );
}
