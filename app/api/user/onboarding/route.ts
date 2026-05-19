import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users, onboardingResponses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json({ ok: false }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const body = await req.json() as {
      userType: string;
      userTypeOther?: string;
      monthlySpend: string;
      biggestChallenge: string;
      priorityFactors: string[];
      currentMethod: string[];
    };

    // Upsert by Firebase UID. If email already exists under a different ID (legacy user),
    // fall back to updating by email instead.
    try {
      await db.insert(users)
        .values({ id: decoded.uid, email: decoded.email ?? null, hasCompletedOnboarding: true, role: "client" })
        .onConflictDoUpdate({ target: users.id, set: { hasCompletedOnboarding: true } });
    } catch {
      if (decoded.email) {
        await db.update(users)
          .set({ hasCompletedOnboarding: true })
          .where(eq(users.email, decoded.email));
      }
    }

    try {
      await db.insert(onboardingResponses).values({
        userId: decoded.uid,
        userType: body.userType,
        userTypeOther: body.userTypeOther ?? null,
        monthlySpend: body.monthlySpend,
        biggestChallenge: body.biggestChallenge,
        priorityFactors: body.priorityFactors,
        currentMethod: body.currentMethod,
      }).onConflictDoNothing();
    } catch (e) {
      console.error("[/api/user/onboarding] onboarding_responses insert failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/user/onboarding]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
