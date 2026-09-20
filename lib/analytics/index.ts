"use client";

// Google Analytics 4, via the Firebase Analytics SDK on our existing Firebase
// app. Every export is a safe no-op when analytics is disabled, unsupported
// (SSR, some privacy browsers, blocked by an extension) or still loading —
// callers never need to guard, await, or try/catch.
//
// Things that are deliberate, and easy to undo by accident:
//
// - Prod-only. linkpricer-dev is the one Firebase project behind BOTH local dev
//   and the live site, so without this gate every `next dev` session would land
//   in the production GA property. NEXT_PUBLIC_ANALYTICS_DEBUG=1 turns it on
//   locally, flagged as debug traffic (GA → Admin → DebugView), which the
//   standard reports exclude.
//
// - Manual page views. send_page_view is off and <AnalyticsTracker> sends one
//   per App Router navigation, with the query string reduced to an allowlist.
//   Password-reset links carry Firebase's `oobCode` (a live credential) and
//   auth pages carry `?redirect=`; GA's automatic page_view would ship both.
//   The matching GA setting — Admin → Data streams → Enhanced measurement →
//   Page views → "Page changes based on browser history events" — must be OFF,
//   or every navigation is counted twice and the raw URL leaks anyway.
//
// - Consent Mode v2 defaults. Analytics cookies are denied by default for
//   EEA/UK/CH visitors (GA still receives cookieless pings and models them),
//   granted elsewhere. Ads signals are denied everywhere — we don't run Google
//   Ads off this property. A future cookie banner calls setAnalyticsConsent().
//
// - /admin is never tracked, and admins are tagged traffic_type=internal on
//   every page so GA's "Internal Traffic" data filter can drop them.

import type { Analytics } from "firebase/analytics";
import { getFirebaseApp } from "@/lib/firebase/client";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";
export const ANALYTICS_ENABLED =
  Boolean(MEASUREMENT_ID) && (process.env.NEXT_PUBLIC_VERCEL_ENV === "production" || DEBUG);

// EEA + UK + Switzerland: where analytics cookies need prior opt-in.
const CONSENT_REQUIRED_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE", "GB", "CH",
];

// Query params worth keeping on page_location — campaign attribution only.
// Everything else is dropped, including anything we add later, so a new
// sensitive param can't leak by default.
const ALLOWED_QUERY_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ref",
]);

const INTERNAL_KEY = "lp:analytics-internal";

// ─── Event catalogue ─────────────────────────────────────────────────────────
// One place that says what we send. GA4 limits: ≤40-char names, ≤100-char
// string values, ≤25 params. Never put emails, names, or free text here.

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

type EventMap = {
  sign_up: { method: "password" | "google" };
  login: { method: "password" | "google" };
  analyze_domains: { domain_count: number; found_count: number; niche: string };
  begin_checkout: { currency: "USD"; value: number; items: AnalyticsItem[] };
  purchase: { transaction_id: string; currency: "USD"; value: number; items: AnalyticsItem[] };
  buy_direct_click: { marketplace: string; domain: string };
};

export type AnalyticsEvent = keyof EventMap;

// ─── Lazy init ───────────────────────────────────────────────────────────────

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

let analyticsPromise: Promise<Analytics | null> | null = null;

function readInternalFlag(): boolean {
  try {
    return window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

// Consent defaults must reach the dataLayer before gtag.js processes its first
// `config` — i.e. before Firebase initializes. Firebase wraps an existing
// window.gtag rather than replacing it, so defining the standard stub is safe.
function pushConsentDefaults() {
  const w = window as GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // gtag.js only understands the Arguments object, not a plain array.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  const denyAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  w.gtag("consent", "default", { ...denyAds, analytics_storage: "granted" });
  w.gtag("consent", "default", {
    ...denyAds,
    analytics_storage: "denied",
    region: CONSENT_REQUIRED_REGIONS,
    wait_for_update: 500,
  });
}

function loadAnalytics(): Promise<Analytics | null> {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return Promise.resolve(null);
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    try {
      const mod = await import("firebase/analytics");
      if (!(await mod.isSupported())) return null;
      pushConsentDefaults();
      const analytics = mod.initializeAnalytics(getFirebaseApp(), {
        config: {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          ...(DEBUG ? { debug_mode: true } : {}),
        },
      });
      if (readInternalFlag()) mod.setDefaultEventParameters({ traffic_type: "internal" });
      return analytics;
    } catch (err) {
      // Blocked script, broken network, bad config — analytics is never worth
      // a user-visible failure.
      if (DEBUG) console.warn("[analytics] init failed", err);
      return null;
    }
  })();
  return analyticsPromise;
}

function isUntrackedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function track<E extends AnalyticsEvent>(name: E, params: EventMap[E]): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (isUntrackedPath(window.location.pathname)) return;
  void loadAnalytics().then(async (analytics) => {
    if (!analytics) return;
    const { logEvent } = await import("firebase/analytics");
    // logEvent's overloads are keyed on GA's own event names; our map is a
    // narrower, checked subset of the same shape.
    logEvent(analytics, name as string, params as Record<string, unknown>);
  });
}

export function sanitizeLocation(href: string): string {
  const url = new URL(href);
  for (const key of [...url.searchParams.keys()]) {
    if (!ALLOWED_QUERY_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

export function trackPageView(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  const { pathname, href } = window.location;
  if (isUntrackedPath(pathname)) return;
  let referrer: string | undefined;
  try {
    referrer = document.referrer ? sanitizeLocation(document.referrer) : undefined;
  } catch {
    referrer = undefined;
  }
  void loadAnalytics().then(async (analytics) => {
    if (!analytics) return;
    const { logEvent } = await import("firebase/analytics");
    logEvent(analytics, "page_view", {
      page_location: sanitizeLocation(href),
      page_path: pathname,
      page_title: document.title,
      ...(referrer ? { page_referrer: referrer } : {}),
    });
  });
}

/** Firebase uid (pseudonymous — allowed by GA's terms) or null on sign-out. */
export function setAnalyticsUser(uid: string | null): void {
  void loadAnalytics().then(async (analytics) => {
    if (!analytics) return;
    const { setUserId } = await import("firebase/analytics");
    setUserId(analytics, uid);
  });
}

/**
 * Tags this browser as internal (admin) traffic. Persisted, so marketing pages
 * outside the dashboard's AuthProvider stay tagged too. Only ever set, never
 * cleared on sign-out: an admin's browser is still an admin's browser.
 */
export function markInternalTraffic(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined" || readInternalFlag()) return;
  try {
    window.localStorage.setItem(INTERNAL_KEY, "1");
  } catch {
    // Storage blocked — this page load is still tagged below.
  }
  void loadAnalytics().then(async (analytics) => {
    if (!analytics) return;
    const { setDefaultEventParameters } = await import("firebase/analytics");
    setDefaultEventParameters({ traffic_type: "internal" });
  });
}

/** For the cookie banner, once one is designed. */
export function setAnalyticsConsent(granted: boolean): void {
  void loadAnalytics().then(async (analytics) => {
    if (!analytics) return;
    const { setConsent } = await import("firebase/analytics");
    setConsent({ analytics_storage: granted ? "granted" : "denied" });
  });
}

/** Starts loading gtag.js without sending anything. */
export function initAnalytics(): void {
  void loadAnalytics();
}
