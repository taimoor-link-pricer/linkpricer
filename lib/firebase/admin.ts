import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

function getAdminAuthInstance(): Auth {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getAuth();
}

// Lazy proxy — does not initialize Firebase Admin at module load time.
// Initialization is deferred until the first method call at request time.
export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getAdminAuthInstance() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
