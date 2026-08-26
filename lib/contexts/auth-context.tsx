"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { signOut, refreshSessionCookie } from "@/lib/firebase/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { PageLoader } from "@/components/page-loader";

// How long to wait for Firebase's onAuthStateChanged before falling back to
// asking the server who this is. Long enough that a slow-but-working iframe
// wins the race on a poor connection; short enough that a broken one doesn't
// read as a hang.
const AUTH_READY_TIMEOUT_MS = 8_000;

// The subset of /api/user/me's response this file reads.
type MeResponse = {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role?: string;
  isAdmin?: boolean;
  viewMode?: string;
  hasCompletedOnboarding?: boolean;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  role: "client" | "vendor";
  isAdmin: boolean;
  // Which side of the app an isAdmin user currently wants to see -- UI-only,
  // never an authorization signal. Meaningless when isAdmin is false.
  viewMode: "admin" | "client";
  hasCompletedOnboarding: boolean;
};

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  handleSignOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthProvider({ children, requireAdmin = false }: AuthProviderProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Set as soon as either the Firebase listener or the timeout below resolves
  // the auth state, so the loser of that race does nothing.
  const settledRef = useRef(false);

  // Shapes an /api/user/me payload into a profile. `user` is null on the
  // fallback path, where the server response is all we have.
  function toProfile(uid: string, user: User | null, data: MeResponse): UserProfile {
    return {
      uid,
      email: data.email ?? user?.email ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      displayName:
        [data.firstName, data.lastName].filter(Boolean).join(" ") || user?.displayName || null,
      profileImageUrl: data.profileImageUrl ?? user?.photoURL ?? null,
      role: data.role as "client" | "vendor",
      isAdmin: Boolean(data.isAdmin),
      viewMode: data.viewMode === "client" ? "client" : "admin",
      hasCompletedOnboarding: Boolean(data.hasCompletedOnboarding),
    };
  }

  // Minimal profile for when the server can't be reached. Deliberately grants
  // nothing: no admin, no completed onboarding, no vendor role.
  function fallbackProfile(user: User): UserProfile {
    return {
      uid: user.uid,
      email: user.email,
      firstName: null,
      lastName: null,
      displayName: user.displayName,
      profileImageUrl: user.photoURL ?? null,
      role: "client",
      isAdmin: false,
      viewMode: "admin",
      hasCompletedOnboarding: false,
    };
  }

  // The same role/onboarding routing the listener applies, minus the admin
  // token refresh, which needs a live Firebase user.
  function applyRoleRedirects(resolved: UserProfile) {
    if (requireAdmin) {
      if (!resolved.isAdmin) router.replace(ROUTES.dashboard);
      return;
    }
    if (resolved.isAdmin && resolved.viewMode === "admin") {
      router.replace(ROUTES.admin);
      return;
    }
    if (resolved.role !== "vendor" && !resolved.hasCompletedOnboarding && pathname !== ROUTES.onboarding) {
      router.replace(ROUTES.onboarding);
    }
  }

  // Chrome/Safari can restore a fully-hydrated dashboard page from the
  // back-forward cache (bfcache) on a back-navigation -- repainting the
  // exact in-memory React state from before the tab was left, including a
  // signed-in `profile`, without re-running this effect or re-checking
  // Firebase. That's how "I signed out, then went back to a page I'd had
  // open and it still showed me logged in" happens: nothing re-verifies
  // anything, the frozen snapshot just gets shown again. router.refresh()
  // wouldn't help -- it re-fetches server data but leaves this already-ran
  // effect and its `profile` state untouched. Only a real reload discards
  // the frozen heap and forces onAuthStateChanged to read Firebase's actual
  // current persisted state.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Firebase's own auth state can never report in: the SDK reaches it through a
  // helper iframe on the cross-origin authDomain, and when the browser blocks
  // third-party storage that iframe can fail to initialize, so
  // onAuthStateChanged simply never fires. `loading` then stays true forever and
  // the PageLoader spins with no way out but a manual reload.
  //
  // The session cookie is server-side truth and needs none of that machinery,
  // so if the listener hasn't reported in by the deadline, ask the server
  // directly. A user with a valid cookie carries on as normal even with the
  // Firebase client SDK fully broken.
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (settledRef.current) return;

      try {
        const res = await fetch("/api/user/me");
        if (settledRef.current) return;

        if (res.ok) {
          const data = await res.json();
          const resolved = toProfile(data.id ?? "", null, data);
          settledRef.current = true;
          setProfile(resolved);
          setLoading(false);
          applyRoleRedirects(resolved);
          return;
        }
      } catch {
        // fall through to the signed-out path
      }

      if (settledRef.current) return;
      settledRef.current = true;
      setProfile(null);
      setLoading(false);
      router.replace(ROUTES.login);
    }, AUTH_READY_TIMEOUT_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      settledRef.current = true;

      if (!user) {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        setProfile(null);
        setLoading(false);
        router.replace(ROUTES.login);
        return;
      }

      try {
        let res = await fetch("/api/user/me");

        // A 401 with a live Firebase user is recoverable, not fatal: the
        // cookie is a 5-day fuse while Firebase's refresh token effectively
        // never expires, so this is the ordinary state of anyone returning
        // after a few days away. Mint a new cookie from a fresh ID token and
        // retry once before concluding they're signed out — what used to
        // happen here was an immediate signOut(), which is why coming back
        // from a week off always dumped you on the login page.
        if (res.status === 401) {
          const reminted = await refreshSessionCookie(user, true);
          if (reminted) res = await fetch("/api/user/me");
        }

        if (res.ok) {
          const data = await res.json();
          const resolved = toProfile(user.uid, user, data);
          setProfile(resolved);

          if (requireAdmin && !resolved.isAdmin) {
            router.replace(ROUTES.dashboard);
            return;
          }

          // requireAdminSession() sets the Firestore custom claim `admin:
          // true` server-side (fire-and-forget) the moment isAdmin becomes
          // true, but this client's cached ID token was issued before that
          // and won't carry it until refreshed -- Firestore rules that read
          // the claim (e.g. the admin chat dock) would 403 until then.
          // Force-refresh once per admin-page load; fire-and-forget like the
          // server side, so a hiccup here never blocks navigation.
          if (requireAdmin && resolved.isAdmin) {
            user.getIdToken(true).catch(() => {});
          }

          // Defaults to admin view -- an isAdmin user who hasn't explicitly
          // switched to "client view" still gets bounced to /admin from
          // dashboard pages, same as the old role==="vendor" behavior.
          if (!requireAdmin && resolved.isAdmin && resolved.viewMode === "admin") {
            router.replace(ROUTES.admin);
            return;
          }

          // Skip if already on /onboarding — this effect re-runs on every
          // fresh page load (including the onboarding page itself right
          // after signup), and router.replace(ROUTES.onboarding) with no
          // query string would otherwise silently strip a `?redirect=`
          // the signup/login flow attached, before the wizard ever gets a
          // chance to read it.
          if (!requireAdmin && resolved.role !== "vendor" && !resolved.hasCompletedOnboarding && pathname !== ROUTES.onboarding) {
            router.replace(ROUTES.onboarding);
            return;
          }
        } else if (res.status === 401) {
          // Re-minting above didn't help — the user really is signed out.
          await signOut().catch(() => {});
          return;
        } else if (res.status === 404) {
          // The one genuine "authenticated but no row yet" case: send them
          // through onboarding to create it.
          setProfile(fallbackProfile(user));
          if (!requireAdmin) {
            router.replace(ROUTES.onboarding);
          }
        } else {
          // 5xx — the server is having a bad moment, which says nothing about
          // who this user is. This branch used to lump every non-401 in with
          // "new user" and redirect to /onboarding, so a database blip looked
          // like account loss to a long-standing customer. Keep them where
          // they are on a degraded profile and let the next load resolve it.
          console.error("[auth] /api/user/me failed with", res.status);
          setProfile(fallbackProfile(user));
        }
      } catch {
        setProfile(fallbackProfile(user));
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [router, requireAdmin]);

  async function handleSignOut() {
    await signOut();
    router.push(ROUTES.home);
  }

  // Re-fetches /api/user/me and merges the result into the existing profile —
  // for callers (e.g. the settings page after a profile save) that changed
  // server-side state and need the header/avatar/etc. to reflect it without
  // waiting for the next onAuthStateChanged firing (login, token refresh).
  // Deliberately skips the role/onboarding redirect checks above — those only
  // make sense on initial load, not on a same-page refresh.
  async function refreshProfile() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await fetch("/api/user/me");
      if (!res.ok) return;
      const data = await res.json();
      setProfile((prev) => ({
        ...prev,
        uid: user.uid,
        email: data.email ?? user.email,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: [data.firstName, data.lastName].filter(Boolean).join(" ") || user.displayName || null,
        profileImageUrl: data.profileImageUrl ?? user.photoURL ?? null,
        role: data.role as "client" | "vendor",
        isAdmin: Boolean(data.isAdmin),
        viewMode: data.viewMode === "client" ? "client" : "admin",
        hasCompletedOnboarding: data.hasCompletedOnboarding,
      }));
    } catch {
      // best-effort — the next full auth-state refresh will still pick it up
    }
  }

  if (loading) return <PageLoader />;

  return (
    <AuthContext.Provider value={{ profile, loading, handleSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
