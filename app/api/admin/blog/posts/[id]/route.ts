import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, authors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { collectPostImageUrls, deleteBlogStorageImages } from "@/lib/blog/storage-cleanup";
import { z } from "zod";

const updatePostSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  htmlContent: z.string().optional().nullable(),
  cssContent: z.string().optional().nullable(),
  contentType: z.enum(["text", "html"]).optional(),
  category: z.string().optional(),
  authorId: z.string().optional().nullable(),
  author: z.string().optional(),
  authorTitle: z.string().optional().nullable(),
  authorBio: z.string().optional().nullable(),
  authorTwitterUrl: z.string().optional().nullable(),
  authorLinkedinUrl: z.string().optional().nullable(),
  authorWebsiteUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  published: z.boolean().optional(),
  publishedAt: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch (err) {
    console.error("[GET /api/admin/blog/posts/:id]", err);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
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
    const data = updatePostSchema.parse(body);

    // Sync author fields from linked author record
    if (data.authorId) {
      const [linked] = await db.select().from(authors).where(eq(authors.id, data.authorId)).limit(1);
      if (linked) {
        data.author = linked.name;
        data.authorTitle = linked.title;
        data.authorBio = linked.bio;
        data.authorTwitterUrl = linked.twitterUrl;
        data.authorLinkedinUrl = linked.linkedinUrl;
        data.authorWebsiteUrl = linked.websiteUrl;
      }
    }

    const now = new Date().toISOString();
    const [post] = await db
      .update(blogPosts)
      .set({ ...data, updatedAt: now })
      .where(eq(blogPosts.id, id))
      .returning();

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 });
    }
    console.error("[PUT /api/admin/blog/posts/:id]", err);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
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
    const [deleted] = await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteBlogStorageImages(collectPostImageUrls(deleted));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/blog/posts/:id]", err);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
