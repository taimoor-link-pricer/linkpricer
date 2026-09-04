"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type User } from "firebase/auth";
import { signOut } from "@/lib/firebase/auth-client";
import { ROUTES } from "@/lib/constants";
import { useMarketingAuth } from "@/lib/hooks/use-marketing-auth";
import { btn } from "@/components/design-v1/primitives";
import { Icon } from "@/lib/design-v1/icons";

// Same three features either way — only where they point changes. Signed out
// you get the demo of each; signed in you get the real tool, because a
// signed-in user should never land in a demo (proxy.ts enforces the same
// mapping for anyone who reaches the demo URLs some other way).
//
// AI Search is the exception with one href for both: it runs on the real
// catalog already and simply ungates itself when signed in, so there is no
// separate in-app route to point at.
const NAV_LINKS = [
  { label: "AI Search", href: ROUTES.home, appHref: ROUTES.home },
  { label: "Backlink price comparison", href: ROUTES.compare, appHref: ROUTES.search },
  { label: "Related sites", href: ROUTES.relatedSites, appHref: ROUTES.appRelatedSites },
];

// Small avatar + dropdown for signed-in visitors on the public marketing
// header. The reasoning for not reusing the dashboard's ProfileMenu (and its
// AuthProvider) now lives on useMarketingAuth, which this shares.
function HeaderProfileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (user.displayName
    ? user.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : user.email?.[0] ?? "?"
  ).toUpperCase();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #2c64f0, #7c3aed)",
          border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 800, fontSize: 12.5, letterSpacing: 0.5,
        }}
      >
        {initials}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, width: 220, background: "#fff", borderRadius: 12, border: "1px solid var(--lp-line)", boxShadow: "0 8px 32px rgba(15,22,32,0.14)", zIndex: 999, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--lp-line-2)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--lp-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.displayName ?? "Account"}</div>
            <div style={{ fontSize: 11.5, color: "var(--lp-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          </div>
          {/* No "Dashboard" entry any more — the way into the app is the
              Open app button sitting right next to this avatar, and having
              both meant two differently-labelled routes to the same page. */}
          <div style={{ padding: "6px 0" }}>
            <Link href={ROUTES.profile} onClick={() => setOpen(false)} style={{ display: "block", padding: "9px 16px", fontSize: 13, color: "var(--lp-ink-2)", textDecoration: "none" }}>My profile</Link>
            <div style={{ height: 1, background: "var(--lp-line-2)", margin: "4px 0" }} />
            <button
              onClick={() => { setOpen(false); signOut(); }}
              style={{ display: "flex", alignItems: "center", width: "100%", padding: "9px 16px", fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const shimmerBg: React.CSSProperties = {
  background: "linear-gradient(90deg, #eef0f4 0%, #f6f7f9 50%, #eef0f4 100%)",
  backgroundSize: "200% 100%", animation: "lp-shimmer 1.4s infinite",
};

// Signed-out (Log in / Sign up) is the common case, so the skeleton takes
// that shape — two pills sized to match the real Log in link and Sign up
// button — rather than presupposing a signed-in avatar. If auth resolves
// to a logged-in user, this collapses to the single avatar circle instead.
function AuthSkeleton({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ ...shimmerBg, flex: 1, height: 40, borderRadius: 10 }} />
        <div style={{ ...shimmerBg, flex: 1, height: 40, borderRadius: 10 }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ ...shimmerBg, width: 56, height: 32, borderRadius: 8 }} />
      <div style={{ ...shimmerBg, width: 72, height: 40, borderRadius: 10 }} />
    </div>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  // Firebase resolves asynchronously after mount, so for a beat we don't yet
  // know if the visitor is signed in. Rendering "Log in / Sign up" then
  // popping to the avatar (or vice versa) once it resolves reads as a glitch —
  // show a neutral skeleton in that same slot until we know which to render.
  const { user, loading: authLoading, signedIn } = useMarketingAuth();

  // While auth is still unknown, point the nav at the demo routes. They're the
  // right answer for the signed-out majority, and a signed-in user who beats
  // the resolve and clicks one is caught by proxy.ts and bounced to the same
  // app route this would have given them.
  const navHref = (l: (typeof NAV_LINKS)[number]) => (signedIn ? l.appHref : l.href);

  return (
    <>
      <style>{`
        .lp-nav { padding: 0 24px; }
        .lp-nav-links { display: flex; }
        .lp-nav-cta { display: flex; }
        .lp-nav-hamburger { display: none; }
        .lp-mobile-nav { display: none; }
        @media (max-width: 768px) {
          .lp-nav { padding: 0 16px; }
          .lp-nav-links { display: none; }
          .lp-nav-cta { display: none; }
          .lp-nav-hamburger { display: flex; }
          .lp-mobile-nav { display: flex; }
        }
      `}</style>
      <header
        className="lp-nav"
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--lp-line)",
          height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link href={ROUTES.home} style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: -0.4, color: "#000" }}>Linkpricer</span>
        </Link>

        <nav className="lp-nav-links" style={{ alignItems: "center", gap: 4 }}>
          {NAV_LINKS.map((l) => {
            const href = navHref(l);
            const active = pathname === href;
            return (
              <Link
                key={l.label}
                href={href}
                style={{
                  padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, textDecoration: "none",
                  color: active ? "var(--lp-ink)" : "var(--lp-mute)",
                  background: active ? "var(--lp-bg-3)" : "transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
          <span style={{ width: 1, height: 18, background: "var(--lp-line)", margin: "0 6px" }} />
          {authLoading ? (
            <AuthSkeleton />
          ) : user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* The avatar alone used to be the only signed-in affordance, so
                  the way into the actual app was one unlabelled click deep in
                  a dropdown — people read the marketing page as the product
                  and never found it. ROUTES.search rather than
                  ROUTES.dashboard: /dashboard renders nothing. */}
              <Link href={ROUTES.search} style={{ ...btn("primary", "sm"), textDecoration: "none", boxSizing: "border-box", whiteSpace: "nowrap" }}>
                Open app <Icon name="arrowRight" size={13} />
              </Link>
              <HeaderProfileMenu user={user} />
            </div>
          ) : (
            <>
              <Link href={ROUTES.login} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: "var(--lp-mute)", textDecoration: "none" }}>Log in</Link>
              <Link href={ROUTES.signup} style={{ ...btn("primary"), textDecoration: "none", boxSizing: "border-box" }}>Sign up</Link>
            </>
          )}
        </nav>

        <button
          className="lp-nav-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "none", border: "1px solid var(--lp-line)", borderRadius: 8, cursor: "pointer", flexDirection: "column", gap: 4, padding: 0 }}
        >
          <span style={{ display: "block", width: 16, height: 2, background: menuOpen ? "transparent" : "var(--lp-ink-3)", transition: "all 0.2s" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "var(--lp-ink-3)", transform: menuOpen ? "rotate(45deg) translate(3px, -3px)" : "none", transition: "all 0.2s" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "var(--lp-ink-3)", transform: menuOpen ? "rotate(-45deg) translate(3px, 3px)" : "none", transition: "all 0.2s" }} />
        </button>
      </header>

      {menuOpen && (
        <div className="lp-mobile-nav" style={{ flexDirection: "column", background: "#fff", borderBottom: "1px solid var(--lp-line)", padding: 16, gap: 0, zIndex: 49, position: "sticky", top: 64 }}>
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={navHref(l)} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 0", fontSize: 15, fontWeight: 500, color: "var(--lp-ink-3)", textDecoration: "none", borderBottom: "1px solid var(--lp-line-2)" }}>
              {l.label}
            </Link>
          ))}
          {authLoading ? (
            <AuthSkeleton mobile />
          ) : user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 16 }}>
              <Link href={ROUTES.search} onClick={() => setMenuOpen(false)} style={{ ...btn("primary"), justifyContent: "center", textDecoration: "none", boxSizing: "border-box", marginBottom: 8 }}>
                Open app <Icon name="arrowRight" size={13} />
              </Link>
              <Link href={ROUTES.profile} onClick={() => setMenuOpen(false)} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, color: "var(--lp-ink-3)", textDecoration: "none", borderBottom: "1px solid var(--lp-line-2)" }}>My profile</Link>
              <button onClick={() => { setMenuOpen(false); signOut(); }} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, color: "#dc2626", background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>Sign out</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Link href={ROUTES.login} onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", ...btn("ghost"), justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Log in</Link>
              <Link href={ROUTES.signup} onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", ...btn("primary"), justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Sign up</Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}
