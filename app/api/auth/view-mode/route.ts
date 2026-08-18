import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

const COOKIE_NAME = "view_mode";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

// Sets which side of the app an isAdmin user currently wants to see
// (profile-bar / admin-sidebar "switch to admin/client view"). This is a UI
// preference only -- it never grants access. requireAdminSession() and every
// admin route/API check the durable `isAdmin` DB column, not this cookie.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);

    let body: { mode?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (body.mode !== "admin" && body.mode !== "client") {
      return NextResponse.json({ error: "mode must be 'admin' or 'client'" }, { status: 400 });
    }

    const [user] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, decoded.uid))
      .limit(1);

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Only admins can switch views" }, { status: 403 });
    }

    cookieStore.set(COOKIE_NAME, body.mode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ONE_YEAR_S,
      path: "/",
    });

    return NextResponse.json({ ok: true, mode: body.mode });
  } catch (err) {
    console.error("[/api/auth/view-mode POST]", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
