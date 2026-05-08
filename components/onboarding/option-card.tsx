interface OptionCardProps {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  icon: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
  compact?: boolean;
}

export function OptionCard({
  type,
  name,
  value,
  icon,
  label,
  description,
  checked,
  onChange,
  compact = false,
}: OptionCardProps) {
  const padding = compact ? "p-4" : "p-5";

  return (
    <label
      className={`group relative flex items-center ${padding} rounded-xl cursor-pointer transition-colors border-2 ${
        checked
          ? "border-primary-container bg-surface-container-lowest"
          : "border-transparent bg-surface-container-low hover:bg-surface-container-high"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(value, e.target.checked)}
        className="sr-only"
      />
      <div className="flex items-center gap-4 w-full">
        <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0 group-hover:scale-110 transition-transform">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div className="flex flex-col">
          <span className="font-headline font-bold text-on-surface leading-tight">{label}</span>
          {description && (
            <span className="text-xs text-on-surface-variant mt-0.5">{description}</span>
          )}
        </div>
      </div>
      {checked && (
        <div className="absolute right-5 text-primary flex-shrink-0">
          <span className="material-symbols-filled">check_circle</span>
        </div>
      )}
    </label>
  );
}
