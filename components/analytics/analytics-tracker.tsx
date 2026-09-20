"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { ANALYTICS_ENABLED, initAnalytics, setAnalyticsUser, trackPageView } from "@/lib/analytics";

/**
 * Site-wide GA4 wiring. Renders nothing. See lib/analytics for the policy.
 *
 * Page views are keyed on pathname + search so /dashboard/search?domain=a →
 * ?domain=b still counts as a view; the URL that's actually sent is sanitized.
 * The effect runs after React commits, by which point Next has applied the new
 * route's metadata, so document.title belongs to the page being viewed.
 */
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    trackPageView();
  }, [pathname, search]);

  return null;
}

function UserBinding() {
  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    initAnalytics();
    return onAuthStateChanged(auth, (user) => setAnalyticsUser(user?.uid ?? null));
  }, []);
  return null;
}

export function AnalyticsTracker() {
  if (!ANALYTICS_ENABLED) return null;
  return (
    <>
      <UserBinding />
      <PageViews />
    </>
  );
}
