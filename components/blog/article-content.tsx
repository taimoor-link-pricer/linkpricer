import { sanitizePostBody } from "@/lib/blog/content";
import type { BlogPostDetail } from "@/lib/blog/types";

export function ArticleContent({ post }: { post: BlogPostDetail }) {
  const rawBody = post.contentType === "html" ? post.htmlContent || post.content : post.content;
  const html = sanitizePostBody(rawBody, post.contentType);

  return (
    <article
      className="lp-blog-wrap lp-blog-read lp-blog-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
