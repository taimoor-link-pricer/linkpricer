"use client";

import type { FirebaseError } from "firebase/app";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "./client";
import { ROUTES } from "@/lib/constants";

export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/expired-action-code":
      return "This reset link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This reset link is invalid or has already been used. Request a new one.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/popup-timeout":
      return "Google sign-in didn't complete. Please try again.";
    case "auth/account-exists-with-different-credential":
      return "An account with this email already exists. Log in with your password instead.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function isFirebaseError(err: unknown): err is FirebaseError {
  return typeof err === "object" && err !== null && "code" in err;
}

// The session cookie is httpOnly, so the client can't read its age directly.
// This stamp is how AuthSync decides whether the cookie is due for a refresh
// without POSTing on every single page load. A missing stamp means "unknown" —
// which is also true of every session minted before this shipped — and is
// treated as due, so existing sessions migrate onto the rolling schedule the
// first time their owner loads a page.
const SESSION_MINTED_AT_KEY = "lp:session-minted-at";

function stampSessionMinted() {
  try {
    window.localStorage.setItem(SESSION_MINTED_AT_KEY, String(Date.now()));
  } catch {
    // Private mode / storage disabled — AuthSync just refreshes more eagerly.
  }
}

function clearSessionStamp() {
  try {
    window.localStorage.removeItem(SESSION_MINTED_AT_KEY);
  } catch {
    // no-op
  }
}

/**
 * Resolves with the signed-in Firebase user, or null if none turns up in time.
 *
 * `auth.currentUser` is null until the SDK has restored persisted state, so a
 * caller that reads it on mount sees null even for a signed-in user. The
 * timeout matters as much as the wait: the same cross-origin iframe that can
 * hang sign-in can stop auth state resolving at all, and this must not become
 * another place that waits forever.
 */
export function waitForFirebaseUser(timeoutMs = 5_000): Promise<User | null> {
  if (auth?.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    let settled = false;
    const cleanups: Array<() => void> = [];

    const finish = (user: User | null) => {
      if (settled) return;
      settled = true;
      for (const cleanup of cleanups) cleanup();
      resolve(user);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    cleanups.push(() => clearTimeout(timer));

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) finish(user);
    });
    // If the listener fired synchronously, finish() already ran without knowing
    // about this subscription — detach it here instead.
    if (settled) unsub();
    else cleanups.push(unsub);
  });
}

/** Milliseconds since this browser last minted a session cookie, or null if unknown. */
export function sessionCookieAgeMs(): number | null {
  try {
    const raw = window.localStorage.getItem(SESSION_MINTED_AT_KEY);
    if (!raw) return null;
    const minted = Number(raw);
    return Number.isFinite(minted) ? Date.now() - minted : null;
  } catch {
    return null;
  }
}

async function createSession(idToken: string, userData?: { firstName?: string; lastName?: string }): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...userData }),
  });
  if (!res.ok) throw new Error("Failed to establish session");
  stampSessionMinted();
}

/**
 * Mints a fresh `session` cookie for an already-signed-in Firebase user.
 *
 * The cookie is a fixed 5-day fuse lit at sign-in and it does not slide, while
 * Firebase's own refresh token effectively never expires. Left alone the two
 * drift apart, and the user ends up showing as signed in on the marketing
 * header while every server route says otherwise. Callers use this to keep the
 * cookie rolling and to repair a 401 in place instead of signing out.
 *
 * Never throws — a failed refresh is a "try again later", not a reason to
 * interrupt whatever the user was doing.
 */
export async function refreshSessionCookie(user: User, forceTokenRefresh = false): Promise<boolean> {
  try {
    await createSession(await user.getIdToken(forceTokenRefresh));
    return true;
  } catch {
    return false;
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await user.getIdToken();
  await createSession(idToken);
  return user;
}

export async function signUpWithEmail(
  firstName: string,
  lastName: string,
  email: string,
  password: string
) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
  const idToken = await user.getIdToken();
  await createSession(idToken, { firstName, lastName });
  return user;
}

async function finalizeGoogleResult(result: UserCredential): Promise<{ user: User; isNewUser: boolean }> {
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
  const idToken = await result.user.getIdToken();
  try {
    await createSession(idToken);
  } catch (err) {
    // Firebase is signed in but the server session never got created. Leaving
    // it that way is the worst of both worlds: the marketing header renders an
    // avatar while every gated route 401s, and the user has no way to tell why.
    // Roll the client back so the two halves agree and the error is honest.
    await firebaseSignOut(auth).catch(() => {});
    throw err;
  }
  return { user: result.user, isNewUser };
}

