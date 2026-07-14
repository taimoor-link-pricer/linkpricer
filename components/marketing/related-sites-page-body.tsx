"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { btn } from "@/components/design-v1/primitives";
import { Icon } from "@/lib/design-v1/icons";
import { SectionHead } from "./section-head";
import { SignupModal, type SignupReason } from "./signup-modal";
import { DemoRelated } from "./demo/DemoRelated";

const FREE_SEARCHES = 2;

export function RelatedSitesPageBody() {
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
    <div className="lp-reset" id="top" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <style>{`
        @media (max-width: 760px) {
          .lp-demo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 52px" }}>
        <SectionHead
          step="2"
          eyebrow="Related sites"
          title="Discover relevant sites you haven't considered"
          body="Start from a domain or topic and surface topically related sites, ranked by relevance and price-per-authority — then compare and order them the same way."
        />

        <DemoRelated gate={gate} requireSignup={requireSignup} searchesLeft={searchesLeft} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginTop: 26, fontSize: 14, color: "var(--lp-ink-3)" }}>
          <span>Want real results across every live marketplace?</span>
          <Link href={ROUTES.login} style={{ ...btn("primary", "sm"), textDecoration: "none", boxSizing: "border-box" }}>Log in to search live data <Icon name="arrowRight" size={13} /></Link>
        </div>
      </div>

      {signup && <SignupModal reason={signup} onClose={() => setSignup(null)} />}
    </div>
  );
}
