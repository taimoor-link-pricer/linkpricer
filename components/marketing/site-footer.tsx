"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/constants";

const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 0 };
const h5: React.CSSProperties = { margin: "0 0 14px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--lp-mute)" };
const lnk: React.CSSProperties = { textDecoration: "none", color: "var(--lp-ink-3)", fontSize: 14, padding: "5px 0" };

export function SiteFooter() {
  return (
    <>
      <style>{`
        .lp-foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 32px; }
        @media (max-width: 760px) {
          .lp-foot-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
      `}</style>
      <footer style={{ borderTop: "1px solid var(--lp-line)", marginTop: 80, background: "var(--lp-bg-3)" }}>
        <div className="lp-foot-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 36px" }}>
          <div>
            <span style={{ display: "block", fontWeight: 800, color: "#000", fontSize: 19, letterSpacing: -0.4, marginBottom: 12 }}>Linkpricer</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--lp-mute)", maxWidth: 260 }}>Every backlink marketplace in one search. Compare prices, see the best deal, and order directly.</p>
          </div>
          <div style={col}>
            <h5 style={h5}>Product</h5>
            <Link href={ROUTES.home} style={lnk}>AI Search</Link>
            <Link href={ROUTES.compare} style={lnk}>Price comparison</Link>
            <Link href={ROUTES.relatedSites} style={lnk}>Related sites</Link>
          </div>
          <div style={col}>
            <h5 style={h5}>Resources</h5>
            <Link href="/docs" style={lnk}>Docs</Link>
            <Link href="/blog" style={lnk}>Blog</Link>
            <Link href="/blog?type=guides" style={lnk}>Guides</Link>
          </div>
          <div style={col}>
            <h5 style={h5}>Company</h5>
            <Link href={ROUTES.about} style={lnk}>About</Link>
            <Link href={ROUTES.contact} style={lnk}>Contact</Link>
            <Link href={ROUTES.login} style={lnk}>Log in</Link>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--lp-line)" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", fontSize: 13, color: "var(--lp-mute)" }}>
            <span>© 2026 Linkpricer, UAB. All rights reserved.</span>
            <span>Reg. No. 306947938 · Kaunas, Lithuania</span>
          </div>
        </div>
      </footer>
    </>
  );
}
