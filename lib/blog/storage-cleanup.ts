import { getStorage } from "firebase-admin/storage";

// Matches exactly what /api/admin/blog/upload-image/route.ts writes:
// https://storage.googleapis.com/{bucket}/blog-images/{name}. Only ever
// deletes objects under that prefix in our own bucket — never an external
// URL an admin might have pasted directly into a cover image / content field
// instead of uploading through that route.
function extractBlogImagePath(url: string): string | null {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return null;
  const prefix = `https://storage.googleapis.com/${bucket}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return path.startsWith("blog-images/") ? path : null;
}

// Pulls every <img src="..."> out of already-sanitized post HTML — same
// plain-regex approach injectHeadingIds() already uses on this same content
// elsewhere in lib/blog/content.ts.
function extractImgSrcs(html: string | null | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/<img\s[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
}

// Best-effort: a blog post/author row is the source of truth, an orphaned
// Storage object is just wasted space, so a deletion failure here (including
// Storage not being configured) must never fail the caller's own delete.
export async function deleteBlogStorageImages(urls: (string | null | undefined)[]): Promise<void> {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return;

  const paths = [...new Set(urls.filter((u): u is string => !!u).map(extractBlogImagePath).filter((p): p is string => !!p))];
  if (paths.length === 0) return;

  try {
    const storageBucket = getStorage().bucket(bucket);
    await Promise.all(
      paths.map((path) =>
        storageBucket
          .file(path)
          .delete()
          .catch((err) => console.error(`[deleteBlogStorageImages] failed to delete ${path}`, err))
      )
    );
  } catch (err) {
    console.error("[deleteBlogStorageImages]", err);
  }
}

export function collectPostImageUrls(post: { coverImageUrl?: string | null; content?: string | null; htmlContent?: string | null }): string[] {
  return [post.coverImageUrl, ...extractImgSrcs(post.content), ...extractImgSrcs(post.htmlContent)].filter((u): u is string => !!u);
}
