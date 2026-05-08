import { OptionCard } from "../option-card";
import { StepNavigation } from "../step-navigation";
import type { OnboardingFormData } from "@/types";

const FACTOR_OPTIONS = [
  { value: "price", icon: "payments", label: "Price" },
  { value: "quality", icon: "high_quality", label: "Website quality" },
  { value: "relevance", icon: "target", label: "Niche relevance" },
  { value: "speed", icon: "speed", label: "Speed" },
  { value: "transparency", icon: "visibility", label: "Transparency" },
] as const;

interface StepFactorsProps {
  importanceFactors: string[];
  onChange: (data: Partial<OnboardingFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepFactors({ importanceFactors, onChange, onBack, onNext }: StepFactorsProps) {
  function toggleFactor(value: string) {
    const updated = importanceFactors.includes(value)
      ? importanceFactors.filter((v) => v !== value)
      : [...importanceFactors, value];
    onChange({ importanceFactors: updated });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          What factors are most important to you?
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm">
          Select all that apply. This helps us customize your dashboard.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3">
          {FACTOR_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              type="checkbox"
              name="importance_factors"
              value={opt.value}
              icon={opt.icon}
              label={opt.label}
              checked={importanceFactors.includes(opt.value)}
              onChange={(v) => toggleFactor(v)}
              compact
            />
          ))}
        </div>

        <StepNavigation onBack={onBack} />
      </form>
    </>
  );
}
