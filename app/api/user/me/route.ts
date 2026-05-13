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
      // User authenticated but missing from PG — check if an old-app record exists
      // with the same email (different id). If so, inherit their role/onboarding,
      // clear the email on the old record, and create the new one with the real email.
      const nameParts = decoded.name ? (decoded.name as string).split(" ") : [];
      const firstName = nameParts[0] ?? null;
      const lastName = nameParts.slice(1).join(" ") || null;

      let role: string = "client";
      let hasCompletedOnboarding = false;
      let inheritedFirstName = firstName;
      let inheritedLastName = lastName;

      if (decoded.email) {
        const emailMatch = await db.select().from(users).where(eq(users.email, decoded.email)).limit(1);
        if (emailMatch[0]) {
          role = emailMatch[0].role;
          hasCompletedOnboarding = emailMatch[0].hasCompletedOnboarding ?? false;
          inheritedFirstName = emailMatch[0].firstName ?? firstName;
          inheritedLastName = emailMatch[0].lastName ?? lastName;
          // Free up the email on the old record so the new Firebase UID record can own it
          await db.update(users).set({ email: null }).where(eq(users.id, emailMatch[0].id));
        }
      }

      try {
        await db.insert(users).values({
          id: decoded.uid,
          email: decoded.email ?? null,
          firstName: inheritedFirstName,
          lastName: inheritedLastName,
          role,
          hasCompletedOnboarding,
        }).onConflictDoNothing();
      } catch (e) {
        console.error("[/api/user/me] Failed to create user row", e);
      }

      result = await db.select().from(users).where(eq(users.id, decoded.uid)).limit(1);
    }

    if (!result[0]) return NextResponse.json(null, { status: 404 });

    return NextResponse.json(result[0]);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
