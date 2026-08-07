import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Personalize your Linkpricer experience in just a few steps.",
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}
