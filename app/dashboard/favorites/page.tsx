"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/lib/contexts/auth-context";
import { ProfileMenu } from "@/components/dashboard/profile-menu";
import { ROUTES } from "@/lib/constants";
import { fmt } from "@/lib/design-v1/format";

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
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FavoritesLoading() {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e8eaed",
        borderRadius: 12,
        padding: "80px 20px",
        textAlign: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          margin: "0 auto",
          border: "3px solid #e8eaed",
          borderTopColor: "#0052cc",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface FavoriteDomain {
  domain: string;
  price: number | null;
  dr: number;
  traffic: number;
  category: string | null;
}

// Same TopBar markup/style as Analyze, Related Sites, and Orders — kept
// local (not extracted to a shared component yet, matching how those three
// pages each already have their own copy) so this page's nav looks and
// behaves identically to the others rather than as a separate design.
function DashboardNav() {
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.4, color: "#0f1620" }}>Linkpricer</span>
        <span style={{ marginLeft: 4, color: "#9ca3af", fontSize: 12 }}>/ app / favorites</span>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {([
          { label: "Analyze", href: ROUTES.search },
          { label: "Related Sites", href: "/dashboard/related-sites" },
          { label: "Favorites", href: null },
          { label: "Orders", href: ROUTES.orders },
        ] as { label: string; href: string | null }[]).map(({ label, href }) =>
          href ? (
            <Link key={label} href={href} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: "#9ca3af", background: "transparent", textDecoration: "none" }}>
              {label}
            </Link>
          ) : (
            <span key={label} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: "default", color: "#0f1620" }}>
              {label}
            </span>
          )
        )}
        <ProfileMenu />
      </nav>
    </header>
  );
}

export default function FavoritesPage() {
  const { loading } = useAuthContext();
  const [favorites, setFavorites] = useState<FavoriteDomain[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((data) => setFavorites(data.favorites ?? []))
      .catch(() => setFavorites([]))
      .finally(() => setFetching(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  async function removeFavorite(domain: string) {
    setFavorites((prev) => prev.filter((f) => f.domain !== domain));
    try {
      await fetch(`/api/favorites?domain=${encodeURIComponent(domain)}`, { method: "DELETE" });
    } catch {
      // best-effort — local state already updated; a stale server row just
      // means it reappears on next visit, not worth blocking the UI on
    }
  }

  return (
    <>
    <style>{`
      .favs-page { padding: 32px 40px; max-width: 1100px; margin: 0 auto; }
      .favs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
      .favs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
      @media (max-width: 768px) {
        .favs-page { padding: 20px 16px; }
        .favs-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
      }
      @media (max-width: 480px) {
        .favs-grid { grid-template-columns: 1fr; }
      }
    `}</style>
    <div className="favs-page">
      <DashboardNav />
      {/* Header */}
      <div className="favs-header">
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#000000",
              margin: "0 0 4px",
            }}
          >
            My Favorites
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            {fetching ? "Loading…" : `${favorites.length} saved domain${favorites.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href={ROUTES.search}
          style={{
            padding: "10px 20px",
            background: "#0052cc",
            color: "#ffffff",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          + Find domains
        </Link>
      </div>

      {fetching ? (
        <FavoritesLoading />
      ) : favorites.length === 0 ? (
        /* Empty state */
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e8eaed",
            borderRadius: 12,
            padding: "80px 20px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>❤️</div>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#374151",
              margin: "0 0 8px",
            }}
          >
            You haven&apos;t saved any domains yet
          </p>
          <p
            style={{
              fontSize: 14,
              color: "#9ca3af",
              margin: "0 0 28px",
              maxWidth: 380,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.6,
            }}
          >
            Search for domains and click the heart icon to save them here for easy comparison later
          </p>
          <Link
            href={ROUTES.search}
            style={{
              padding: "12px 28px",
              background: "#0052cc",
              color: "#ffffff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Search domains
          </Link>
        </div>
      ) : (
        /* Domain cards grid */
        <div className="favs-grid">
          {favorites.map((fav) => (
            <FavoriteCard
              key={fav.domain}
              domain={fav}
              onRemove={() => removeFavorite(fav.domain)}
            />
          ))}
        </div>
      )}
    </div>
    </>
  );
}

function FavoriteCard({
  domain,
  onRemove,
}: {
  domain: FavoriteDomain;
  onRemove: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [removeHover, setRemoveHover] = useState(false);

  return (
    <div
      style={{
        background: "#ffffff",
        border: hover ? "1px solid #0052cc" : "1px solid #e8eaed",
        borderRadius: 12,
        padding: 24,
        boxShadow: hover
          ? "0 4px 16px rgba(0,82,204,0.12)"
          : "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
        transition: "border 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0052cc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "70%",
          }}
        >
          {domain.domain}
        </div>
        <button
          onClick={onRemove}
          onMouseEnter={() => setRemoveHover(true)}
          onMouseLeave={() => setRemoveHover(false)}
          title="Remove from favorites"
          style={{
            background: removeHover ? "#fee2e2" : "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            padding: "4px",
            borderRadius: 6,
            transition: "background 0.15s",
          }}
        >
          ❤️
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
            Price
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#006621" }}>
            {fmt.price(domain.price)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>DR</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
            {domain.dr}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>
            Traffic
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {fmt.num(domain.traffic)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Link
          href={`${ROUTES.search}?domain=${encodeURIComponent(domain.domain)}`}
          style={{
            fontSize: 13,
            color: "#0052cc",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Compare prices →
        </Link>
      </div>
    </div>
  );
}
