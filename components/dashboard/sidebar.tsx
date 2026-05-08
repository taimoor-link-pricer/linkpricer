"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ROUTES } from "@/lib/constants";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: "📊" },
  { label: "Search", href: ROUTES.search, icon: "🔍" },
  { label: "My Orders", href: ROUTES.orders, icon: "🛒" },
  { label: "Favorites", href: ROUTES.favorites, icon: "❤️" },
  { label: "Link Monitors", href: ROUTES.monitors, icon: "📡" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Users", href: ROUTES.adminUsers, icon: "👥" },
  { label: "All Orders", href: ROUTES.adminOrders, icon: "📋" },
  { label: "Marketplaces", href: "/admin/marketplaces", icon: "🏪" },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Settings", href: ROUTES.settings, icon: "⚙️" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, handleSignOut } = useAuthContext();
  const pathname = usePathname();
  const isAdmin = profile?.role === "admin";

  const firstName = profile?.displayName
    ? profile.displayName.split(" ")[0]
    : profile?.email?.split("@")[0] ?? "User";

  function isActive(href: string) {
    if (href === ROUTES.dashboard) return pathname === href;
    return pathname.startsWith(href);
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: "#9ca3af",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "8px 12px 6px",
  };

  function navStyle(href: string): React.CSSProperties {
    const active = isActive(href);
    return {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      borderRadius: 8,
      textDecoration: "none",
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      background: active ? "#e6f2ff" : "transparent",
      color: active ? "#0052cc" : "#4b5563",
      transition: "background 0.15s, color 0.15s",
    };
  }

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#0052cc" }}>Linkpricer</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
            background: isAdmin ? "#fee2e2" : "#eff6ff",
            color: isAdmin ? "#dc2626" : "#2563eb",
            textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            {isAdmin ? "admin" : "client"}
          </span>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="sidebar-close-btn"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: "#6b7280", padding: 4, lineHeight: 1,
          }}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Workspace nav */}
      <div style={{ padding: "0 12px 8px" }}>
        <div style={sectionLabel}>Workspace</div>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={navStyle(item.href)} onClick={onClose}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div style={{ padding: "0 12px 8px" }}>
          <div style={sectionLabel}>Admin</div>
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} style={navStyle(item.href)} onClick={onClose}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Account section */}
      <div style={{ padding: "0 12px 8px" }}>
        <div style={sectionLabel}>Account</div>
        {ACCOUNT_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={navStyle(item.href)} onClick={onClose}>
            <span style={{ fontSize: 15 }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* User info + sign out */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #e8eaed" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{firstName}</div>
          <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {profile?.email ?? ""}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
            fontWeight: 500, color: "#6b7280", background: "none", border: "none",
            cursor: "pointer", padding: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}
        >
          <span>↩</span>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .sidebar-close-btn { display: none; }
        .sidebar-desktop {
          width: 240px; min-width: 240px; background: #ffffff;
          border-right: 1px solid #e8eaed; min-height: 100vh;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
        }
        .sidebar-mobile-overlay {
          display: none;
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          z-index: 998; backdrop-filter: blur(2px);
        }
        .sidebar-mobile-drawer {
          display: none;
          position: fixed; top: 0; left: 0; bottom: 0; width: 260px;
          background: #ffffff; z-index: 999; overflow-y: auto;
          box-shadow: 4px 0 24px rgba(0,0,0,0.15);
          transform: translateX(-100%); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        @media (max-width: 768px) {
          .sidebar-desktop { display: none; }
          .sidebar-close-btn { display: block !important; }
          .sidebar-mobile-drawer { display: block; }
          .sidebar-mobile-overlay.open { display: block; }
          .sidebar-mobile-drawer.open { transform: translateX(0); }
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="sidebar-desktop">{sidebarContent}</div>

      {/* Mobile overlay + drawer */}
      <div className={`sidebar-mobile-overlay${isOpen ? " open" : ""}`} onClick={onClose} />
      <div className={`sidebar-mobile-drawer${isOpen ? " open" : ""}`}>{sidebarContent}</div>
    </>
  );
}
