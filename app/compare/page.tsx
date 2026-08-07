import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { ComparePageBody } from "@/components/marketing/compare-page-body";

export const metadata: Metadata = {
  title: "Compare backlink prices across every marketplace",
  description: "Paste your domains and see live prices, authority metrics and the single best deal side by side across every backlink marketplace.",
};

export default function ComparePage() {
  return (
    <MarketingLayout>
      <ComparePageBody />
    </MarketingLayout>
  );
}
