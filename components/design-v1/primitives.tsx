"use client";

// Shared UI primitives ported from variations/v1.jsx + v1-interactive/v1-app.jsx
// in the Karolis design handoff: badges, table cells, and the style-object
// helpers (btn/chip/lbl/etc.) used throughout the results table and
// marketplace cards.

import { useRef, useState } from "react";
import { Icon } from "@/lib/design-v1/icons";
import { gradeColor } from "@/lib/design-v1/format";
import type { SortState } from "@/lib/design-v1/types";

export type PillColor = "ink" | "blue" | "green" | "amber" | "red";

const PILL_COLORS: Record<PillColor, { bg: string; fg: string }> = {
  ink: { bg: "#eef0f4", fg: "#374151" },
  blue: { bg: "#e9f1fe", fg: "#1d4ed8" },
  green: { bg: "#e6f6ed", fg: "#0a8a4a" },
  amber: { bg: "#fdf2dd", fg: "#a35d00" },
  red: { bg: "#fdecea", fg: "#b1280c" },
};

export function Pill({
  children,
  color = "ink",
  style = {},
}: {
  children: React.ReactNode;
  color?: PillColor;
  style?: React.CSSProperties;
}) {
  const c = PILL_COLORS[color] || PILL_COLORS.ink;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        letterSpacing: 0.1, background: c.bg, color: c.fg, ...style,
      }}
    >
      {children}
    </span>
  );
}

export function GradeBadge({ grade, score, big = false }: { grade?: string | null; score?: number | null; big?: boolean }) {
  const c = gradeColor(grade);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 6,
        padding: big ? "6px 12px" : "3px 9px",
        borderRadius: 8, background: c.bg, color: c.fg,
        fontWeight: 700, fontSize: big ? 16 : 12,
      }}
    >
      <span>{grade || "—"}</span>
      {score != null && <span style={{ fontSize: big ? 11 : 10, opacity: 0.7, fontWeight: 600 }}>{score}</span>}
    </span>
  );
}

// Question-mark help icon with a hover/tap tooltip — used on every price
// and editorial field to explain what the value means in plain language.
export function InfoTip({ text, size = 13 }: { text: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "top" | "bottom" }>({ top: 0, left: 0, placement: "top" });
  const ref = useRef<HTMLSpanElement>(null);
  const TIP_W = 220;

  const place = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const above = r.top > 120;
    setPos({
      placement: above ? "top" : "bottom",
      top: above ? r.top - 8 : r.bottom + 8,
      left: Math.min(Math.max(cx, TIP_W / 2 + 8), window.innerWidth - TIP_W / 2 - 8),
    });
  };
  const show = () => { place(); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle", marginLeft: 5 }} onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-label="More info"
        onClick={(e) => { e.stopPropagation(); open ? hide() : show(); }}
        onBlur={hide}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size + 4, height: size + 4, padding: 0, borderRadius: 999,
          border: "none", background: "transparent", cursor: "help",
          color: "var(--lp-mute-2)", lineHeight: 0,
        }}
      >
        <Icon name="help" size={size} />
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pos.top, left: pos.left,
            transform: `translateX(-50%) ${pos.placement === "top" ? "translateY(-100%)" : ""}`,
            width: TIP_W, zIndex: 4000, background: "var(--lp-ink)", color: "#fff",
            fontSize: 11.5, fontWeight: 500, lineHeight: 1.45,
            padding: "9px 11px", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(15,22,32,0.22)", textAlign: "left",
            pointerEvents: "auto",
          }}
        >
          {text}
          <span
            style={{
              position: "absolute", left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
              ...(pos.placement === "top"
                ? { top: "100%", borderTop: "5px solid var(--lp-ink)" }
                : { bottom: "100%", borderBottom: "5px solid var(--lp-ink)" }),
            }}
          />
        </span>
      )}
    </span>
  );
}

