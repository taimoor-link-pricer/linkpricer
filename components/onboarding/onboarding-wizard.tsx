"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { auth } from "@/lib/firebase/client";
import { completeOnboarding } from "@/lib/firebase/firestore";
import type { OnboardingFormData } from "@/types";

import { OnboardingHeader } from "./onboarding-header";
import { StepProgress } from "./step-progress";
import { TrustSection } from "./trust-section";
import { StepRole } from "./steps/step-role";
import { StepBudget } from "./steps/step-budget";
import { StepChallenges } from "./steps/step-challenges";
import { StepFactors } from "./steps/step-factors";
import { StepAcquisition } from "./steps/step-acquisition";

const TOTAL_STEPS = 5;

const STEP_META = [
  { title: "Personalize your experience", pct: 20 },
  { title: "Investment & Growth", pct: 40 },
  { title: "Tell us about your challenges", pct: 60 },
  { title: "Personalize your experience", pct: 80 },
  { title: "Personalize your experience", pct: 100 },
] as const;

const INITIAL_DATA: OnboardingFormData = {
  userType: "",
  otherRole: "",
  monthlySpend: "",
  challenges: "",
  importanceFactors: [],
  acquisitionMethods: [],
};

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingFormData>(INITIAL_DATA);
  const router = useRouter();

  function updateData(updates: Partial<OnboardingFormData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const user = auth.currentUser;
      if (user) {
        await completeOnboarding(user.uid, {
          userType: data.userType,
          monthlySpend: data.monthlySpend,
          challenges: data.challenges,
          importanceFactors: data.importanceFactors,
          acquisitionMethods: data.acquisitionMethods,
        });
      }
      router.push(ROUTES.dashboard);
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push(ROUTES.signup);
    }
  }

  const { title, pct } = STEP_META[step - 1];

  return (
    <>
      <OnboardingHeader />

      <main className="flex-grow flex flex-col items-center justify-center px-6 pb-12">
        <StepProgress step={step} total={TOTAL_STEPS} title={title} pct={pct} />

        <div className="w-full max-w-2xl bg-surface-container-lowest rounded-xl p-8 md:p-12 shadow-[0_12px_32px_rgba(25,28,30,0.04)]">
          {step === 1 && (
            <StepRole
              userType={data.userType}
              otherRole={data.otherRole}
              onChange={updateData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}
          {step === 2 && (
            <StepBudget
              monthlySpend={data.monthlySpend}
              onChange={updateData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}
          {step === 3 && (
            <StepChallenges
              challenges={data.challenges}
              onChange={updateData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}
          {step === 4 && (
            <StepFactors
              importanceFactors={data.importanceFactors}
              onChange={updateData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}
          {step === 5 && (
            <StepAcquisition
              acquisitionMethods={data.acquisitionMethods}
              onChange={updateData}
              onBack={handleBack}
              onNext={handleNext}
            />
          )}
        </div>

        <TrustSection />
      </main>

      <footer className="py-8 px-12 text-center text-xs text-on-surface-variant/60 font-label">
        <p>© 2024 Linkpricer Analytical Systems. All rights reserved.</p>
      </footer>
    </>
  );
}
