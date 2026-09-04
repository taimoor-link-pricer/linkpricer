"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export interface MarketingAuth {
  user: User | null;
  /** True until Firebase has actually told us whether anyone is signed in. */
  loading: boolean;
  signedIn: boolean;
}

/**
 * Auth state for the *public* marketing surfaces (header, homepage AI chat,
 * demo pages).
 *
 * Deliberately not the dashboard's useAuthContext/AuthProvider: that one
 * force-redirects anyone without a session to /login and holds the page behind
 * a full-page loader while it resolves. Both are correct for gated dashboard
 * routes and both would break a public page for the signed-out visitor, who is
 * the common case out here. This just listens to Firebase's own auth state —
 * no redirects, no page-level gate.
 *
 * `loading` matters to callers: Firebase resolves asynchronously after mount,
 * so treating "not signed in yet" as "signed out" makes the header flip and the
 * demo gates flash on for a beat before disappearing.
 */
export function useMarketingAuth(): MarketingAuth {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
  }), []);

  return { user, loading, signedIn: !loading && user !== null };
}
