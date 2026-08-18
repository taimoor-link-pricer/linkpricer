import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Self-heals the Firestore users/{uid} mirror doc (display/debug use -- not
// what security rules check) and the auth token's custom claim, which is
// what firestore.rules' isAdmin() actually reads.
// A get()-based isAdmin() (checking users/{uid}.role via a Firestore
// document read) works fine for single-document rule evaluations, but
// Firestore does NOT memoize repeated get() calls across a list/
// collection-group query's per-document rule evaluations -- a query
// returning e.g. 300 messages across many orders re-runs that get() up to
// 300 times, blowing the per-query get()-call budget and getting the whole
// query denied outright, even for a genuine admin. A custom claim lives on
// the ID token itself, so checking it costs nothing regardless of how many
// documents a query touches -- Firestore's own recommended pattern for admin
// checks that need to work in list rules.
export async function syncAdminClaim(uid: string): Promise<void> {
  await Promise.all([
    adminDb
      .collection("users")
      .doc(uid)
      .set({ role: "admin" }, { merge: true })
      .catch((err) => console.error("[syncAdminClaim] Firestore role sync failed", err)),
    adminAuth
      .setCustomUserClaims(uid, { admin: true })
      .catch((err) => console.error("[syncAdminClaim] Custom claim sync failed", err)),
  ]);
}

export async function requireAdminSession(): Promise<{ uid: string } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;

    const decoded = await adminAuth.verifySessionCookie(session, true);

    const result = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, decoded.uid))
      .limit(1);

    if (!result[0] || !result[0].isAdmin) return null;

    // Fire-and-forget: never block or fail admin auth on a claim-sync hiccup
    // here -- this runs on every admin-gated API call, so it stays cheap.
    // /api/user/me awaits the same helper instead, since that's the one
    // request the client relies on finishing before it trusts `isAdmin` and
    // acts on it (entering /admin, refreshing its ID token).
    syncAdminClaim(decoded.uid).catch(() => {});

    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// Super admin: isAdmin user whose email is listed in SUPER_ADMIN_EMAILS (comma-separated env var)
export async function requireSuperAdminSession(): Promise<{ uid: string } | null> {
  const base = await requireAdminSession();
  if (!base) return null;

  const allowed = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return null;

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, base.uid))
    .limit(1);

  if (!user?.email || !allowed.includes(user.email.toLowerCase())) return null;

  return base;
}
