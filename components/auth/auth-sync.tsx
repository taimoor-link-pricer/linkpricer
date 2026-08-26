"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import {
  finishGoogleSignIn,
  refreshSessionCookie,
  sessionCookieAgeMs,
  isFirebaseError,
} from "@/lib/firebase/auth-client";
import { getPostAuthRoute, redirectParamFromLocation } from "@/lib/auth/post-auth-route";
import { ROUTES } from "@/lib/constants";

// The server cookie lasts 5 days. Re-minting once a day keeps a returning user
// permanently ahead of that without meaningful cost — at most one extra request
// per user per day.
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Site-wide auth housekeeping. Renders nothing.
 *
 * Two jobs that previously had no single owner:
 *
 * 1. Completing a Google sign-in that fell back to a full-page redirect.
 *    This used to be done per-page, and only three pages did it — so starting
 *    Google sign-in from /compare or /related-sites left the user signed into
 *    Firebase with no server session and no error on screen. Redirects can land
 *    on any page that can start one, so the handler belongs at the root.
 *
 * 2. Keeping the session cookie rolling, so it can't quietly expire underneath
 *    a Firebase session that never does.
 */
export function AuthSync() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    finishGoogleSignIn()
      .then(async (result) => {
        if (!result || cancelled) return;
        const route = await getPostAuthRoute(redirectParamFromLocation());
        if (!cancelled) router.replace(route);
      })
      .catch((err) => {
        if (cancelled) return;
        // Never swallow this. The most common failure here is
        // account-exists-with-different-credential — someone who signed up by
        // email and later clicked Google — and silently discarding it left them
        // staring at a login page that appeared to ignore them.
        const code = isFirebaseError(err) ? err.code : "unknown";
        router.replace(`${ROUTES.login}?authError=${encodeURIComponent(code)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    // Fires on load and on every ID token refresh (roughly hourly while a tab
    // is open) — the right cadence to piggyback on, gated by the age stamp so
    // it doesn't POST on every page load.
    return onIdTokenChanged(auth, (user) => {
      if (!user) return;
      const age = sessionCookieAgeMs();
      if (age !== null && age < REFRESH_AFTER_MS) return;
      void refreshSessionCookie(user);
    });
  }, []);

  return null;
}
