"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { prettyMarketplaceName } from "@/lib/marketplace-name";

type ContentMode = "linkpricer" | "upload" | "url";

interface CartItem {
  domain: string;
  dr: number;
  traffic: number;
  marketplace: string;
  gpPrice: number;
  contentPrice: number;
  delivery: number;
  anchor: string;
  target: string;
  title: string;
  brief: string;
  contentMode: ContentMode;
  tone: string;
  category: string;
}

// Shape stored in localStorage by the search page
interface StoredCartItem {
  domain: string;
  dr: number;
  traffic: number;
  offerName: string;
  offerType: string;
  price: number;
  delivery: number;
  link: string;
}

const FEE_RATE = 0.15;
const TONES = ["Editorial", "Authoritative", "Friendly", "Technical"];
const CATEGORIES = ["Fintech", "SaaS", "Crypto", "Gaming", "Health", "Finance", "Business", "Tech"];

// ── Page ────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("lp_cart");
      if (!raw) { router.replace(ROUTES.search); return; }
      const stored: StoredCartItem[] = JSON.parse(raw);
      if (!stored.length) { router.replace(ROUTES.search); return; }
      setItems(stored.map(s => ({
        domain: s.domain,
        dr: s.dr,
        traffic: s.traffic,
        marketplace: s.offerName,
        gpPrice: s.price,
        contentPrice: 120,
        delivery: s.delivery,
        anchor: "", target: "", title: "", brief: "",
        contentMode: "linkpricer",
        tone: "Editorial", category: "General",
      })));
    } catch {
      router.replace(ROUTES.search);
    }
  }, [router]);

  const subtotal = items.reduce((s, x) => s + x.gpPrice + x.contentPrice, 0);
  const fee = Math.round(subtotal * FEE_RATE);
  const total = subtotal + fee;

  function updateItem(idx: number, patch: Partial<CartItem>) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  if (placed) {
    localStorage.removeItem("lp_cart");
    return <OrderConfirmed items={items} total={total} />;
  }

  if (items.length === 0) return null;

  return (
    <>
      <style>{`
        .checkout-page { padding: 28px 36px; max-width: 1300px; margin: 0 auto; }
        @media (max-width: 1024px) { .checkout-page { padding: 20px 18px; } }
        @media (max-width: 768px)  { .checkout-page { padding: 16px 12px; } .checkout-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      <div className="checkout-page">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            <Link href={ROUTES.search} style={{ color: "#9ca3af", textDecoration: "none" }}>Cart</Link>
            <span style={{ margin: "0 8px" }}>›</span>
            <span style={{ color: "#111827", fontWeight: 600 }}>Checkout</span>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Secure checkout · escrow protected
          </div>
        </div>

        {/* Stepper */}
        <Stepper active={1} />

        {/* Content grid */}
        <div className="checkout-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 400px", gap: 18, alignItems: "flex-start", marginTop: 20 }}>

          {/* Left – briefs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Article briefs</h2>
                <span style={{ fontSize: 11.5, color: "#9ca3af" }}>
                  {items.filter(isReady).length} of {items.length} ready · auto-saved
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af" }}>
                Tell us what to write. We assign editors fluent in your niche.
              </p>
            </div>

            {items.map((item, idx) => (
              <BriefCard
                key={item.domain}
                item={item}
                idx={idx}
                expanded={expandedIdx === idx}
                onToggle={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
                onChange={patch => updateItem(idx, patch)}
                onRemove={() => removeItem(idx)}
              />
            ))}
          </div>

          {/* Right – summary */}
          <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#111827" }}>Estimated cost</h3>
              {items.map(item => (
                <CompactItemRow key={item.domain} item={item} />
              ))}
              <div style={{ marginTop: 14 }}>
                <SumRow label={`${items.length} placements subtotal`} value={`$${subtotal.toLocaleString()}`} />
                <SumRow
                  label="Linkpricer fee"
                  badge="15%"
                  value={`$${fee.toLocaleString()}`}
                />
                <SumRow label="VAT (added per invoice)" value="—" muted />
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingTop: 10, marginTop: 10, borderTop: "1px solid #f0f2f5" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Estimated total</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 26, color: "#111827", letterSpacing: -0.6 }}>
                    ${total.toLocaleString()}
                  </span>
                </div>
                <div style={{
                  marginTop: 10, padding: "10px 12px", borderRadius: 9,
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  display: "flex", gap: 8, alignItems: "flex-start",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <div style={{ fontSize: 11.5, color: "#065f46", lineHeight: 1.4 }}>
                    <strong>$0 charged today.</strong> Each placement is invoiced individually after the publication URL is delivered and verified live.
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setPlaced(true)}
              style={{
                padding: "16px", background: "#111827", color: "#fff",
                border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Place order
            </button>

            <div style={{ fontSize: 11.5, color: "#9ca3af", textAlign: "center", lineHeight: 1.5 }}>
              By placing this order you agree to the{" "}
              <a href="#" style={{ color: "#0052cc", textDecoration: "none" }}>marketplace terms</a>.
              We'll send an invoice for each placement once the publication URL is delivered.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ active }: { active: number }) {
  const steps = ["Cart", "Article briefs", "Confirm order"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 12px", borderRadius: 999,
            background: i === active ? "#0052cc" : i < active ? "#fff" : "#f3f4f6",
            color: i === active ? "#fff" : i < active ? "#374151" : "#9ca3af",
            border: i < active ? "1px solid #e8eaed" : "none",
            fontSize: 12, fontWeight: 700,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: i === active ? "#fff" : i < active ? "#059669" : "#e8eaed",
              color: i === active ? "#0052cc" : "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {i < active ? "✓" : i + 1}
            </span>
            {s}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 24, height: 1, background: "#e8eaed" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── BriefCard ────────────────────────────────────────────────────────────────

function BriefCard({ item, idx, expanded, onToggle, onChange, onRemove }: {
  item: CartItem; idx: number; expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<CartItem>) => void;
  onRemove: () => void;
}) {
  const ready = isReady(item);

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${expanded ? "#0052cc" : "#e8eaed"}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: expanded ? "0 0 0 3px #dbeafe" : "none",
      transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      {/* Card header */}
      <div
        onClick={onToggle}
        style={{
          padding: "13px 18px", display: "flex", alignItems: "center", gap: 13,
          borderBottom: expanded ? "1px solid #f0f2f5" : "none",
          background: expanded ? "#f5f9ff" : "transparent",
          cursor: "pointer",
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: ready ? "#f0fdf4" : "#fffbeb",
          color: ready ? "#059669" : "#a35d00",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 12,
          border: `1px solid ${ready ? "#bbf7d0" : "#fde68a"}`,
        }}>
          {ready ? "✓" : idx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.domain}</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>via {prettyMarketplaceName(item.marketplace)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title || "No title yet"}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, flexShrink: 0,
          background: ready ? "#f0fdf4" : "#fffbeb",
          color: ready ? "#059669" : "#a35d00",
        }}>{ready ? "Ready" : "Brief needed"}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Left col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Article title">
              <input
                type="text"
                value={item.title}
                onChange={e => onChange({ title: e.target.value })}
                style={inputStyle()}
                placeholder="The headline for your guest post"
              />
            </Field>
            <Field label="Target URL (where the link points)">
              <input
                type="url"
                value={item.target}
                onChange={e => onChange({ target: e.target.value })}
                style={{ ...inputStyle(), fontFamily: "monospace" }}
                placeholder="https://yourbrand.com/page"
              />
            </Field>
            <Field label="Anchor text">
              <input
                type="text"
                value={item.anchor}
                onChange={e => onChange({ anchor: e.target.value })}
                style={{ ...inputStyle(), fontFamily: "monospace" }}
                placeholder="e.g. fintech onboarding platform"
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Best: branded · partial · exact match</div>
            </Field>
            <Field label="Niche / category">
              <select value={item.category} onChange={e => onChange({ category: e.target.value })} style={inputStyle()}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Right col */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Who writes the article?">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <ContentBtn
                  label="Linkpricer writes it"
                  sub={`+$${item.contentPrice || 38} · 750 words`}
                  selected={item.contentMode === "linkpricer"}
                  onClick={() => onChange({ contentMode: "linkpricer", contentPrice: 38 })}
                />
                <ContentBtn
                  label="I'll upload content"
                  sub="Free · .docx, .md, .pdf"
                  selected={item.contentMode === "upload"}
                  onClick={() => onChange({ contentMode: "upload", contentPrice: 0 })}
                />
              </div>
              <ContentBtn
                label="Article already published"
                sub="Free · provide URL to existing article"
                selected={item.contentMode === "url"}
                onClick={() => onChange({ contentMode: "url", contentPrice: 0 })}
                full
              />
            </Field>

            <Field label={
              item.contentMode === "linkpricer" ? "Brief for the editor" :
              item.contentMode === "upload" ? "Upload article" : "Article URL"
            }>
              {item.contentMode === "linkpricer" ? (
                <textarea
                  value={item.brief}
                  onChange={e => onChange({ brief: e.target.value })}
                  style={{ ...inputStyle(), minHeight: 110, resize: "vertical", lineHeight: 1.5 }}
                  placeholder="Describe the angle, key points, links to include, tone…"
                />
              ) : item.contentMode === "upload" ? (
                <div style={{
                  border: "1.5px dashed #e8eaed", borderRadius: 9,
                  padding: 22, textAlign: "center", background: "#f9fafb", cursor: "pointer",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12.5, color: "#374151" }}>Drop .docx, .md or .pdf</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>or click to choose · max 5 MB</div>
                </div>
              ) : (
                <input
                  type="url"
                  placeholder="https://yourbrand.com/blog/article-title"
                  style={{ ...inputStyle(), fontFamily: "monospace" }}
                />
              )}
            </Field>

            <Field label="Tone">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => onChange({ tone: t })} style={{
                    padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                    background: item.tone === t ? "#111827" : "#fff",
                    color: item.tone === t ? "#fff" : "#374151",
                    border: `1px solid ${item.tone === t ? "#111827" : "#e8eaed"}`,
                    fontSize: 11.5, fontWeight: 700,
                  }}>{t}</button>
                ))}
              </div>
            </Field>
          </div>

          {/* Remove row */}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", paddingTop: 4, borderTop: "1px solid #f0f2f5", marginTop: 2 }}>
            <button onClick={onRemove} style={{
              padding: "5px 12px", borderRadius: 7, border: "1px solid #fee2e2",
              background: "transparent", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Remove from order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function isReady(item: CartItem) {
  return !!(item.title && item.target && item.anchor && (item.contentMode !== "linkpricer" || item.brief));
}

function CompactItemRow({ item }: { item: CartItem }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #f0f2f5" }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: "#f3f4f6", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#374151",
      }}>{item.domain[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{item.domain}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
          DR {item.dr} · {item.delivery}d delivery
        </div>
      </div>
      <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: "#111827", flexShrink: 0 }}>
        ${(item.gpPrice + item.contentPrice).toLocaleString()}
      </div>
    </div>
  );
}

function SumRow({ label, value, badge, muted }: { label: string; value: string; badge?: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#374151" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        {badge && (
          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#f3f4f6", color: "#9ca3af", fontWeight: 700 }}>{badge}</span>
        )}
      </span>
      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: muted ? "#9ca3af" : "#111827" }}>
        {value}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 0.2, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ContentBtn({ label, sub, selected, onClick, full }: { label: string; sub: string; selected: boolean; onClick: () => void; full?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: full ? "100%" : undefined, padding: "11px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
      background: selected ? "#eff6ff" : "#fff",
      border: `1px solid ${selected ? "#0052cc" : "#e8eaed"}`,
      boxShadow: selected ? "0 0 0 2px #dbeafe" : "none",
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: selected ? "#0052cc" : "#374151" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
    </button>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1px solid #e8eaed", background: "#fff",
    fontSize: 13, fontFamily: "inherit", color: "#111827",
    outline: "none", boxSizing: "border-box",
  };
}

// ── Order Confirmed screen ───────────────────────────────────────────────────

function OrderConfirmed({ items, total }: { items: CartItem[]; total: number }) {
  const steps = [
    { icon: "edit",    title: "Editors assigned",    desc: "Within 24 hours, a specialist in your niche will be assigned to each article." },
    { icon: "user",    title: "Drafts ready",         desc: "2–3 days. Review drafts in your dashboard, request edits, or approve for publication." },
    { icon: "publish", title: "Published & invoiced", desc: "Once live, we verify the URL and invoice that placement individually." },
  ];

  return (
    <div style={{ padding: "40px 36px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 18, padding: "44px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999, background: "#f0fdf4", color: "#059669",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "3px solid #bbf7d0", marginBottom: 14,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#111827" }}>Order confirmed.</h1>
          <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: 14 }}>
            <strong style={{ color: "#059669" }}>$0 charged today.</strong>{" "}
            Order ID <strong style={{ color: "#111827", fontFamily: "monospace" }}>#ord_{Math.random().toString(36).slice(2, 8)}</strong>
          </p>
        </div>

        {/* Next steps */}
        <div style={{ background: "#f9fafb", borderRadius: 12, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "#9ca3af", textTransform: "uppercase", marginBottom: 14 }}>
            What happens next
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {steps.map(s => (
              <div key={s.title} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9, background: "#fff", border: "1px solid #e8eaed",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#0052cc",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon === "edit" && <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}
                    {s.icon === "user" && <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>}
                    {s.icon === "publish" && <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>}
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Items snapshot */}
        <h3 style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.4, textTransform: "uppercase", margin: "0 0 6px" }}>
          {items.length} placements · ${total.toLocaleString()} estimated
        </h3>
        {items.map(item => (
          <div key={item.domain} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid #f0f2f5" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: "#f3f4f6", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#374151",
            }}>{item.domain[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{item.domain}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>via {prettyMarketplaceName(item.marketplace)} · {item.delivery}d delivery</div>
            </div>
            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: "#111827" }}>
              ${(item.gpPrice + item.contentPrice).toLocaleString()}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "center" }}>
          <Link href={ROUTES.orders} style={{
            padding: "12px 22px", background: "#111827", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View your orders
          </Link>
          <button style={{
            padding: "12px 22px", background: "#fff", color: "#111827",
            border: "1px solid #e8eaed", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download receipt
          </button>
        </div>
      </div>
    </div>
  );
}
