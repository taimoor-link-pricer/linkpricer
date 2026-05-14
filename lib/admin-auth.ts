import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
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

    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
