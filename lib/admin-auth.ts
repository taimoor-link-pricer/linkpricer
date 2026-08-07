import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function requireAdminSession(): Promise<{ uid: string } | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;

    const decoded = await adminAuth.verifySessionCookie(session, true);

    const result = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, decoded.uid))
      .limit(1);

    if (!result[0] || result[0].role !== "vendor") return null;

    // Self-heal the Firestore users/{uid} mirror doc so Firestore security
    // rules (isAdmin()) recognize this vendor as an admin — Postgres stays
    // the source of truth for the role itself. Fire-and-forget: never block
    // or fail admin auth on a Firestore hiccup.
    adminDb
      .collection("users")
      .doc(decoded.uid)
      .set({ role: "admin" }, { merge: true })
      .catch((err) => console.error("[requireAdminSession] Firestore role sync failed", err));

    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// Super admin: vendor-role user whose email is listed in SUPER_ADMIN_EMAILS (comma-separated env var)
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
