"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isInternalTraffic } from "@/lib/analytics";

// Microsoft Clarity (session recordings + heatmaps), project "Linkpricer AI".
// Same rules as GA4 in lib/analytics, for the same reasons:
//
// - Prod-only, so local `next dev` and preview deploys never land in the live
//   Clarity project.
// - Never on /admin, and never in an admin's browser at all (the internal flag
//   GA uses), so recordings are real customers only.
// - Never on /reset-password. Clarity records the full page URL, and that URL
//   carries Firebase's oobCode — a live credential. The reset link always
//   opens as a fresh page load, so not loading Clarity there is enough; if
//   Clarity is already running and the user navigates in, it's paused.
// - No consent override: Clarity itself runs cookieless for EEA/UK/CH until a
//   consent signal arrives (see setAnalyticsConsent).
const CLARITY_PROJECT_ID = "ynpjekn90q";
const ENABLED = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

type ClarityWindow = Window & { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } };

function isExcludedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
}

let loaded = false;

function loadClarity() {
  if (loaded) return;
  loaded = true;
  const w = window as ClarityWindow;
  // Microsoft's snippet: a queueing stub, then the tag script.
  w.clarity =
    w.clarity ||
    function clarity(...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  document.head.appendChild(script);
}

export function Clarity() {
  const pathname = usePathname();

  useEffect(() => {
    if (!ENABLED || isInternalTraffic()) return;
    const excluded = isExcludedPath(pathname);
    if (!loaded) {
      if (!excluded) loadClarity();
      return;
    }
    (window as ClarityWindow).clarity?.(excluded ? "pause" : "resume");
  }, [pathname]);

  return null;
}
