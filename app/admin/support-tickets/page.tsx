"use client";

import { useEffect, useState, useCallback } from "react";

interface Ticket {
  id: string;
  topic: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string | null;
  userEmail: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#fef3c7", fg: "#92400e" },
  resolved: { bg: "#dcfce7", fg: "#166534" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setError("");
    const res = await fetch(`/api/admin/support-tickets?status=${status}`);
    if (res.status === 403) {
      setError("You don't have access to this page.");
      setTickets([]);
      return;
    }
    if (!res.ok) {
      setError("Could not load tickets.");
      return;
    }
    const d = await res.json();
    setTickets(d.tickets);
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  async function toggleStatus(t: Ticket) {
    const nextStatus = t.status === "open" ? "resolved" : "open";
    setUpdating(t.id);
    try {
      const res = await fetch("/api/admin/support-tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, status: nextStatus }),
      });
      if (res.ok) await load(statusFilter);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Support Tickets</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {(["open", "resolved", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: "1px solid #e5e7eb",
                background: statusFilter === s ? "#111827" : "#fff",
                color: statusFilter === s ? "#fff" : "#374151",
                textTransform: "capitalize",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {tickets === null ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 14 }}>No {statusFilter !== "all" ? statusFilter : ""} tickets.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((t) => {
            const c = STATUS_COLORS[t.status] ?? STATUS_COLORS.open;
            return (
              <div key={t.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t.subject}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      {t.userEmail ?? "unknown user"} · {t.topic} · {fmtDate(t.createdAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.fg, textTransform: "capitalize" }}>
                      {t.status}
                    </span>
                    <button
                      onClick={() => toggleStatus(t)}
                      disabled={updating === t.id}
                      style={{ fontSize: 12, fontWeight: 600, color: "#0052cc", background: "none", border: "none", cursor: "pointer" }}
                    >
                      {updating === t.id ? "…" : t.status === "open" ? "Mark resolved" : "Reopen"}
                    </button>
                  </div>
                </div>
                <pre style={{ fontFamily: "inherit", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>
                  {t.message}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
