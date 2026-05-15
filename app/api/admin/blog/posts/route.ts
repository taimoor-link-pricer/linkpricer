import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts, authors } from "@/lib/db/schema";
import { eq, desc, ilike, or, and, count, SQL } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { z } from "zod";

const PAGE_SIZE = 20;

const createPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  excerpt: z.string().default(""),
  content: z.string().default(""),
  htmlContent: z.string().optional().nullable(),
  cssContent: z.string().optional().nullable(),
  contentType: z.enum(["text", "html"]).default("text"),
  category: z.string().default(""),
  authorId: z.string().optional().nullable(),
  author: z.string().default("LinkPricer Team"),
  authorTitle: z.string().optional().nullable(),
  authorBio: z.string().optional().nullable(),
  authorTwitterUrl: z.string().optional().nullable(),
  authorLinkedinUrl: z.string().optional().nullable(),
  authorWebsiteUrl: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  published: z.boolean().default(false),
  publishedAt: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") ?? "all"; // "all" | "published" | "draft"

  try {
    // Build where conditions — never pull content/htmlContent in list view
    const conditions: SQL[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.category, `%${search}%`),
          ilike(blogPosts.excerpt, `%${search}%`)
        ) as SQL
      );
    }
    if (status === "published") conditions.push(eq(blogPosts.published, true));
    if (status === "draft") conditions.push(eq(blogPosts.published, false));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Run count + rows in parallel — avoids paying the Neon cold-start twice
    const [countResult, rows] = await Promise.all([
      db.select({ total: count() }).from(blogPosts).where(where),
      // Select only list-safe columns — skip content/htmlContent (can be MBs)
      db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          category: blogPosts.category,
          author: blogPosts.author,
          coverImageUrl: blogPosts.coverImageUrl,
          published: blogPosts.published,
          publishedAt: blogPosts.publishedAt,
          createdAt: blogPosts.createdAt,
          updatedAt: blogPosts.updatedAt,
        })
        .from(blogPosts)
        .where(where)
        .orderBy(desc(blogPosts.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
    ]);

    const total = Number(countResult[0].total);

    return NextResponse.json({
      posts: rows,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    console.error("[GET /api/admin/blog/posts]", err);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createPostSchema.parse(body);

    // Enrich author fields from linked author record if authorId is set
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

    const [post] = await db.insert(blogPosts).values(data).returning();
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.issues }, { status: 400 });
    }
    console.error("[POST /api/admin/blog/posts]", err);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
