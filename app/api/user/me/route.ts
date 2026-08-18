import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { syncAdminClaim } from "@/lib/admin-auth";

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
          // decoded.email is a self-asserted claim for password signups (Firebase
          // never verifies it), so anyone can sign up with someone else's email
          // and land here. Only inherit an elevated role (e.g. vendor/admin) when
          // Firebase itself has verified the email (true for Google sign-in,
          // never true for a plain password signup) — otherwise this is an
          // account-takeover path for old-app admin records. Plain "client"
          // records carry no privilege, so they keep merging unconditionally.
          const isElevatedRole = emailMatch[0].role !== "client";
          if (!isElevatedRole || decoded.email_verified === true) {
            role = emailMatch[0].role;
            hasCompletedOnboarding = emailMatch[0].hasCompletedOnboarding ?? false;
            inheritedFirstName = emailMatch[0].firstName ?? firstName;
            inheritedLastName = emailMatch[0].lastName ?? lastName;
            // Free up the email on the old record so the new Firebase UID record can own it
            await db.update(users).set({ email: null }).where(eq(users.id, emailMatch[0].id));
          } else {
            console.warn(
              `[/api/user/me] Blocked unverified-email merge into elevated-role record ${emailMatch[0].id} (role=${emailMatch[0].role})`
            );
          }
        }
      }

      if (decoded.email) {
        try {
          await db.insert(users).values({
            id: decoded.uid,
            email: decoded.email,
            firstName: inheritedFirstName,
            lastName: inheritedLastName,
            role,
            hasCompletedOnboarding,
          }).onConflictDoNothing();
        } catch (e) {
          console.error("[/api/user/me] Failed to create user row", e);
        }
      }

      result = await db.select().from(users).where(eq(users.id, decoded.uid)).limit(1);
    }

    if (!result[0]) return NextResponse.json(null, { status: 404 });

    // Awaited (unlike requireAdminSession()'s fire-and-forget) because this
    // is the one request the client always makes before it trusts `isAdmin`
    // and acts on it (entering /admin, force-refreshing its ID token) -- if
    // the claim write hasn't landed yet, the client's refreshed token still
    // won't carry it, and Firestore rules that read it (e.g. the admin chat
    // dock) 403 until the next natural token refresh.
    if (result[0].isAdmin) {
      await syncAdminClaim(decoded.uid);
    }

    // view_mode is a UI-only preference (which side of the app an isAdmin
    // user currently wants to see) -- never an authorization signal, so it's
    // safe to just echo the cookie back. Defaults to "admin" so existing
    // admins land where they always have until they explicitly switch.
    const viewMode = cookieStore.get("view_mode")?.value === "client" ? "client" : "admin";

    return NextResponse.json({ ...result[0], viewMode });
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}

// Updates the caller's own display name. This is the only writer of
// firstName/lastName after account creation — the settings page previously
// only called Firebase's client-side updateProfile(), which never reached
// these columns, so a "successful" name change was invisible everywhere
// else in the app (header, admin) that reads the name from here.
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);

    let body: { displayName?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const trimmed = (body.displayName ?? "").trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? null;
    const lastName = parts.slice(1).join(" ") || null;

    await db.update(users).set({ firstName, lastName }).where(eq(users.id, decoded.uid));

    return NextResponse.json({ firstName, lastName });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
