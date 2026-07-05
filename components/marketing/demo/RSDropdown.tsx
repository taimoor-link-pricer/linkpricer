"use client";

// Searchable filter dropdown used in the Related Sites demo, ported from
// `RSDropdown` / `RSToggle` in v1-interactive/home-demo.jsx.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/design-v1/icons";
import type { FilterOption } from "./related-filters";

export function RSDropdown({
  label,
  value,
  options,
  onChange,
  minWidth = 128,
  align = "left",
  searchable = false,
}: {
  label?: string;
  value: string;
  options: FilterOption[];
  onChange: (id: string) => void;
  minWidth?: number;
  align?: "left" | "right";
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQ(""); return; }
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 20);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, searchable]);

  const current = options.find((o) => o.id === value) || options[0];
  const ql = q.trim().toLowerCase();
  const filtered = searchable && ql ? options.filter((o) => o.label.toLowerCase().includes(ql) || o.id.toLowerCase().includes(ql)) : options;

  return (
    <div ref={ref} style={{ position: "relative", flex: label ? "1 1 128px" : "0 0 auto", minWidth }}>
      {label && <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>}
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#fff", border: "1px solid " + (open ? "var(--lp-accent)" : "var(--lp-line)"), borderRadius: 10, padding: "9px 11px", fontWeight: 600, fontSize: 13, color: "var(--lp-ink-2)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current?.label}</span>
        <Icon name="chevronDown" size={13} color="var(--lp-mute)" />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", zIndex: 40, [align]: 0, minWidth: "100%", width: "max-content", maxWidth: 260, background: "#fff", border: "1px solid var(--lp-line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,22,32,0.12)", padding: 4, maxHeight: 300, overflow: "auto" }}>
          {searchable && (
            <div style={{ position: "sticky", top: -4, background: "#fff", padding: "2px 2px 6px", margin: "-2px -2px 2px", borderBottom: "1px solid var(--lp-line-2)" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", display: "inline-flex", pointerEvents: "none" }}>
                  <Icon name="search" size={13} color="var(--lp-mute)" />
                </span>
                <input
                  ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={`Search ${(label || "").toLowerCase()}…`}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px 7px 28px", borderRadius: 8, border: "1px solid var(--lp-line)", fontSize: 12.5, fontFamily: "inherit", color: "var(--lp-ink)", outline: "none" }}
                />
              </div>
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: "12px 10px", fontSize: 12.5, color: "var(--lp-mute)", textAlign: "center" }}>No matches</div>
          ) : filtered.map((o) => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, width: "100%", padding: "8px 10px", borderRadius: 7, border: "none", background: value === o.id ? "var(--lp-accent-50)" : "transparent", color: value === o.id ? "var(--lp-accent-700)" : "var(--lp-ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" }}>
              <span>{o.label}</span>
              {value === o.id && <Icon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RSToggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" disabled={disabled} onClick={() => !disabled && onChange(!checked)} aria-pressed={checked}
      style={{ width: 38, height: 22, borderRadius: 999, border: "none", padding: 2, flexShrink: 0, background: disabled ? "var(--lp-line)" : checked ? "var(--lp-accent)" : "var(--lp-mute-2)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", transition: "background .15s" }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: checked ? "translateX(16px)" : "translateX(0)", transition: "transform .15s" }} />
    </button>
  );
}
