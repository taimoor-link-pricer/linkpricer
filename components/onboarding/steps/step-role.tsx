import { OptionCard } from "../option-card";
import { StepNavigation } from "../step-navigation";
import type { OnboardingFormData } from "@/types";

const ROLE_OPTIONS = [
  { value: "agency", icon: "corporate_fare", label: "SEO Agency", description: "Managing multiple clients" },
  { value: "freelancer", icon: "person", label: "Freelancer", description: "Independent SEO consultant" },
  { value: "in-house", icon: "business_center", label: "In-house Marketer", description: "Working for a single company" },
  { value: "brand", icon: "storefront", label: "Brand Owner", description: "Managing your own assets" },
] as const;

interface StepRoleProps {
  userType: string;
  otherRole: string;
  onChange: (data: Partial<OnboardingFormData>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function StepRole({ userType, otherRole, onChange, onBack, onNext }: StepRoleProps) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="font-headline font-bold text-xl text-on-surface">
          Which best describes your role?
        </h2>
        <p className="text-on-surface-variant mt-2 text-sm">
          We&apos;ll tailor the Linkpricer interface based on your specific needs.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.value}
              type="radio"
              name="user_type"
              value={opt.value}
              icon={opt.icon}
              label={opt.label}
              description={opt.description}
              checked={userType === opt.value}
              onChange={(v) => onChange({ userType: v })}
            />
          ))}
        </div>

        {/* Other with text input */}
        <div className="mt-4">
          <label
            className={`group relative flex flex-col p-5 rounded-xl cursor-pointer transition-colors border-2 focus-within:border-primary-container focus-within:bg-surface-container-lowest ${
              userType === "other"
                ? "border-primary-container bg-surface-container-lowest"
                : "border-transparent bg-surface-container-low hover:bg-surface-container-high"
            }`}
          >
            <div className="flex items-center gap-4 w-full mb-3">
              <input
                type="radio"
                name="user_type"
                value="other"
                checked={userType === "other"}
                onChange={() => onChange({ userType: "other" })}
                className="w-5 h-5 text-primary border-outline-variant focus:ring-primary/20"
              />
              <span className="font-headline font-bold text-on-surface">Other</span>
            </div>
            <input
              type="text"
              value={otherRole}
              onChange={(e) => onChange({ otherRole: e.target.value })}
              placeholder="Tell us your role..."
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-outline/50"
            />
          </label>
        </div>

        <StepNavigation onBack={onBack} />
      </form>
    </>
  );
}
