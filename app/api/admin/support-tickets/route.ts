export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { supportTickets, users } from "@/lib/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status && status !== "all" ? eq(supportTickets.status, status) : undefined;

  const rows = await db
    .select({
      id: supportTickets.id,
      topic: supportTickets.topic,
      subject: supportTickets.subject,
      message: supportTickets.message,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      userEmail: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(where)
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);

  return NextResponse.json({ tickets: rows });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json() as { id?: string; status?: string };
  if (!id || !status) return NextResponse.json({ error: "Missing id or status." }, { status: 400 });

  await db
    .update(supportTickets)
    .set({ status })
    .where(eq(supportTickets.id, id));

  return NextResponse.json({ ok: true });
}
