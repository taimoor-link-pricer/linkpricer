"use client";

// TopBar nav, extracted from app/dashboard/{search,related-sites,favorites,orders}/page.tsx
// — all four had their own copy of the exact same markup/style (see the
// comment that used to sit on favorites/page.tsx's local DashboardNav,
// explaining that was intentional at the time to avoid touching the other
// three). Consolidating now because the unread-orders badge below needs to
// behave identically everywhere this nav appears, and hand-copying live,
// polling badge state into four separate files is exactly the kind of thing
// that quietly drifts — same reasoning that already justified extracting
// ProfileMenu out of here previously.
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { C } from "@/components/dashboard/results-shared";
import { useUnreadOrders } from "@/lib/contexts/unread-orders-context";
import { ProfileMenu } from "./profile-menu";

export type DashboardNavKey = "analyze" | "relatedSites" | "favorites" | "orders";

const NAV_ITEMS: { key: DashboardNavKey; label: string; href: string; breadcrumb: string }[] = [
  { key: "analyze", label: "Analyze", href: ROUTES.search, breadcrumb: "/ app / analyze" },
  // Not ROUTES.relatedSites ("/related-sites") — that's the logged-out public
  // demo page. The in-app tool these four pages actually link between each
  // other lives at /dashboard/related-sites, which ROUTES has no separate
  // entry for.
  { key: "relatedSites", label: "Related Sites", href: "/dashboard/related-sites", breadcrumb: "/ app / related sites" },
  { key: "favorites", label: "Favorites", href: ROUTES.favorites, breadcrumb: "/ app / favorites" },
  { key: "orders", label: "Orders", href: ROUTES.orders, breadcrumb: "/ app / orders" },
];

export function DashboardNav({
  active,
  breadcrumb,
}: {
  // Optional -- pages that aren't one of the four main tabs (Profile,
  // Settings) render the nav with no tab highlighted and pass their own
  // breadcrumb instead.
  active?: DashboardNavKey;
  breadcrumb?: string;
}) {
  const { totalUnread } = useUnreadOrders();
  const activeItem = NAV_ITEMS.find((item) => item.key === active);
  const breadcrumbText = breadcrumb ?? activeItem?.breadcrumb ?? "";

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .lp-dash-header { flex-wrap: wrap; gap: 10px; }
          .lp-dash-nav { flex-wrap: wrap; width: 100%; gap: 2px !important; }
          .lp-dash-nav a, .lp-dash-nav span:not(.lp-dash-breadcrumb) { padding: 6px 8px !important; font-size: 12.5px !important; }
          .lp-dash-breadcrumb { display: none; }
        }
      `}</style>
      <header className="lp-dash-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: C.ink }}>Linkpricer</span>
          <span className="lp-dash-breadcrumb" style={{ marginLeft: 4, color: C.mute, fontSize: 12 }}>{breadcrumbText}</span>
        </div>
        <nav className="lp-dash-nav" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            // Aggregate unread count sits on "Orders" regardless of which
            // page is active — including the Orders page itself, since
            // being on the list doesn't mean every individual thread on it
            // has been opened yet (that's what the per-row badges are for).
            const badge = item.key === "orders" && totalUnread > 0 ? (
              <span
                aria-label={`${totalUnread} unread order message${totalUnread === 1 ? "" : "s"}`}
                style={{
                  position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, padding: "0 3px",
                  borderRadius: 999, background: "#dc2626", color: "#fff", fontSize: 9.5, fontWeight: 800,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}
              >
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            ) : null;

            if (isActive) {
              return (
                <span key={item.key} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "default", color: C.ink, position: "relative" }}>
                  {item.label}
                  {badge}
                </span>
              );
            }
            return (
              <Link key={item.key} href={item.href} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: C.mute, background: "transparent", textDecoration: "none", position: "relative" }}>
                {item.label}
                {badge}
              </Link>
            );
          })}
          <ProfileMenu />
        </nav>
      </header>
    </>
  );
}
