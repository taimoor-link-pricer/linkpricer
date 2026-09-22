import { NextRequest, NextResponse, after } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { notifyUserSignup } from "@/lib/notifications/users";

const COOKIE_NAME = "session";
const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { idToken: string; firstName?: string; lastName?: string };

    const sessionCookie = await adminAuth.createSessionCookie(body.idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: FIVE_DAYS_MS / 1000,
      path: "/",
    });

    // Upsert PG user — ON CONFLICT DO NOTHING so returning users are not overwritten
    try {
      const decoded = await adminAuth.verifyIdToken(body.idToken);

      let firstName = body.firstName ?? null;
      let lastName = body.lastName ?? null;

      if (!firstName && decoded.name) {
        const parts = (decoded.name as string).split(" ");
        firstName = parts[0] ?? null;
        lastName = parts.slice(1).join(" ") || null;
      }

      if (decoded.email) {
        const inserted = await db.insert(users).values({
          id: decoded.uid,
          email: decoded.email,
          firstName,
          lastName,
          role: "client",
          hasCompletedOnboarding: false,
        }).onConflictDoNothing().returning({ id: users.id });

        // The row already existed, so the insert above discarded whatever
        // name came with this request. Fill it in if the stored row has none.
        //
        // This is not a hypothetical. Signing up races itself: creating the
        // Firebase user fires an auth-state change, whose listener calls
        // refreshSessionCookie() -> createSession(idToken) with NO name, and
        // that request frequently lands before signUpWithEmail's own call
        // carrying firstName/lastName. The nameless one inserts the row, the
        // named one hits ON CONFLICT DO NOTHING, and the name the user typed
        // is thrown away. 37 of 555 accounts have no name at all because of
        // this, 12 of them created in the last 90 days.
        //
        // Scoped to rows where the name IS NULL, so a returning user can
        // never be overwritten — which is what ON CONFLICT DO NOTHING was
        // protecting against in the first place.
        if (inserted.length === 0 && firstName) {
          await db
            .update(users)
            .set({ firstName, lastName })
            .where(and(eq(users.id, decoded.uid), isNull(users.firstName)));
        }

        // A row only comes back when this sign-in created the account.
        if (inserted.length > 0) {
          const email = decoded.email;
          const origin = req.nextUrl.origin;
          after(() =>
            notifyUserSignup({
              userId: decoded.uid,
              email,
              firstName,
              lastName,
              provider: decoded.firebase?.sign_in_provider ?? null,
              origin,
            })
          );
        }
      }
    } catch (dbErr) {
      console.error("[/api/auth/session] PG upsert failed", dbErr);
      // Don't fail session creation if DB write fails
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/auth/session POST]", err);
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
