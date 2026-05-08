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
import { getUserProfile, type UserProfile } from "@/lib/firebase/firestore";
import { signOut } from "@/lib/firebase/auth-client";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  handleSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileFromFirebaseUser(
  user: import("firebase/auth").User
): UserProfile {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: "client",
    onboarded: false,
  };
}

interface AuthProviderProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthProvider({ children, requireAdmin = false }: AuthProviderProps) {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const u = auth.currentUser;
    return u ? profileFromFirebaseUser(u) : null;
  });
  const [loading, setLoading] = useState(() => !auth.currentUser);
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
        const p = await getUserProfile(user.uid);
        const resolvedProfile = p ?? profileFromFirebaseUser(user);
        setProfile(resolvedProfile);

        if (requireAdmin && resolvedProfile.role !== "admin") {
          router.replace(ROUTES.dashboard);
          return;
        }
      } catch {
        setProfile(profileFromFirebaseUser(user));
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
