interface StepNavigationProps {
  onBack: () => void;
  isLastStep?: boolean;
}

export function StepNavigation({ onBack, isLastStep = false }: StepNavigationProps) {
  return (
    <div className="pt-10 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="px-6 py-3 text-on-surface-variant font-headline font-bold text-sm hover:text-on-surface transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back
      </button>
      <button
        type="submit"
        className="px-10 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
      >
        {isLastStep ? "Complete Setup" : "Continue"}
        <span className="material-symbols-outlined text-[20px]">
          {isLastStep ? "done_all" : "arrow_forward"}
        </span>
      </button>
    </div>
  );
}
