import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { HeroSection } from "@/components/marketing/hero-section";

export const metadata: Metadata = {
  title: "Linkpricer — Bulk-compare backlink prices. Order directly.",
  description: "Upload up to 200 domains and compare guest post prices across 60+ marketplaces instantly.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HeroSection />
    </MarketingLayout>
  );
}
