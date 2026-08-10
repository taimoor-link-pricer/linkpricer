"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { signOut } from "@/lib/firebase/auth-client";
import { ROUTES } from "@/lib/constants";
import { btn } from "@/components/design-v1/primitives";

const NAV_LINKS = [
  { label: "AI Search", href: ROUTES.home },
  { label: "Backlink price comparison", href: ROUTES.compare },
  { label: "Related sites", href: ROUTES.relatedSites },
];

// Small avatar + dropdown for signed-in visitors on the public marketing
// header — deliberately NOT the dashboard's ProfileMenu/useAuthContext,
// since AuthProvider force-redirects anyone without a session straight to
// /login and blocks the page behind a full-page loader while it resolves.
// Both of those are correct for gated dashboard pages but would break this
// public page for signed-out visitors (the common case here). This just
// listens to Firebase's own auth state, no redirects, no page-level gate.
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
          <div style={{ padding: "6px 0" }}>
            <Link href={ROUTES.search} onClick={() => setOpen(false)} style={{ display: "block", padding: "9px 16px", fontSize: 13, color: "var(--lp-ink-2)", textDecoration: "none" }}>Dashboard</Link>
            <Link href={ROUTES.settings} onClick={() => setOpen(false)} style={{ display: "block", padding: "9px 16px", fontSize: 13, color: "var(--lp-ink-2)", textDecoration: "none" }}>My profile</Link>
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

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
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
          {user ? (
            <HeaderProfileMenu user={user} />
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
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 0", fontSize: 15, fontWeight: 500, color: "var(--lp-ink-3)", textDecoration: "none", borderBottom: "1px solid var(--lp-line-2)" }}>
              {l.label}
            </Link>
          ))}
          {user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 8 }}>
              <Link href={ROUTES.search} onClick={() => setMenuOpen(false)} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, color: "var(--lp-ink-3)", textDecoration: "none", borderBottom: "1px solid var(--lp-line-2)" }}>Dashboard</Link>
              <Link href={ROUTES.settings} onClick={() => setMenuOpen(false)} style={{ padding: "12px 0", fontSize: 15, fontWeight: 500, color: "var(--lp-ink-3)", textDecoration: "none", borderBottom: "1px solid var(--lp-line-2)" }}>My profile</Link>
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
