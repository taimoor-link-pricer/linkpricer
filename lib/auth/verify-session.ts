import { adminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

// Codes that mean the cookie itself is genuinely unusable — the caller really
// is signed out and should be treated as such.
const HARD_AUTH_FAILURES = new Set([
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/invalid-session-cookie",
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

/**
 * Verifies the `session` cookie, distinguishing "this user is signed out" from
 * "we couldn't reach Google right now".
 *
 * `verifySessionCookie(cookie, true)` sets checkRevoked, which makes a network
 * call to Google on every single authenticated request. Callers used to wrap
 * that in a bare `catch { return null }`, so a transient blip on that call was
 * indistinguishable from a revoked session and bounced the user to /login
 * mid-session holding a perfectly valid cookie.
 *
 * Only a genuine auth failure rejects here. Anything else (network, timeout,
 * Google 5xx) falls back to local verification, which checks the signature and
 * expiry against the admin SDK's cached public keys and needs no network. The
 * security we give up in that window is narrow: a session revoked in the last
 * few minutes could survive slightly longer, and only while Google is
 * unreachable. Sign-out deletes the cookie outright, so the common case never
 * depends on the revocation check at all.
 */
export async function verifySession(sessionCookie: string): Promise<DecodedIdToken> {
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (HARD_AUTH_FAILURES.has(code)) throw err;
    console.warn("[verifySession] revocation check unavailable, falling back to local verify:", code || err);
    return await adminAuth.verifySessionCookie(sessionCookie, false);
  }
}