export function Th({
  children,
  style = {},
  sortable = false,
  sortKey,
  sortState,
  onSort,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  sortable?: boolean;
  sortKey?: string;
  sortState?: SortState;
  onSort?: (key: string) => void;
}) {
  const active = sortable && sortState?.key === sortKey;
  const dir = active ? sortState!.dir : "desc";
  return (
    <th
      style={{
        textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600,
        color: "var(--lp-mute)", letterSpacing: 0.3, textTransform: "uppercase",
        borderBottom: "1px solid var(--lp-line)", whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        onClick={() => sortable && sortKey && onSort?.(sortKey)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: sortable ? "pointer" : "default", color: active ? "var(--lp-ink-2)" : undefined, userSelect: "none" }}
      >
        {children}
        {sortable && <Icon name={active ? (dir === "desc" ? "arrowDown" : "arrowUp") : "sort"} size={11} color={active ? "var(--lp-accent)" : "var(--lp-mute-2)"} />}
      </span>
    </th>
  );
}

export function Td({ children, style = {} }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: "14px 12px", fontSize: 13.5, color: "var(--lp-ink-2)",
        borderBottom: "1px solid var(--lp-line-2)", verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function TrendArrow({ dir }: { dir?: "up" | "down" | "flat" }) {
  if (dir === "up") return <Icon name="arrowUp" size={11} color="var(--lp-good)" />;
  if (dir === "down") return <Icon name="arrowDown" size={11} color="var(--lp-bad)" />;
  return <span style={{ display: "inline-block", width: 6, height: 1, background: "var(--lp-mute-2)", verticalAlign: "middle" }} />;
}

// ============== style-object helpers (kept as functions, matching source) ==============
export function btn(variant: "primary" | "ghost" | "disabled", size: "sm" | "md" | "lg" = "md"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "inherit", fontWeight: 600, border: "none", borderRadius: 10,
    cursor: "pointer", transition: "all 0.15s ease",
  };
  if (variant === "primary") {
    return {
      ...base,
      background: "var(--lp-accent)", color: "#fff",
      padding: size === "sm" ? "8px 12px" : size === "md" ? "12px 16px" : "14px 20px",
      fontSize: size === "sm" ? 12.5 : size === "md" ? 13.5 : 14,
      boxShadow: "0 2px 6px rgba(37, 99, 235, 0.2)",
    };
  }
  if (variant === "ghost") {
    return {
      ...base,
      background: "transparent", color: "var(--lp-ink-2)",
      border: "1px solid var(--lp-line)",
      padding: size === "sm" ? "7px 11px" : size === "md" ? "10px 14px" : "12px 16px",
      fontSize: size === "sm" ? 12.5 : size === "md" ? 13.5 : 14,
    };
  }
  return {
    ...base,
    background: "var(--lp-bg-3)", color: "var(--lp-mute)",
    border: "none",
    padding: size === "sm" ? "8px 12px" : size === "md" ? "12px 16px" : "14px 20px",
    fontSize: size === "sm" ? 12.5 : size === "md" ? 13.5 : 14,
    cursor: "not-allowed",
  };
}

export function iconBtn(active = false): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 6, border: "1px solid var(--lp-line)",
    background: active ? "var(--lp-accent-50)" : "transparent",
    color: active ? "var(--lp-accent)" : "var(--lp-ink-3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", transition: "all 0.15s ease",
  };
}

export function chev(expanded: boolean): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent",
    color: "var(--lp-mute-2)", cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 0.15s ease",
  };
}

export const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", background: "var(--lp-line-2)",
  border: "1px solid var(--lp-line)", borderRadius: 8,
  fontSize: 12.5, color: "var(--lp-ink-2)", fontWeight: 500,
};

export const lbl: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--lp-mute)",
  letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
};

export const priceCell: React.CSSProperties = { padding: "12px", display: "flex", flexDirection: "column", gap: 2 };
export const priceLbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--lp-mute)", letterSpacing: 0.2, textTransform: "uppercase" };
export const priceVal: React.CSSProperties = { fontSize: 16, fontWeight: 800, color: "var(--lp-ink)", letterSpacing: -0.4 };

export const editRow: React.CSSProperties = { padding: "12px", display: "flex", flexDirection: "column", gap: 4, background: "var(--lp-bg-3)", borderRadius: 8 };
export const editLbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--lp-mute)", textTransform: "uppercase" };
export const editVal: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--lp-ink-2)" };
