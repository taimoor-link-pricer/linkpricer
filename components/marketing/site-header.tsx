"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{`
        .site-header { padding: 0 40px; }
        .site-nav { display: flex; }
        .site-header-actions { display: flex; }
        .site-hamburger { display: none; }
        .mobile-nav { display: none; }
        @media (max-width: 768px) {
          .site-header { padding: 0 16px; }
          .site-nav { display: none; }
          .site-header-actions { display: none; }
          .site-hamburger { display: flex; }
          .mobile-nav { display: flex; }
        }
      `}</style>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e8eaed", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 1000, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }} className="site-header">
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.5px", color: "#000000" }}>Linkpricer</div>

        <nav className="site-nav" style={{ gap: 32, alignItems: "center" }}>
          <Link href="#marketplaces" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Marketplaces</Link>
          <Link href="#blog" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Blog</Link>
          <Link href="#about" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>About</Link>
          <Link href="#api" style={{ color: "#6b7280", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>API</Link>
        </nav>

        <div className="site-header-actions" style={{ gap: 10, alignItems: "center" }}>
          <Link href={ROUTES.login} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#0052cc", background: "#ffffff", border: "1px solid #0052cc", borderRadius: 8, textDecoration: "none" }}>
            Log in
          </Link>
          <Link href={ROUTES.signup} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#ffffff", background: "#0052cc", borderRadius: 8, textDecoration: "none" }}>
            Start free
          </Link>
        </div>

        <button
          className="site-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "none", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", flexDirection: "column", gap: 4, padding: 0 }}
        >
          <span style={{ display: "block", width: 16, height: 2, background: menuOpen ? "transparent" : "#374151", transition: "all 0.2s" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "#374151", transform: menuOpen ? "rotate(45deg) translate(3px, -3px)" : "none", transition: "all 0.2s" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "#374151", transform: menuOpen ? "rotate(-45deg) translate(3px, 3px)" : "none", transition: "all 0.2s" }} />
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-nav" style={{ flexDirection: "column", background: "#ffffff", borderBottom: "1px solid #e8eaed", padding: "16px", gap: 0, zIndex: 999, position: "sticky", top: 56 }}>
          {["Marketplaces", "Blog", "About", "API"].map((label) => (
            <Link key={label} href="#" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 0", fontSize: 15, fontWeight: 500, color: "#374151", textDecoration: "none", borderBottom: "1px solid #f0f2f5" }}>
              {label}
            </Link>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Link href={ROUTES.login} style={{ flex: 1, textAlign: "center", padding: "10px", fontSize: 14, fontWeight: 600, color: "#0052cc", border: "1px solid #0052cc", borderRadius: 8, textDecoration: "none" }}>Log in</Link>
            <Link href={ROUTES.signup} style={{ flex: 1, textAlign: "center", padding: "10px", fontSize: 14, fontWeight: 600, color: "#ffffff", background: "#0052cc", borderRadius: 8, textDecoration: "none" }}>Start free</Link>
          </div>
        </div>
      )}
    </>
  );
}
