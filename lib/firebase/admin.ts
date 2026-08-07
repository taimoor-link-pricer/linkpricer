import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getApps()[0];
}

// Lazy proxies — do not initialize Firebase Admin at module load time.
// Initialization is deferred until the first method call at request time.
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    getAdminApp();
    return (getAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminDb = new Proxy({} as Firestore, {
  get(_target, prop) {
    getAdminApp();
    return (getFirestore() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
