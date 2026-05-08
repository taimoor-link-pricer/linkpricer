import { StepNavigation } from "../step-navigation";
import type { OnboardingFormData } from "@/types";

interface StepChallengesProps {
  challenges: string;
  onChange: (data: Partial<OnboardingFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepChallenges({ challenges, onChange, onBack, onNext }: StepChallengesProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          What is your biggest challenge with backlink management?
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm">
          Understanding your pain points helps us prioritize the right features for you.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <textarea
          value={challenges}
          onChange={(e) => onChange({ challenges: e.target.value })}
          placeholder="Tell us about the hurdles you face..."
          rows={6}
          className="w-full min-h-[200px] p-5 rounded-xl bg-surface-container-low border-2 border-transparent focus:border-primary-container focus:bg-surface-container-lowest focus:ring-0 outline-none transition-all text-on-surface placeholder:text-on-surface-variant/50 text-base resize-none"
        />

        <div className="pt-6">
          <StepNavigation onBack={onBack} />
        </div>
      </form>
    </>
  );
}
