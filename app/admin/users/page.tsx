"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "@/lib/contexts/auth-context";

function LoadingSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #e8eaed",
          borderTopColor: "#dc2626",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

type RoleFilter = "All" | "Clients" | "Admins";
const ROLE_FILTERS: RoleFilter[] = ["All", "Clients", "Admins"];

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "client" | "admin";
  isAdmin: boolean;
  status: "Active" | "Suspended";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { loading } = useAuthContext();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter === "Clients") params.set("role", "client");
      // Filters on the isAdmin capability, not role="vendor" -- a
      // dual-capability admin keeps role="client", so filtering by role
      // alone would hide them from this tab.
      if (roleFilter === "Admins") params.set("admin", "true");
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setDataLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  function handleFilterChange(next: RoleFilter) {
    setRoleFilter(next);
    setPage(1);
  }

  async function toggleSuspend(user: AdminUser) {
    const nextSuspended = user.status !== "Suspended";
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextSuspended ? "Suspended" : "Active" } : u)));
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, suspended: nextSuspended }),
    });
    if (!res.ok) {
      // Revert on failure
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u)));
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to update user.");
    }
  }

  async function toggleAdmin(user: AdminUser) {
    const nextIsAdmin = !user.isAdmin;
    const verb = nextIsAdmin ? "grant" : "revoke";
    if (!confirm(`Are you sure you want to ${verb} admin access for ${user.name} (${user.email})?`)) return;

    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: nextIsAdmin } : u)));
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, isAdmin: nextIsAdmin }),
    });
    if (!res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: user.isAdmin } : u)));
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to update admin access.");
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
    <style>{`.admin-users-page{padding:32px 40px;max-width:1200px;margin:0 auto}@media(max-width:768px){.admin-users-page{padding:20px 16px}}`}</style>
    <div className="admin-users-page">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#000000",
              margin: "0 0 4px",
            }}
          >
            Users
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            Manage all platform user accounts
          </p>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 8,
            padding: "8px 16px",
          }}
        >
          Total: {total} users
        </div>
      </div>

      {/* Filter tabs + search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {ROLE_FILTERS.map((tab) => (
            <TabButton
              key={tab}
              label={tab}
              active={roleFilter === tab}
              onClick={() => handleFilterChange(tab)}
            />
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email…"
          style={{
            flex: "1 1 240px",
            maxWidth: 320,
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #e8eaed",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8eaed",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {dataLoading ? (
          <div style={{ textAlign: "center", padding: "64px 20px", color: "#9ca3af", fontSize: 13 }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#374151",
                margin: "0 0 8px",
              }}
            >
              No users found
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              {roleFilter !== "All" || search
                ? "Try a different filter or search term"
                : "Users will appear here once they sign up"}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Name / Email", "Role", "Admin Access", "Status", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        borderBottom: "1px solid #e8eaed",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => {
                  const isLast = idx === users.length - 1;
                  return (
                    <UserRow key={user.id} user={user} isLast={isLast} onToggleSuspend={() => toggleSuspend(user)} onToggleAdmin={() => toggleAdmin(user)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: page <= 1 ? "default" : "pointer", fontSize: 13, color: page <= 1 ? "#d1d5db" : "#374151" }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: "#6b7280", padding: "6px 4px" }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e8eaed", background: "#fff", cursor: page >= totalPages ? "default" : "pointer", fontSize: 13, color: page >= totalPages ? "#d1d5db" : "#374151" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
    </>
  );
}

function UserRow({
  user,
  isLast,
  onToggleSuspend,
  onToggleAdmin,
}: {
  user: AdminUser;
  isLast: boolean;
  onToggleSuspend: () => void;
  onToggleAdmin: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [suspendHover, setSuspendHover] = useState(false);
  const [adminHover, setAdminHover] = useState(false);
  const suspended = user.status === "Suspended";

  return (
    <tr
      style={{
        background: hover ? "#f9fafb" : "#ffffff",
        transition: "background 0.1s",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
          {user.name}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{user.email}</div>
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 99,
            background: user.role === "admin" ? "#fee2e2" : "#eff6ff",
            color: user.role === "admin" ? "#dc2626" : "#2563eb",
            textTransform: "capitalize",
          }}
        >
          {user.role}
        </span>
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 99,
            background: user.isAdmin ? "#ede9fe" : "#f3f4f6",
            color: user.isAdmin ? "#6d28d9" : "#6b7280",
          }}
        >
          {user.isAdmin ? "Yes" : "No"}
        </span>
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 99,
            background: suspended ? "#fee2e2" : "#dcfce7",
            color: suspended ? "#991b1b" : "#166534",
          }}
        >
          {suspended ? "Suspended" : "Active"}
        </span>
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
          color: "#6b7280",
          fontSize: 13,
        }}
      >
        {user.createdAt}
      </td>
      <td
        style={{
          padding: "14px 20px",
          borderBottom: isLast ? "none" : "1px solid #f0f2f5",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onToggleSuspend}
            onMouseEnter={() => setSuspendHover(true)}
            onMouseLeave={() => setSuspendHover(false)}
            style={{
              padding: "5px 12px",
              background: suspended ? (suspendHover ? "#dcfce7" : "transparent") : (suspendHover ? "#fee2e2" : "transparent"),
              border: "1px solid",
              borderColor: suspended ? "#166534" : "#dc2626",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: suspended ? "#166534" : "#dc2626",
              fontWeight: 500,
              transition: "background 0.15s",
            }}
          >
            {suspended ? "Restore" : "Suspend"}
          </button>
          <button
            onClick={onToggleAdmin}
            onMouseEnter={() => setAdminHover(true)}
            onMouseLeave={() => setAdminHover(false)}
            style={{
              padding: "5px 12px",
              background: adminHover ? "#ede9fe" : "transparent",
              border: "1px solid #6d28d9",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: "#6d28d9",
              fontWeight: 500,
              transition: "background 0.15s",
            }}
          >
            {user.isAdmin ? "Revoke Admin" : "Make Admin"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 14px",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        background: active ? "#dc2626" : hover ? "#f5f6f8" : "transparent",
        color: active ? "#ffffff" : hover ? "#374151" : "#6b7280",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
