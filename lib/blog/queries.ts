import { db } from "@/lib/db";
import { blogPosts, authors } from "@/lib/db/schema";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import { computeReadingTime, computeReadingTimeFromCharCount, slugifyCategory } from "./content";
import { proxiedImageSrc } from "./format";
import type { BlogPostSummary, BlogPostDetail } from "./types";

type AuthorRow = typeof authors.$inferSelect;

// List-safe columns only — skips content/htmlContent (can be tens of KB per
// row) since listing views don't render the body, matching the same
// principle as the admin list route (app/api/admin/blog/posts/route.ts).
// Reading time is estimated from a SQL length() instead of transferring
// the full text just to count words.
const listSelection = {
  slug: blogPosts.slug,
  title: blogPosts.title,
  excerpt: blogPosts.excerpt,
  category: blogPosts.category,
  author: blogPosts.author,
  authorTitle: blogPosts.authorTitle,
  coverImageUrl: blogPosts.coverImageUrl,
  publishedAt: blogPosts.publishedAt,
  updatedAt: blogPosts.updatedAt,
  createdAt: blogPosts.createdAt,
  contentChars: sql<number>`length(case when ${blogPosts.contentType} = 'html' then coalesce(${blogPosts.htmlContent}, ${blogPosts.content}) else ${blogPosts.content} end)`,
};

function categoryFields(category: string) {
  const trimmed = category.trim();
  if (!trimmed) return { category: "", categoryLabel: "Articles", categorySlug: "uncategorized" };
  return { category: trimmed, categoryLabel: trimmed, categorySlug: slugifyCategory(trimmed) };
}

function toSummaryFromList(
  row: {
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    author: string;
    authorTitle: string | null;
    coverImageUrl: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
    createdAt: string | null;
    contentChars: number;
  },
  author: AuthorRow | null
): BlogPostSummary {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    ...categoryFields(row.category),
    author: author?.name ?? row.author,
    authorTitle: author?.title ?? row.authorTitle,
    coverImageUrl: proxiedImageSrc(row.coverImageUrl),
    publishedAt: row.publishedAt ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt,
    readTime: computeReadingTimeFromCharCount(row.contentChars),
  };
}

function toDetail(post: typeof blogPosts.$inferSelect, author: AuthorRow | null): BlogPostDetail {
  const rawContent = post.contentType === "html" ? post.htmlContent || post.content : post.content;
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    ...categoryFields(post.category),
    author: author?.name ?? post.author,
    authorTitle: author?.title ?? post.authorTitle,
    coverImageUrl: proxiedImageSrc(post.coverImageUrl),
    publishedAt: post.publishedAt ?? post.createdAt ?? new Date().toISOString(),
    updatedAt: post.updatedAt,
    readTime: computeReadingTime(rawContent),
    contentType: post.contentType,
    content: post.content,
    htmlContent: post.htmlContent,
    authorBio: author?.bio ?? post.authorBio,
    authorTwitterUrl: author?.twitterUrl ?? post.authorTwitterUrl,
    authorLinkedinUrl: author?.linkedinUrl ?? post.authorLinkedinUrl,
    authorWebsiteUrl: author?.websiteUrl ?? post.authorWebsiteUrl,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
  };
}

export async function getPublishedPosts(): Promise<BlogPostSummary[]> {
  const rows = await db
    .select({ post: listSelection, author: authors })
    .from(blogPosts)
    .leftJoin(authors, eq(blogPosts.authorId, authors.id))
    .where(eq(blogPosts.published, true))
    .orderBy(desc(blogPosts.publishedAt));

  return rows.map(({ post, author }) => toSummaryFromList(post, author));
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPostDetail | undefined> {
  // Next's dynamic route params aren't guaranteed to arrive decoded (e.g. a
  // slug containing a literal space, from legacy migrated data, shows up
  // here as "Niche%20Edits" rather than "Niche Edits") — decode defensively.
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // malformed percent-encoding — fall back to the raw slug
  }

  const [row] = await db
    .select({ post: blogPosts, author: authors })
    .from(blogPosts)
    .leftJoin(authors, eq(blogPosts.authorId, authors.id))
    .where(and(eq(blogPosts.slug, decodedSlug), eq(blogPosts.published, true)))
    .limit(1);

  if (!row) return undefined;
  return toDetail(row.post, row.author);
}

export async function getRelatedPosts(post: BlogPostDetail, limit = 3): Promise<BlogPostSummary[]> {
  const rows = await db
    .select({ post: listSelection, author: authors })
    .from(blogPosts)
    .leftJoin(authors, eq(blogPosts.authorId, authors.id))
    .where(and(
      eq(blogPosts.category, post.category),
      eq(blogPosts.published, true),
      ne(blogPosts.slug, post.slug)
    ))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);

  return rows.map(({ post: row, author }) => toSummaryFromList(row, author));
}
