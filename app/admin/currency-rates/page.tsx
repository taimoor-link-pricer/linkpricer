"use client";

import { useState, useEffect, useCallback } from "react";

// Every currency actually seen in marketplace_offers / supplier_offers / lp_domain_price.
// USD is excluded — it's always pinned to a rate of 1 and never stored.
const AVAILABLE_CURRENCIES = ["EUR", "GBP"];

// Mirrors the fallback in lib/currency.ts, shown here only for display when
// an admin hasn't set an override yet.
const BUILT_IN_DEFAULTS: Record<string, number> = { EUR: 1 / 0.92, GBP: 1 / 0.79 };

type RateRow = {
  currency: string;
  usd_rate: string | number | null;
  updated_at: string | null;
  updated_by: string | null;
};

function fmtUpdated(row: RateRow) {
  if (!row.updated_at) return "Using built-in default";
  const date = new Date(row.updated_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return row.updated_by ? `${row.updated_by} · ${date}` : date;
}

export default function CurrencyRatesPage() {
  const [savedRows, setSavedRows] = useState<Record<string, RateRow>>({});
  const [loading, setLoading] = useState(true);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCurrency, setSavedCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/currency-rates");
      const data = await res.json();
      const byCurrency: Record<string, RateRow> = {};
      for (const r of (data.rates ?? []) as RateRow[]) byCurrency[r.currency] = r;
      setSavedRows(byCurrency);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(currency: string) {
    const current = savedRows[currency];
    setError(null);
    setEditingCurrency(currency);
    setEditRate(current ? String(Number(current.usd_rate)) : BUILT_IN_DEFAULTS[currency].toFixed(2));
  }

  function cancelEdit() {
    setEditingCurrency(null);
    setEditRate("");
    setError(null);
  }

  async function saveRate(currency: string) {
    const usd_rate = Number(editRate);
    if (!Number.isFinite(usd_rate) || usd_rate <= 0) {
      setError("Enter a valid positive rate.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await fetch("/api/admin/currency-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, usd_rate }),
      });
      setSavedCurrency(currency);
      setTimeout(() => setSavedCurrency(null), 2000);
      setEditingCurrency(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault(currency: string) {
    if (!confirm(`Reset ${currency} to the built-in default (${BUILT_IN_DEFAULTS[currency].toFixed(2)})?`)) return;
    await fetch(`/api/admin/currency-rates?currency=${encodeURIComponent(currency)}`, { method: "DELETE" });
    load();
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "0 0 4px" }}>Currency Rates</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Used to convert marketplace/vendor prices to USD across the app. Rate = how many USD 1 unit of the currency is worth.
        </p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Currency", "Rate (USD/unit)", "Last Updated", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e8eaed", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              AVAILABLE_CURRENCIES.map((c, i) => (
                <tr key={c}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} style={{ padding: "14px 16px", borderBottom: i === AVAILABLE_CURRENCIES.length - 1 ? "none" : "1px solid #f0f2f5" }}>
                      <div style={{ height: 14, borderRadius: 6, background: "#f3f4f6", width: j === 0 ? "40%" : "60%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : AVAILABLE_CURRENCIES.map((currency, idx) => {
              const saved = savedRows[currency] ?? null;
              const isEditing = editingCurrency === currency;
              const isSaved = savedCurrency === currency;
              const border = idx === AVAILABLE_CURRENCIES.length - 1 ? "none" : "1px solid #f0f2f5";
              const displayRate = saved ? Number(saved.usd_rate) : BUILT_IN_DEFAULTS[currency];

              return (
                <tr key={currency} style={{ background: isEditing ? "#fffbeb" : "transparent" }}>
                  <td style={{ padding: "12px 16px", borderBottom: border }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#111827" }}>{currency}</span>
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: border }}>
                    {isEditing ? (
                      <input
                        value={editRate}
                        onChange={e => setEditRate(e.target.value)}
                        type="number"
                        step="0.01"
                        autoFocus
                        style={{ width: 120, padding: "6px 10px", borderRadius: 7, border: "1px solid #2563eb", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: "#374151" }}>{displayRate.toFixed(2)}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: border, fontSize: 12, color: "#6b7280" }}>
                    {fmtUpdated(saved ?? { currency, usd_rate: null, updated_at: null, updated_by: null })}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: border, whiteSpace: "nowrap", textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => saveRate(currency)} disabled={saving} style={{ fontSize: 12, fontWeight: 600, color: "#166534", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Save</button>
                        <button onClick={cancelEdit} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
                        {isSaved && <span style={{ fontSize: 11, color: "#166534" }}>Saved ✓</span>}
                        <button onClick={() => startEdit(currency)} style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Edit</button>
                        {saved && (
                          <button onClick={() => resetToDefault(currency)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{error}</div>}
    </div>
  );
}
