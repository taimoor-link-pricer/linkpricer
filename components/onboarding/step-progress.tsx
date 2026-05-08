interface StepProgressProps {
  step: number;
  total: number;
  title: string;
  pct: number;
}

export function StepProgress({ step, total, title, pct }: StepProgressProps) {
  return (
    <div className="w-full max-w-2xl mb-12">
      <div className="flex justify-between items-end mb-4">
        <div className="flex flex-col">
          <span className="font-headline font-bold text-primary text-sm tracking-tight uppercase">
            Step {step} of {total}
          </span>
          <h1 className="font-headline font-extrabold text-2xl md:text-3xl text-on-surface mt-1">
            {title}
          </h1>
        </div>
        <div className="text-on-surface-variant text-xs font-label bg-surface-container-high px-3 py-1 rounded-full whitespace-nowrap">
          {pct}% Complete
        </div>
      </div>

      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-full ${
              i < step ? "active-step-indicator" : "bg-surface-container-highest"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