// Codes Firebase raises when the popup itself was the problem (blocked
// outright, or the SDK lost track of it) rather than a real auth failure.
// The specific bug this exists for: Chrome's Cross-Origin-Opener-Policy
// blocks the opener's `popup.closed` poll that signInWithPopup relies on to
// detect completion, so the SDK gives up and reports popup-closed-by-user
// even when the user finished signing in — our own COOP header is already
// the documented "same-origin-allow-popups" fix for our side, but
// accounts.google.com's COOP is outside our control, so it still happens.
// Falling back to a full-page redirect sidesteps the popup (and its
// `.closed` check) entirely.
const POPUP_FALLBACK_CODES = new Set(["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

// How long to wait for signInWithPopup before assuming the SDK has lost track
// of the popup, and how long to then watch Firebase's own auth state for proof
// that the sign-in actually landed.
const POPUP_TIMEOUT_MS = 25_000;
const POPUP_RECOVERY_GRACE_MS = 3_000;

class PopupTimeoutError extends Error {
  readonly code = "auth/popup-timeout";
}

type SignInMark = { uid: string; lastSignInTime: string | null } | null;

function markCurrentUser(): SignInMark {
  const u = auth.currentUser;
  return u ? { uid: u.uid, lastSignInTime: u.metadata.lastSignInTime ?? null } : null;
}

// Did a *new* sign-in land since `before` was taken? Comparing lastSignInTime
// as well as uid matters: someone with a stale Firebase session who opens the
// chooser to switch accounts must not be silently handed a session cookie for
// the account they were trying to leave.
function freshlySignedInUser(before: SignInMark): User | null {
  const u = auth.currentUser;
  if (!u) return null;
  if (!before) return u;
  if (u.uid !== before.uid) return u;
  return (u.metadata.lastSignInTime ?? null) !== before.lastSignInTime ? u : null;
}

// signInWithPopup settles one of two ways: a postMessage from the auth iframe,
// or polling `popup.closed`. A cross-origin authDomain can break the first, and
// accounts.google.com's COOP header makes `popup.closed` read false forever —
// when both fail the promise never resolves *and* never rejects, so the caller
// awaits it indefinitely and its spinner never stops.
//
// Firebase's own auth state is the tiebreaker: if the sign-in really did land,
// onAuthStateChanged has already fired even though our promise didn't. Poll for
// that briefly, and mint the session ourselves if we find it.
async function recoverHungPopup(before: SignInMark): Promise<{ user: User; isNewUser: boolean } | null> {
  const deadline = Date.now() + POPUP_RECOVERY_GRACE_MS;
  for (;;) {
    const user = freshlySignedInUser(before);
    if (user) {
      await createSession(await user.getIdToken());
      // isNewUser is unavailable on this path (no UserCredential). No caller
      // branches on it — post-auth routing reads hasCompletedOnboarding from
      // the server — so reporting false here changes nothing.
      return { user, isNewUser: false };
    }
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function startGoogleSignIn(): Promise<{ user: User; isNewUser: boolean }> {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser, so a hung popup is never ambiguous about
  // which account the user meant to use.
  provider.setCustomParameters({ prompt: "select_account" });

  const before = markCurrentUser();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      signInWithPopup(auth, provider),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PopupTimeoutError()), POPUP_TIMEOUT_MS);
      }),
    ]);
    return await finalizeGoogleResult(result);
  } catch (err) {
    if (err instanceof PopupTimeoutError) {
      const recovered = await recoverHungPopup(before);
      if (recovered) return recovered;
      throw err;
    }
    if (isFirebaseError(err) && POPUP_FALLBACK_CODES.has(err.code)) {
      markRedirectPending();
      await signInWithRedirect(auth, provider);
      // signInWithRedirect navigates the page away to Google — this call
      // site never gets a result back directly. finishGoogleSignIn() picks
      // it up on the next page load once Google redirects back. Hang
      // rather than resolve/throw so callers' post-await code (e.g. a
      // route push) doesn't fire while the browser is mid-navigation.
      return new Promise(() => {});
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Set immediately before signInWithRedirect navigates away, and cleared by the
// handler that picks the result back up. sessionStorage survives a same-tab
// navigation, which is exactly the lifetime of a redirect round trip — so this
// lets AuthSync skip getRedirectResult (and the Firebase auth iframe it spins
// up) on the overwhelming majority of page loads, where nothing is pending.
const REDIRECT_PENDING_KEY = "lp:google-redirect-pending";

function markRedirectPending() {
  try {
    window.sessionStorage.setItem(REDIRECT_PENDING_KEY, "1");
  } catch {
    // no-op — finishGoogleSignIn falls back to always checking
  }
}

function takeRedirectPending(): boolean {
  try {
    const pending = window.sessionStorage.getItem(REDIRECT_PENDING_KEY) === "1";
    if (pending) window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
    return pending;
  } catch {
    // Storage unavailable — assume a redirect might be pending and check.
    return true;
  }
}

/**
 * Completes a Google sign-in that fell back to a full-page redirect.
 *
 * Returns null when nothing is pending, which is the normal case on almost
 * every page load. Note that even if this is somehow missed, AuthSync's
 * cookie-refresh pass still mints a session for the signed-in user — the two
 * mechanisms cover each other, so a lost result costs the post-auth routing
 * but never the session itself.
 */
export async function finishGoogleSignIn(): Promise<{ user: User; isNewUser: boolean } | null> {
  if (!takeRedirectPending()) return null;
  const result = await getRedirectResult(auth);
  if (!result) return null;
  return finalizeGoogleResult(result);
}

export async function signOut() {
  // The cookie must go even if the Firebase call throws, and a failed DELETE
  // must not leave the caller stranded on a page it just signed out of.
  try {
    await firebaseSignOut(auth);
  } finally {
    clearSessionStamp();
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  }
}

// `handleCodeInApp: true` + our own resetPassword URL means the emailed link
// opens our branded page (oobCode in the query string) instead of Firebase's
// generic hosted action page. Firebase intentionally doesn't reveal whether
// the email exists (no error on an unknown address) — this is an anti
// account-enumeration measure on Firebase's side, not something to work
// around; the caller should always show the same "check your email" message.
export async function sendPasswordResetEmail(email: string) {
  await firebaseSendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}${ROUTES.resetPassword}`,
    handleCodeInApp: true,
  });
}

// Confirms the oobCode is still valid and returns the email it belongs to
// (shown on the reset-password page so the user knows which account they're
// resetting) — throws (auth/expired-action-code / auth/invalid-action-code)
// if the link was already used or has expired.
export async function verifyPasswordResetCode(oobCode: string): Promise<string> {
  return firebaseVerifyPasswordResetCode(auth, oobCode);
}

export async function confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await firebaseConfirmPasswordReset(auth, oobCode, newPassword);
}
