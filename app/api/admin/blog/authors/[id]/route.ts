import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authors, blogPosts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { deleteBlogStorageImages } from "@/lib/blog/storage-cleanup";
import { z } from "zod";

const updateAuthorSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  twitterUrl: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [author] = await db.select().from(authors).where(eq(authors.id, id)).limit(1);
    if (!author) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(author);
  } catch (err) {
    console.error("[GET /api/admin/blog/authors/:id]", err);
    return NextResponse.json({ error: "Failed to fetch author" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const data = updateAuthorSchema.parse(body);
    const now = new Date().toISOString();

    const [author] = await db
      .update(authors)
      .set({ ...data, updatedAt: now })
      .where(eq(authors.id, id))
      .returning();

    if (!author) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(author);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 });
    }
    console.error("[PUT /api/admin/blog/authors/:id]", err);
    return NextResponse.json({ error: "Failed to update author" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const postsUsingAuthor = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(eq(blogPosts.authorId, id))
      .limit(1);

    if (postsUsingAuthor.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete author assigned to blog posts. Reassign posts first." },
        { status: 400 }
      );
    }

    const [deleted] = await db.delete(authors).where(eq(authors.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteBlogStorageImages([deleted.avatarUrl]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/blog/authors/:id]", err);
    return NextResponse.json({ error: "Failed to delete author" }, { status: 500 });
  }
}
