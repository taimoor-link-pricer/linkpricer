import { OptionCard } from "../option-card";
import { StepNavigation } from "../step-navigation";
import type { OnboardingFormData } from "@/types";

const ACQUISITION_OPTIONS = [
  { value: "manual", icon: "mail", label: "Manually contacting sites", description: "Outreach and relations" },
  { value: "marketplaces", icon: "shopping_cart", label: "Using marketplaces", description: "Self-serve platforms" },
  { value: "agencies", icon: "handshake", label: "Through agencies", description: "Managed services" },
  { value: "mixed", icon: "layers", label: "Mixed methods", description: "A combination of tools" },
] as const;

interface StepAcquisitionProps {
  acquisitionMethods: string[];
  onChange: (data: Partial<OnboardingFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepAcquisition({
  acquisitionMethods,
  onChange,
  onBack,
  onNext,
}: StepAcquisitionProps) {
  function toggleMethod(value: string) {
    const updated = acquisitionMethods.includes(value)
      ? acquisitionMethods.filter((v) => v !== value)
      : [...acquisitionMethods, value];
    onChange({ acquisitionMethods: updated });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          How do you currently acquire backlinks?
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm">
          Select all the methods that apply to your current strategy.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACQUISITION_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              type="checkbox"
              name="acquisition_method"
              value={opt.value}
              icon={opt.icon}
              label={opt.label}
              description={opt.description}
              checked={acquisitionMethods.includes(opt.value)}
              onChange={(v) => toggleMethod(v)}
            />
          ))}
        </div>

        <StepNavigation onBack={onBack} isLastStep />
      </form>
    </>
  );
}
