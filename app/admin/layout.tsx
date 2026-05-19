"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

const ADMIN_NAV = [
  { label: "Overview", href: ROUTES.admin, icon: "📊" },
  { label: "Users", href: ROUTES.adminUsers, icon: "👥" },
  { label: "All Orders", href: ROUTES.adminOrders, icon: "📋" },
  { label: "Marketplaces", href: "/admin/marketplaces", icon: "🏪" },
  { label: "Domain Examples", href: "/admin/domain-examples", icon: "🔗" },
];

const BLOG_NAV = [
  { label: "Blog Posts", href: ROUTES.adminBlog, icon: "📝" },
  { label: "Authors", href: ROUTES.adminBlogAuthors, icon: "✍️" },
];

function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile, handleSignOut } = useAuthContext();
  const pathname = usePathname();

  function isActive(href: string) {
    return href === ROUTES.admin ? pathname === href : pathname.startsWith(href);
  }

  function navStyle(href: string): React.CSSProperties {
    const active = isActive(href);
    return {
      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
      borderRadius: 8, textDecoration: "none", fontSize: 14,
      fontWeight: active ? 600 : 500,
      background: active ? "#fee2e2" : "transparent",
      color: active ? "#dc2626" : "#4b5563",
      transition: "background 0.15s, color 0.15s",
    };
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#9ca3af",
    letterSpacing: "0.8px", textTransform: "uppercase", padding: "8px 12px 6px",
  };

  const content = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#dc2626" }}>Admin</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#fee2e2", color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>panel</span>
          </div>
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "3px 0 0" }}>Linkpricer</p>
        </div>
        <button onClick={onClose} className="admin-sidebar-close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", padding: 4, lineHeight: 1 }} aria-label="Close">✕</button>
      </div>

      <div style={{ padding: "0 12px 8px", flex: 1, overflowY: "auto" }}>
        <div style={sectionLabel}>Admin</div>
        {ADMIN_NAV.map((item) => (
          <Link key={item.href} href={item.href} style={navStyle(item.href)} onClick={onClose}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        <div style={{ ...sectionLabel, marginTop: 12 }}>Content</div>
        {BLOG_NAV.map((item) => (
          <Link key={item.href} href={item.href} style={navStyle(item.href)} onClick={onClose}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #e8eaed" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{profile?.displayName ?? profile?.email?.split("@")[0] ?? "Admin"}</div>
          <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.email ?? ""}</div>
        </div>
<button onClick={handleSignOut} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}>
          <span>↩</span><span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .admin-sidebar-close { display: none; }
        .admin-sidebar-desktop { width: 240px; min-width: 240px; background: #ffffff; border-right: 1px solid #e8eaed; min-height: 100vh; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .admin-sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 998; backdrop-filter: blur(2px); }
        .admin-sidebar-drawer { display: none; position: fixed; top: 0; left: 0; bottom: 0; width: 260px; background: #ffffff; z-index: 999; overflow-y: auto; box-shadow: 4px 0 24px rgba(0,0,0,0.15); transform: translateX(-100%); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none; }
          .admin-sidebar-close { display: block !important; }
          .admin-sidebar-drawer { display: block; }
          .admin-sidebar-overlay.open { display: block; }
          .admin-sidebar-drawer.open { transform: translateX(0); }
        }
      `}</style>
      <div className="admin-sidebar-desktop">{content}</div>
      <div className={`admin-sidebar-overlay${isOpen ? " open" : ""}`} onClick={onClose} />
      <div className={`admin-sidebar-drawer${isOpen ? " open" : ""}`}>{content}</div>
    </>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { handleSignOut } = useAuthContext();

  return (
    <>
      <style>{`
        .admin-mobile-topbar { display: none; align-items: center; justify-content: space-between; padding: 12px 20px; background: #ffffff; border-bottom: 1px solid #e8eaed; position: sticky; top: 0; z-index: 100; }
        @media (max-width: 768px) { .admin-mobile-topbar { display: flex; } }
      `}</style>
      <div className="admin-mobile-topbar">
        <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#374151", padding: 4 }} aria-label="Open menu">☰</button>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#dc2626" }}>Admin Panel</span>
        <button onClick={handleSignOut} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Sign out</button>
      </div>
      <div style={{ display: "flex", minHeight: "100vh", background: "#f5f6f8" }}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>{children}</div>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireAdmin>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
