import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth/verify-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type CurrentUser = {
  uid: string;
  email: string | null;
  role: string;
  isAdmin: boolean;
  companyId: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;

    const decoded = await verifySession(session);

    const result = await db
      .select({ email: users.email, role: users.role, isAdmin: users.isAdmin, companyId: users.companyId })
      .from(users)
      .where(eq(users.id, decoded.uid))
      .limit(1);

    if (!result[0]) return null;

    return {
      uid: decoded.uid,
      email: result[0].email,
      role: result[0].role,
      isAdmin: result[0].isAdmin,
      companyId: result[0].companyId,
    };
  } catch {
    return null;
  }
}
