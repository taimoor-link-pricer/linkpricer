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
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";

export type UserProfile = {
  uid: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: "client" | "vendor";
  hasCompletedOnboarding: boolean;
};

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  handleSignOut: () => Promise<void>;
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
            role: data.role as "client" | "vendor",
            hasCompletedOnboarding: data.hasCompletedOnboarding,
          };
          setProfile(resolved);

          if (requireAdmin && resolved.role !== "vendor") {
            router.replace(ROUTES.dashboard);
            return;
          }

          if (!requireAdmin && resolved.role !== "vendor" && !resolved.hasCompletedOnboarding) {
            router.replace(ROUTES.onboarding);
            return;
          }
        } else {
          // User exists in Firebase but not in PG yet — treat as new unboarded client
          setProfile({
            uid: user.uid,
            email: user.email,
            firstName: null,
            lastName: null,
            displayName: user.displayName,
            role: "client",
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
          role: "client",
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

  return (
    <AuthContext.Provider value={{ profile, loading, handleSignOut }}>
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
