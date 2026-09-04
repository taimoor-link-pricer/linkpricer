"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { btn } from "@/components/design-v1/primitives";
import { SectionHead } from "./section-head";
import { SignupModal, type SignupReason } from "./signup-modal";
import { DemoRedirect } from "./demo-redirect";
import { DemoAnalyze } from "./demo/DemoAnalyze";

const FREE_SEARCHES = 2;

export function ComparePageBody() {
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [signup, setSignup] = useState<SignupReason | null>(null);

  const searchesLeft = Math.max(0, FREE_SEARCHES - searchesUsed);
  const gate = () => {
    if (searchesUsed >= FREE_SEARCHES) { setSignup("search"); return false; }
    setSearchesUsed((n) => n + 1);
    return true;
  };
  const requireSignup = (reason?: string) => setSignup((reason as SignupReason) || "generic");

  return (
    <div className="lp-reset" id="top" style={{ background: "var(--lp-bg)", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <DemoRedirect to={ROUTES.search} />
      <style>{`
        @media (max-width: 760px) {
          .lp-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 52px" }}>
        <SectionHead
          step="1"
          eyebrow="Backlink price comparison"
          title="Compare prices across every marketplace"
          body="Paste your domains and see live prices, authority metrics and the single best deal side by side. This is the real app on a sample dataset — search and expand any result."
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px 16px", marginBottom: 16, background: "#fdf2dd", border: "1px solid #f0dca8", borderRadius: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#7a5200", fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#a35d00", flexShrink: 0 }} />
            Sample data — log in to search live marketplaces.
          </div>
          <Link href={ROUTES.login} style={{ ...btn("primary", "sm"), background: "#a35d00", boxShadow: "none", whiteSpace: "nowrap", textDecoration: "none", boxSizing: "border-box" }}>Log in to go live</Link>
        </div>

        <DemoAnalyze gate={gate} requireSignup={requireSignup} searchesLeft={searchesLeft} />
      </div>

      {signup && <SignupModal reason={signup} onClose={() => setSignup(null)} />}
    </div>
  );
}
