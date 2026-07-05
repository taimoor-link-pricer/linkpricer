import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { HeroSection } from "@/components/marketing/hero-section";

export const metadata: Metadata = {
  title: "Linkpricer · Compare backlink prices, buy the best deal",
  description: "LinkPricer brings every backlink marketplace into one search — compare prices side by side, see the single best deal, and order directly, with low fees.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <HeroSection />
    </MarketingLayout>
  );
}
