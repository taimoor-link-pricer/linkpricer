"use client";

import type { FirebaseError } from "firebase/app";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./client";

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

export async function startGoogleSignIn(): Promise<{ user: User; isNewUser: boolean }> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
  const idToken = await result.user.getIdToken();
  await createSession(idToken);
  return { user: result.user, isNewUser };
}

export async function finishGoogleSignIn(): Promise<{ user: User; isNewUser: boolean } | null> {
  return null;
}

export async function signOut() {
  await firebaseSignOut(auth);
  await fetch("/api/auth/session", { method: "DELETE" });
}
