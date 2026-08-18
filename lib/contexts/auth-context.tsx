"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { signOut } from "@/lib/firebase/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { PageLoader } from "@/components/page-loader";

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
        setProfile(null);
        setLoading(false);
        router.replace(ROUTES.login);
        return;
      }

      try {
        const res = await fetch("/api/user/me");

        if (res.ok) {
          const data = await res.json();
          const resolved: UserProfile = {
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
          };
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
          // Server session cookie is invalid/expired while Firebase still has a user.
          // Sign out fully — onAuthStateChanged will re-fire with null and route to login.
          await signOut().catch(() => {});
          return;
        } else {
          // User exists in Firebase but not in PG yet — treat as new unboarded client
          setProfile({
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
          });

          if (!requireAdmin) {
            router.replace(ROUTES.onboarding);
          }
        }
      } catch {
        setProfile({
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
        });
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
