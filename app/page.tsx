import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { AnalyticsSection } from "@/components/marketing/analytics-section";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "Linkpricer — The Analytical Architect of Backlinks",
  description:
    "A structured, premium environment for high-stakes SEO decision-making and backlink inventory management.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <FeaturesSection />
      <AnalyticsSection />
      <CTASection />
    </MarketingLayout>
  );
}
