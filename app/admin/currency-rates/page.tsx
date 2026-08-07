"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

// Mirrors the fallback in lib/currency.ts, shown here only for display when
// an admin hasn't set an override yet. Currencies outside this list only
// appear once an admin (or a script) has actually saved a rate for them —
// the row list itself is derived from the DB below, not hardcoded, so any
// currency ever seen in marketplace_offers/supplier_offers is manageable
// here instead of needing direct database access.
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
  const [addingNew, setAddingNew] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [newRate, setNewRate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const currencies = useMemo(() => {
    const set = new Set<string>(Object.keys(BUILT_IN_DEFAULTS));
    for (const c of Object.keys(savedRows)) set.add(c);
    return Array.from(set).sort();
  }, [savedRows]);

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
    const builtIn = BUILT_IN_DEFAULTS[currency];
    const msg = builtIn
      ? `Reset ${currency} to the built-in default (${builtIn.toFixed(2)})?`
      : `Remove the saved rate for ${currency}? With no built-in default for this currency, it will fall back to treating 1 ${currency} as 1 USD until a new rate is saved.`;
    if (!confirm(msg)) return;
    await fetch(`/api/admin/currency-rates?currency=${encodeURIComponent(currency)}`, { method: "DELETE" });
    load();
  }

  async function addCurrency() {
    const currency = newCurrency.trim().toUpperCase();
    const rate = Number(newRate);
    setAddError(null);
    if (!/^[A-Z]{3}$/.test(currency)) {
      setAddError("Enter a 3-letter currency code, e.g. AUD.");
      return;
    }
    if (currency === "USD") {
      setAddError("USD is always 1:1 and isn't configurable.");
      return;
    }
    if (currencies.includes(currency)) {
      setAddError(`${currency} is already listed below.`);
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setAddError("Enter a valid positive rate.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/currency-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, usd_rate: rate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error ?? "Failed to add currency.");
        return;
      }
      setAddingNew(false);
      setNewCurrency("");
      setNewRate("");
      await load();
    } finally {
      setSaving(false);
    }
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
              ["EUR", "GBP"].map((c, i) => (
                <tr key={c}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j} style={{ padding: "14px 16px", borderBottom: i === 1 ? "none" : "1px solid #f0f2f5" }}>
                      <div style={{ height: 14, borderRadius: 6, background: "#f3f4f6", width: j === 0 ? "40%" : "60%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : currencies.map((currency, idx) => {
              const saved = savedRows[currency] ?? null;
              const isEditing = editingCurrency === currency;
              const isSaved = savedCurrency === currency;
              const border = idx === currencies.length - 1 ? "none" : "1px solid #f0f2f5";
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
                          <button onClick={() => resetToDefault(currency)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            {BUILT_IN_DEFAULTS[currency] ? "Reset" : "Remove"}
                          </button>
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

      <div style={{ marginTop: 16 }}>
        {addingNew ? (
          <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 16, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <input
                value={newCurrency}
                onChange={e => setNewCurrency(e.target.value.toUpperCase())}
                placeholder="AUD"
                maxLength={3}
                autoFocus
                style={{ width: 70, padding: "8px 10px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box", textTransform: "uppercase" }}
              />
            </div>
            <input
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              type="number"
              step="0.01"
              placeholder="USD rate, e.g. 0.65"
              style={{ width: 160, padding: "8px 10px", borderRadius: 7, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={addCurrency} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#2563eb", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer" }}>Add</button>
            <button onClick={() => { setAddingNew(false); setNewCurrency(""); setNewRate(""); setAddError(null); }} style={{ fontSize: 13, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            {addError && <div style={{ width: "100%", color: "#dc2626", fontSize: 12 }}>{addError}</div>}
          </div>
        ) : (
          <button onClick={() => setAddingNew(true)} style={{ fontSize: 13, fontWeight: 600, color: "#2563eb", background: "none", border: "1px dashed #93c5fd", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
            + Add another currency
          </button>
        )}
      </div>
    </div>
  );
}
