"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { btn } from "@/components/design-v1/primitives";

const NAV_LINKS = [
  { label: "AI Search", href: ROUTES.home },
  { label: "Backlink price comparison", href: ROUTES.compare },
  { label: "Related sites", href: ROUTES.relatedSites },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
          <Link href={ROUTES.login} style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, color: "var(--lp-mute)", textDecoration: "none" }}>Log in</Link>
          <Link href={ROUTES.signup} style={{ ...btn("primary"), textDecoration: "none", boxSizing: "border-box" }}>Sign up</Link>
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
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Link href={ROUTES.login} onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", ...btn("ghost"), justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Log in</Link>
            <Link href={ROUTES.signup} onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: "center", ...btn("primary"), justifyContent: "center", textDecoration: "none", boxSizing: "border-box" }}>Sign up</Link>
          </div>
        </div>
      )}
    </>
  );
}
