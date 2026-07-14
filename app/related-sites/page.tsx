import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { RelatedSitesPageBody } from "@/components/marketing/related-sites-page-body";

export const metadata: Metadata = {
  title: "Linkpricer · Discover related backlink sites",
  description: "Start from a domain or topic and surface topically related sites, ranked by relevance and price-per-authority.",
};

export default function RelatedSitesPage() {
  return (
    <MarketingLayout>
      <RelatedSitesPageBody />
    </MarketingLayout>
  );
}
