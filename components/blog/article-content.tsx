import { sanitizePostBody, injectHeadingIds } from "@/lib/blog/content";
import { TableOfContents } from "@/components/blog/table-of-contents";
import type { BlogPostDetail } from "@/lib/blog/types";

const MIN_HEADINGS_FOR_TOC = 3;

export function ArticleContent({ post }: { post: BlogPostDetail }) {
  const rawBody = post.contentType === "html" ? post.htmlContent || post.content : post.content;
  const sanitized = sanitizePostBody(rawBody, post.contentType);
  const { html, headings } = injectHeadingIds(sanitized);

  const hasToc = headings.length >= MIN_HEADINGS_FOR_TOC;

  if (!hasToc) {
    return (
      <article
        className="lp-blog-wrap lp-blog-read lp-blog-prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="lp-blog-wrap lp-blog-article-layout">
      <aside className="lp-blog-toc-col">
        <TableOfContents headings={headings} />
      </aside>
      <article className="lp-blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
