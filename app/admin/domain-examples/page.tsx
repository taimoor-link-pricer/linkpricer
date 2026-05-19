"use client";

import { useState, useEffect, useCallback } from "react";

type DomainRow = {
  domain: string;
  dr: number | null;
  traffic: number | null;
  category: string | null;
  offer_count: number;
  example_url: string | null;
  example_title: string | null;
  example_updated_at: string | null;
};

function fmtNum(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDate(ts: string | null) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return null; }
}

export default function DomainExamplesPage() {
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedDomain, setSavedDomain] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), ...(search ? { q: search } : {}) });
      const res = await fetch(`/api/admin/domain-examples?${params}`);
      const data = await res.json();
      setRows(data.domains ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => { setPage(1); }, [search]);

  function startEdit(row: DomainRow) {
    setEditingDomain(row.domain);
    setEditUrl(row.example_url ?? "");
    setEditTitle(row.example_title ?? "");
  }

  function cancelEdit() {
    setEditingDomain(null);
    setEditUrl("");
    setEditTitle("");
  }

  async function save(domain: string) {
    setSaving(true);
    try {
      await fetch("/api/admin/domain-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, example_url: editUrl, example_title: editTitle }),
      });
      setSavedDomain(domain);
      setTimeout(() => setSavedDomain(null), 2000);
      setEditingDomain(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / 50);
  const hasExample = rows.filter(r => r.example_url).length;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "0 0 4px" }}>Domain Examples</h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Add published example URLs shown on offer cards. {hasExample} of {total} domains have an example.
        </p>
      </div>

      {/* Search + stats bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e8eaed", borderRadius: 9, padding: "8px 14px" }}>
          <span style={{ color: "#9ca3af", fontSize: 14 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search domains…"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#111827", flex: 1, background: "transparent" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {total.toLocaleString()} domains
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Domain", "DR", "Traffic", "Category", "Offers", "Published Example", "Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e8eaed", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: "14px 16px", borderBottom: "1px solid #f0f2f5" }}>
                      <div style={{ height: 14, borderRadius: 6, background: "#f3f4f6", width: j === 0 ? "60%" : j === 5 ? "80%" : "40%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "56px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  No domains found{search ? ` for "${search}"` : ""}
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const isEditing = editingDomain === row.domain;
              const isSaved = savedDomain === row.domain;
              const border = idx === rows.length - 1 ? "none" : "1px solid #f0f2f5";

              return (
                <tr key={row.domain} style={{ background: isEditing ? "#fffbeb" : "transparent" }}>
                  {/* Domain */}
                  <td style={{ padding: "12px 16px", borderBottom: border }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#111827" }}>{row.domain}</span>
                  </td>

                  {/* DR */}
                  <td style={{ padding: "12px 16px", borderBottom: border }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.dr && row.dr >= 60 ? "#166534" : row.dr && row.dr >= 30 ? "#92400e" : "#374151" }}>
                      {row.dr != null ? Math.round(row.dr) : "—"}
                    </span>
                  </td>

                  {/* Traffic */}
                  <td style={{ padding: "12px 16px", borderBottom: border, fontSize: 13, color: "#374151" }}>
                    {fmtNum(row.traffic)}
                  </td>

                  {/* Category */}
                  <td style={{ padding: "12px 16px", borderBottom: border, fontSize: 12, color: "#6b7280", maxWidth: 160 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{row.category ?? "—"}</span>
                  </td>

                  {/* Offers */}
                  <td style={{ padding: "12px 16px", borderBottom: border }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#f3f4f6", color: "#374151" }}>
                      {row.offer_count}
                    </span>
                  </td>

                  {/* Published example */}
                  <td style={{ padding: "12px 16px", borderBottom: border, maxWidth: 280 }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Title (optional)"
                          style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid #e8eaed", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                        />
                        <input
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          placeholder="https://example.com/post-slug"
                          style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid #2563eb", fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }}
                          autoFocus
                        />
                      </div>
                    ) : row.example_url ? (
                      <div>
                        {row.example_title && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.example_title}</div>
                        )}
                        <a href={row.example_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#2563eb", fontFamily: "monospace", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {row.example_url.replace(/^https?:\/\//, "")}
                        </a>
                        {row.example_updated_at && (
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Updated {fmtDate(row.example_updated_at)}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>No example yet</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px", borderBottom: border, whiteSpace: "nowrap" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => save(row.domain)}
                          disabled={saving}
                          style={{ padding: "6px 14px", background: "#111827", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: saving ? "default" : "pointer" }}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ padding: "6px 12px", background: "#fff", color: "#6b7280", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 12, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isSaved && <span style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}>✓ Saved</span>}
                        <button
                          onClick={() => startEdit(row)}
                          style={{ padding: "6px 12px", background: "#fff", color: "#374151", border: "1px solid #e8eaed", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          {row.example_url ? "Edit" : "+ Add"}
                        </button>
                        {row.example_url && (
                          <button
                            onClick={async () => {
                              await fetch("/api/admin/domain-examples", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ domain: row.domain, example_url: "", example_title: "" }),
                              });
                              load();
                            }}
                            style={{ padding: "6px 10px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, cursor: "pointer" }}
                          >
                            Remove
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid #e8eaed" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Page {page} of {totalPages} · {total.toLocaleString()} domains
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", fontSize: 12, fontWeight: 600, cursor: page === 1 ? "default" : "pointer", color: page === 1 ? "#9ca3af" : "#374151" }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", fontSize: 12, fontWeight: 600, cursor: page === totalPages ? "default" : "pointer", color: page === totalPages ? "#9ca3af" : "#374151" }}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
