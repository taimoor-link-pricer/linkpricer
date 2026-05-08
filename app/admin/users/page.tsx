"use client";

import { useState } from "react";
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
  status: "Active" | "Suspended";
  createdAt: string;
}

export default function AdminUsersPage() {
  const { loading } = useAuthContext();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");

  if (loading) return <LoadingSpinner />;

  // No users loaded yet — empty state
  const users: AdminUser[] = [];

  const filtered = users.filter((u) => {
    if (roleFilter === "Clients") return u.role === "client";
    if (roleFilter === "Admins") return u.role === "admin";
    return true;
  });

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
          Total: {users.length} users
        </div>
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
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
            onClick={() => setRoleFilter(tab)}
          />
        ))}
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
        {filtered.length === 0 ? (
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
              {roleFilter !== "All"
                ? `No ${roleFilter.toLowerCase()} found`
                : "Users will appear here once they sign up"}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Name / Email", "Role", "Status", "Created", "Actions"].map((h) => (
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
                {filtered.map((user, idx) => {
                  const isLast = idx === filtered.length - 1;
                  return (
                    <UserRow key={user.id} user={user} isLast={isLast} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function UserRow({
  user,
  isLast,
}: {
  user: AdminUser;
  isLast: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [suspended, setSuspended] = useState(user.status === "Suspended");
  const [suspendHover, setSuspendHover] = useState(false);

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
            style={{
              padding: "5px 12px",
              background: "transparent",
              border: "1px solid #e8eaed",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              color: "#0052cc",
              fontWeight: 500,
            }}
          >
            View
          </button>
          <button
            onClick={() => setSuspended((s) => !s)}
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
