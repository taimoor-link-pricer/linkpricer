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
    default:
      return "Something went wrong. Please try again.";
  }
}

export function isFirebaseError(err: unknown): err is FirebaseError {
  return typeof err === "object" && err !== null && "code" in err;
}

async function createSession(idToken: string, userData?: { firstName?: string; lastName?: string }): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...userData }),
  });
  if (!res.ok) throw new Error("Failed to establish session");
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
  await createSession(idToken);
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

export async function startGoogleSignIn(): Promise<{ user: User; isNewUser: boolean }> {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return await finalizeGoogleResult(result);
  } catch (err) {
    if (isFirebaseError(err) && POPUP_FALLBACK_CODES.has(err.code)) {
      await signInWithRedirect(auth, provider);
      // signInWithRedirect navigates the page away to Google — this call
      // site never gets a result back directly. finishGoogleSignIn() picks
      // it up on the next page load once Google redirects back. Hang
      // rather than resolve/throw so callers' post-await code (e.g. a
      // route push) doesn't fire while the browser is mid-navigation.
      return new Promise(() => {});
    }
    throw err;
  }
}

export async function finishGoogleSignIn(): Promise<{ user: User; isNewUser: boolean } | null> {
  const result = await getRedirectResult(auth);
  if (!result) return null;
  return finalizeGoogleResult(result);
}

export async function signOut() {
  await firebaseSignOut(auth);
  await fetch("/api/auth/session", { method: "DELETE" });
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
