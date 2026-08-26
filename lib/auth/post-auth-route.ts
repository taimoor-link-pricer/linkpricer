import { ROUTES, validRedirect } from "@/lib/constants";

/**
 * Where a user should land once they are authenticated.
 *
 * Shared so the login form, the signup form and the global redirect handler
 * can't drift apart — they each had their own copy of this, which is how a
 * Google sign-in that fell back to a full-page redirect ended up routed
 * differently from the identical popup sign-in.
 */
export async function getPostAuthRoute(redirect: string | null): Promise<string> {
  try {
    const res = await fetch("/api/user/me");
    if (res.ok) {
      const data = await res.json();
      if (data.role === "vendor") return ROUTES.admin;
      if (!data.hasCompletedOnboarding) {
        return redirect ? `${ROUTES.onboarding}?redirect=${encodeURIComponent(redirect)}` : ROUTES.onboarding;
      }
    }
  } catch {
    // Fall through to the default — a transient failure here shouldn't strand
    // a user who has just successfully signed in.
  }
  return redirect ?? ROUTES.search;
}

/**
 * Reads `?redirect=` straight off the URL rather than via useSearchParams.
 *
 * AuthSync is mounted in the root layout, and useSearchParams there would opt
 * the client tree of every prerendered page into client-side rendering.
 */
export function redirectParamFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return validRedirect(new URLSearchParams(window.location.search).get("redirect"));
}
