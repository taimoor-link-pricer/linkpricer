import { OptionCard } from "../option-card";
import { StepNavigation } from "../step-navigation";
import type { OnboardingFormData } from "@/types";

const BUDGET_OPTIONS = [
  { value: "under_1000", icon: "payments", label: "Under €1,000", description: "Basic SEO needs" },
  { value: "1000_5000", icon: "account_balance_wallet", label: "€1,000–€5,000", description: "Scaling growth" },
  { value: "5000_20000", icon: "trending_up", label: "€5,000–€20,000", description: "Professional SEO operations" },
  { value: "20000_plus", icon: "rocket_launch", label: "€20,000+", description: "Enterprise scale" },
] as const;

interface StepBudgetProps {
  monthlySpend: string;
  onChange: (data: Partial<OnboardingFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepBudget({ monthlySpend, onChange, onBack, onNext }: StepBudgetProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          What is your average monthly spend on backlinks?
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm">
          This helps us recommend the right pricing tier and inventory for your budget.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BUDGET_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              type="radio"
              name="monthly_spend"
              value={opt.value}
              icon={opt.icon}
              label={opt.label}
              description={opt.description}
              checked={monthlySpend === opt.value}
              onChange={(v) => onChange({ monthlySpend: v })}
            />
          ))}
        </div>

        <StepNavigation onBack={onBack} />
      </form>
    </>
  );
}
