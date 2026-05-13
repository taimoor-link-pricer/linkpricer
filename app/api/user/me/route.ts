import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json(null, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);

    let result = await db.select().from(users).where(eq(users.id, decoded.uid)).limit(1);

    if (!result[0]) {
      // User authenticated but missing from PG — create them now.
      // This handles the case where the session-route insert was silently skipped
      // due to an email uniqueness conflict from old app data.
      const nameParts = decoded.name ? (decoded.name as string).split(" ") : [];
      const firstName = nameParts[0] ?? null;
      const lastName = nameParts.slice(1).join(" ") || null;

      try {
        await db.insert(users).values({
          id: decoded.uid,
          email: decoded.email ?? null,
          firstName,
          lastName,
          role: "client",
          hasCompletedOnboarding: false,
        });
      } catch {
        // Email already taken by an old-app record — insert without email
        try {
          await db.insert(users).values({
            id: decoded.uid,
            email: null,
            firstName,
            lastName,
            role: "client",
            hasCompletedOnboarding: false,
          }).onConflictDoNothing();
        } catch (e) {
          console.error("[/api/user/me] Failed to create user row", e);
        }
      }

      result = await db.select().from(users).where(eq(users.id, decoded.uid)).limit(1);
    }

    if (!result[0]) return NextResponse.json(null, { status: 404 });

    return NextResponse.json(result[0]);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
