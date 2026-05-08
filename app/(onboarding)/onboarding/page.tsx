import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Personalize your Linkpricer experience in just a few steps.",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
