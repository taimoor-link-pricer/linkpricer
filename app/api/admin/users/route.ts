import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ilike, or, eq, and, desc, count } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

// The DB's role column is "client" | "vendor" — "vendor" is this app's admin
// role everywhere else (see lib/admin-auth.ts), but the Users page UI (and
// its role filter) was built around "admin" as the display label. Map at
// the edge rather than renaming the DB column, which is used by auth checks
// throughout the app.
function displayRole(role: string): "client" | "admin" {
  return role === "vendor" ? "admin" : "client";
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const roleFilter = searchParams.get("role"); // "client" | "vendor" | null (all)
  const adminFilter = searchParams.get("admin"); // "true" | null
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const conditions = [];
  if (search) {
    conditions.push(
      or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`))!
    );
  }
  if (roleFilter === "client" || roleFilter === "vendor") {
    conditions.push(eq(users.role, roleFilter));
  }
  // Filters on the isAdmin capability, not role -- a dual-capability admin
  // keeps role="client" (see requireAdminSession()), so a plain role="vendor"
  // filter would miss them.
  if (adminFilter === "true") {
    conditions.push(eq(users.isAdmin, true));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  try {
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isAdmin: users.isAdmin,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(users).where(where),
    ]);

    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown",
        email: u.email ?? "—",
        role: displayRole(u.role),
        isAdmin: u.isAdmin,
        status: u.status === "live" ? "Active" : "Suspended",
        createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—",
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    console.error("[/api/admin/users GET]", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

// PATCH — suspend/restore a user account, or grant/revoke admin access.
// Kept as two distinct request shapes rather than folding isAdmin into the
// same suspended toggle, purely so a "Suspend" click can never accidentally
// carry an admin-access change as a side effect -- both are gated by the
// same plain admin session.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { userId?: string; suspended?: boolean; isAdmin?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (typeof body.isAdmin === "boolean") {
    if (body.userId === admin.uid) {
      return NextResponse.json({ error: "You can't change your own admin access." }, { status: 400 });
    }
    try {
      await db.update(users).set({ isAdmin: body.isAdmin }).where(eq(users.id, body.userId));
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("[/api/admin/users PATCH isAdmin]", err);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
  }

  if (typeof body.suspended !== "boolean") {
    return NextResponse.json({ error: "suspended or isAdmin is required" }, { status: 400 });
  }
  if (body.userId === admin.uid && body.suspended) {
    return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
  }

  try {
    await db
      .update(users)
      .set({ status: body.suspended ? "suspended" : "live" })
      .where(eq(users.id, body.userId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/users PATCH]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
