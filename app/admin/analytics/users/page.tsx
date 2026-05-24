"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string | null;
  role: string;
}

interface PagedResponse {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function formatDate(val: string | null) {
  if (!val) return "Never";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function getUserName(u: UserRow) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || u.email.split("@")[0];
}

export default function AdminAnalyticsUsersPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [data, setData] = useState<PagedResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchUsers = useCallback(async (search: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/analytics/users?${params}`);
      if (res.status === 403) { setForbidden(true); return; }
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers("", 1);
  }, [fetchUsers]);

  function handleSearch(e: React.SyntheticEvent) {
    e.preventDefault();
    setPage(1);
    setActiveSearch(searchInput);
    fetchUsers(searchInput, 1);
  }

  function handleClear() {
    setSearchInput("");
    setActiveSearch("");
    setPage(1);
    fetchUsers("", 1);
  }

  function goToPage(p: number) {
    setPage(p);
    fetchUsers(activeSearch, p);
  }

  if (forbidden) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Access Restricted</h2>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>This page is only accessible to admins.</p>
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;
  const users = data?.users ?? [];

  return (
    <>
      <style>{`
        .au-page { padding: 32px 40px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 768px) { .au-page { padding: 20px 16px; } }
        .au-input { flex: 1; padding: 8px 14px; border: 1px solid #e8eaed; border-radius: 8px; font-size: 13px; outline: none; }
        .au-input:focus { border-color: #dc2626; }
        .au-table { width: 100%; border-collapse: collapse; }
        .au-table th { text-align: left; padding: 12px 20px; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e8eaed; white-space: nowrap; background: #f9fafb; }
        .au-table td { padding: 14px 20px; font-size: 13px; color: #374151; }
        .au-row:hover td { background: #f9fafb; }
        .au-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; }
        .au-btn:hover:not(:disabled) { opacity: 0.85; }
        .au-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .au-btn-primary { background: #dc2626; color: #fff; }
        .au-btn-outline { background: #fff; color: #374151; border: 1px solid #e8eaed; }
        .au-btn-ghost { background: transparent; color: #6b7280; border: 1px solid #e8eaed; }
        .au-view-btn { padding: 5px 12px; background: transparent; border: 1px solid #e8eaed; border-radius: 6px; cursor: pointer; font-size: 12px; color: #2563eb; font-weight: 500; }
        .au-view-btn:hover { background: #eff6ff; }
        .au-pg-btn { width: 34px; height: 34px; border-radius: 7px; border: 1px solid #e8eaed; background: #fff; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; transition: all 0.15s; }
        .au-pg-btn:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; }
        .au-pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .au-pg-btn.active { background: #dc2626; border-color: #dc2626; color: #fff; font-weight: 700; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="au-page">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#000", margin: "0 0 4px" }}>User Analytics</h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>Search and analyze individual user activity</p>
          </div>
          <button
            className="au-btn au-btn-outline"
            onClick={() => window.open("/api/admin/analytics/users?export=csv", "_blank")}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>↓</span> Export CSV
          </button>
        </div>

        {/* Search */}
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 12px" }}>Search Users</p>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              className="au-input"
              type="text"
              placeholder="Filter by email address..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="au-btn au-btn-primary">Search</button>
            {activeSearch && (
              <button type="button" className="au-btn au-btn-ghost" onClick={handleClear}>Clear</button>
            )}
          </form>
        </div>

        {/* Table card */}
        <div style={{ background: "#fff", border: "1px solid #e8eaed", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {/* Card header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e8eaed", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
              {loading ? "Loading…" : `All Users (${total.toLocaleString()})`}
            </span>
            {!loading && data && (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e8eaed", borderTopColor: "#dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading users…</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <p style={{ color: "#dc2626", fontSize: 14 }}>{error}</p>
              <button className="au-btn au-btn-outline" style={{ marginTop: 12 }} onClick={() => fetchUsers(activeSearch, page)}>Retry</button>
            </div>
          ) : users.length > 0 ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="au-table">
                  <thead>
                    <tr>
                      {["User", "Email", "Login Count", "Last Login", "Registered", "Actions"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, idx) => (
                      <UserTableRow
                        key={user.id}
                        user={user}
                        isLast={idx === users.length - 1}
                        onView={() => router.push(`/admin/analytics/users/${user.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f2f5", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    Showing {((page - 1) * (data?.pageSize ?? 25)) + 1}–{Math.min(page * (data?.pageSize ?? 25), total)} of {total.toLocaleString()} users
                  </span>
                  <Pagination current={page} total={totalPages} onChange={goToPage} />
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>No users found</p>
              <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
                {activeSearch ? "No users match your search." : "Users will appear here once they sign up."}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  const pages = buildPageRange(current, total);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button className="au-pg-btn" disabled={current === 1} onClick={() => onChange(current - 1)}>‹</button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} style={{ width: 34, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>…</span>
        ) : (
          <button
            key={p}
            className={`au-pg-btn${p === current ? " active" : ""}`}
            onClick={() => p !== current && onChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button className="au-pg-btn" disabled={current === total} onClick={() => onChange(current + 1)}>›</button>
    </div>
  );
}

function buildPageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function UserTableRow({ user, isLast, onView }: { user: UserRow; isLast: boolean; onView: () => void }) {
  const [hover, setHover] = useState(false);
  const border = isLast ? "none" : "1px solid #f0f2f5";

  return (
    <tr
      className="au-row"
      style={{ background: hover ? "#f9fafb" : "#fff", transition: "background 0.1s" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td style={{ borderBottom: border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#dc2626", flexShrink: 0 }}>
            {getUserName(user).charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{getUserName(user)}</span>
        </div>
      </td>
      <td style={{ borderBottom: border, color: "#6b7280" }}>{user.email}</td>
      <td style={{ borderBottom: border, textAlign: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, padding: "2px 10px", borderRadius: 99, background: user.loginCount > 0 ? "#dcfce7" : "#f3f4f6", color: user.loginCount > 0 ? "#166534" : "#6b7280" }}>
          {user.loginCount}
        </span>
      </td>
      <td style={{ borderBottom: border, color: "#6b7280" }}>{formatDate(user.lastLoginAt)}</td>
      <td style={{ borderBottom: border, color: "#6b7280" }}>{formatDate(user.createdAt)}</td>
      <td style={{ borderBottom: border }}>
        <button className="au-view-btn" onClick={onView}>View Details</button>
      </td>
    </tr>
  );
}

