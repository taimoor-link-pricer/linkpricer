import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

function getFirebaseApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

// Firebase's client SDK is browser-only. Initializing it eagerly at module
// scope crashes any server-side pass that imports this file — including
// Next.js prerendering a page at build time — if NEXT_PUBLIC_FIREBASE_* isn't
// set in that environment (this took down an entire Vercel production build
// over a missing key, not just the login page). Guard init to the browser;
// `auth`/`db` are only ever touched from client components in response to
// real user interaction, never during SSR/prerendering.
export const auth = typeof window !== "undefined" ? getAuth(getFirebaseApp()) : (undefined as unknown as Auth);
export const db = typeof window !== "undefined" ? getFirestore(getFirebaseApp()) : (undefined as unknown as Firestore);
