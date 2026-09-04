"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Overview", href: "/developers" },
  { label: "Documentation", href: "/developers/docs" },
  { label: "Dashboard", href: "/developers/dashboard" },
  { label: "Billing", href: "/developers/billing" },
];

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .dev-header { background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 50; }
        .dev-header-inner { max-width: 1280px; margin: 0 auto; padding: 0 32px; height: 60px; display: flex; align-items: center; gap: 32px; }
        .dev-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
        .dev-logo-text { font-size: 17px; font-weight: 800; color: #111827; letter-spacing: -0.3px; }
        .dev-logo-badge { background: #e6f2ff; color: #0052cc; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.3px; }
        .dev-nav { display: flex; align-items: center; gap: 4px; flex: 1; }
        .dev-nav-link { padding: 6px 14px; border-radius: 7px; font-size: 14px; font-weight: 500; color: #6b7280; text-decoration: none; transition: all 0.15s; }
        .dev-nav-link:hover { background: #f3f4f6; color: #111827; }
        .dev-nav-link.active { background: #e6f2ff; color: #0052cc; font-weight: 600; }
        .dev-header-cta { padding: 8px 18px; background: #0052cc; color: #fff; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.15s; flex-shrink: 0; }
        .dev-header-cta:hover { background: #003a99; }
        .dev-footer { border-top: 1px solid #e5e7eb; padding: 32px; text-align: center; font-size: 13px; color: #9ca3af; }
        .dev-footer a { color: #6b7280; text-decoration: none; }
        .dev-footer a:hover { color: #0052cc; }
        @media (max-width: 640px) {
          .dev-header-inner { padding: 0 16px; gap: 16px; }
          .dev-nav-link { padding: 6px 10px; font-size: 13px; }
          .dev-logo-badge { display: none; }
        }
      `}</style>

      <header className="dev-header">
        <div className="dev-header-inner">
          <Link href="/developers" className="dev-logo">
            <span className="dev-logo-text">Linkpricer</span>
            <span className="dev-logo-badge">API</span>
          </Link>
          <nav className="dev-nav">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`dev-nav-link${pathname === item.href ? " active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/developers/dashboard" className="dev-header-cta">Get API Key</Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="dev-footer">
        <p>
          &copy; {new Date().getFullYear()} Linkpricer &bull;{" "}
          <Link href="/">Back to app</Link> &bull;{" "}
          <Link href="/privacy">Privacy</Link> &bull;{" "}
          <Link href="/terms">Terms</Link>
        </p>
      </footer>
    </>
  );
}
