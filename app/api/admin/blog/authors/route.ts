import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authors } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { z } from "zod";

const authorSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  twitterUrl: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
});

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const all = await db.select().from(authors).orderBy(desc(authors.createdAt));
    return NextResponse.json(all);
  } catch (err) {
    console.error("[GET /api/admin/blog/authors]", err);
    return NextResponse.json({ error: "Failed to fetch authors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = authorSchema.parse(body);
    const [author] = await db.insert(authors).values(data).returning();
    return NextResponse.json(author, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 });
    }
    console.error("[POST /api/admin/blog/authors]", err);
    return NextResponse.json({ error: "Failed to create author" }, { status: 500 });
  }
}
