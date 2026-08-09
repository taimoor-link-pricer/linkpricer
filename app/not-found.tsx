import type { Metadata } from "next";
import Link from "next/link";
import { MarketingLayout } from "@/components/marketing/marketing-layout";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist — head back to the Linkpricer homepage.",
};

export default function NotFound() {
  return (
    <MarketingLayout>
      <style>{`
        .lp-404-wrap {
          max-width: 640px;
          margin: 0 auto;
          padding: 120px 24px 140px;
          text-align: center;
        }
        .lp-404-eyebrow {
          font-family: var(--lp-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--lp-accent-700);
          margin-bottom: 22px;
        }
        .lp-404-emoji {
          font-size: 56px;
          line-height: 1;
          margin-bottom: 24px;
        }
        .lp-404-wrap h1 {
          margin: 0;
          font-size: clamp(28px, 4.5vw, 40px);
          font-weight: 800;
          letter-spacing: -1.2px;
          color: var(--lp-ink);
          text-wrap: balance;
        }
        .lp-404-wrap p {
          margin: 16px auto 0;
          max-width: 420px;
          font-size: 16px;
          line-height: 1.6;
          color: var(--lp-ink-3);
        }
        .lp-404-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 36px;
          padding: 12px 24px;
          border-radius: var(--lp-r-lg);
          background: var(--lp-accent);
          color: var(--lp-accent-ink);
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          box-shadow: var(--lp-shadow-2);
          transition: background 0.15s ease;
        }
        .lp-404-cta:hover { background: var(--lp-accent-700); }
      `}</style>
      <div className="lp-404-wrap">
        <div className="lp-404-eyebrow">404</div>
        <div className="lp-404-emoji">🔗💔</div>
        <h1>This link led nowhere.</h1>
        <p>
          The page you&apos;re looking for doesn&apos;t exist, moved, or never
          did. Let&apos;s get you back to somewhere real.
        </p>
        <Link href="/" className="lp-404-cta">
          Take me home →
        </Link>
      </div>
    </MarketingLayout>
  );
}
