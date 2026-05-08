import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export function OnboardingHeader() {
  return (
    <header className="w-full flex justify-between items-center px-8 md:px-12 py-8">
      <Link
        href={ROUTES.home}
        className="text-xl font-extrabold tracking-tighter text-primary font-headline"
      >
        Linkpricer
      </Link>
      <div className="hidden md:flex items-center gap-4 text-sm text-on-surface-variant font-label">
        <span>Already have an account?</span>
        <Link
          href={ROUTES.login}
          className="font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
