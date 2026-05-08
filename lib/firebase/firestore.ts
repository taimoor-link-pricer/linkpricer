import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type FieldValue,
} from "firebase/firestore";
import { db } from "./client";

export type UserRole = "client" | "admin";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  onboarded: boolean;
  userType?: string;
  monthlySpend?: string;
  challenges?: string;
  importanceFactors?: string[];
  acquisitionMethods?: string[];
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch {
    return null;
  }
}

export async function createUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        ...data,
        uid,
        onboarded: false,
        role: "client",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[createUserProfile] Firestore unavailable:", err);
  }
}

export async function completeOnboarding(
  uid: string,
  data: Partial<Omit<UserProfile, "uid" | "role" | "createdAt">>
): Promise<void> {
  try {
    await setDoc(
      doc(db, "users", uid),
      { ...data, onboarded: true, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("[completeOnboarding] Firestore unavailable:", err);
  }
}
