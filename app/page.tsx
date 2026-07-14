import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { AiSearchHome } from "@/components/marketing/ai-search-home";

export const metadata: Metadata = {
  title: "Linkpricer · AI-powered backlink search",
  description: "Describe the backlink you're looking for and LinkPricer searches 60+ marketplaces to find the best price, instantly.",
};

export default function HomePage() {
  return (
    <MarketingLayout>
      <AiSearchHome />
    </MarketingLayout>
  );
}
