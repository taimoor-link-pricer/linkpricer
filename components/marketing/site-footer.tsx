"use client";

import Link from "next/link";

const FOOTER_COLS = [
  {
    heading: "Linkpricer",
    links: [
      { label: "Home", href: "/" },
      { label: "App", href: "/dashboard" },
      { label: "About", href: "/about" },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "Marketplaces", href: "/marketplaces" },
      { label: "Blog", href: "/blog" },
      { label: "API Docs", href: "/api-docs" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "DPA", href: "/dpa" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Contact us", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <>
      <style>{`
        .footer-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 40px; margin-bottom: 40px; }
        .footer-root { padding: 56px 40px 24px; }
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: repeat(3, 1fr); gap: 28px; }
        }
        @media (max-width: 640px) {
          .footer-root { padding: 40px 16px 20px; }
          .footer-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
        }
      `}</style>
      <footer className="footer-root" style={{ background: "#1a202c", color: "#9ca3af", borderTop: "1px solid #e8eaed" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div className="footer-grid">
            {FOOTER_COLS.map((col) => (
              <div key={col.heading}>
                <h4 style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>{col.heading}</h4>
                {col.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{ display: "block", margin: "9px 0", textDecoration: "none", color: "#9ca3af", fontSize: 13, transition: "color 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#ffffff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#9ca3af"; }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #374151", paddingTop: 20, textAlign: "center", fontSize: 12 }}>
            <p style={{ margin: 0 }}>© 2026 Linkpricer. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
