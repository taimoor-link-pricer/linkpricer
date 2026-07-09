import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog/types";
import { blogFormatDate, blogInitials, truncate } from "@/lib/blog/format";

export function ArticleCard({ article }: { article: BlogPostSummary }) {
  return (
    <Link href={`/blog/${article.slug}`} className="lp-blog-card" data-lp-cat={article.categorySlug}>
      <span className="lp-blog-ph lp-blog-card__media">
        {article.coverImageUrl ? (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            loading="lazy"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", color: "transparent" }}
          />
        ) : (
          <span className="lp-blog-ph__label">cover · {article.categoryLabel}</span>
        )}
      </span>
      <div className="lp-blog-card__cat">
        <span className="lp-blog-tag">{article.categoryLabel}</span>
      </div>
      <h3 className="lp-blog-card__title">{truncate(article.title)}</h3>
      <p className="lp-blog-card__excerpt">{truncate(article.excerpt)}</p>
      <div className="lp-blog-card__meta">
        <span className="lp-blog-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{blogInitials(article.author)}</span>
        <span>{article.author}</span>
        <span className="lp-blog-dotsep">·</span>
        <span>{blogFormatDate(article.publishedAt)}</span>
        <span className="lp-blog-dotsep">·</span>
        <span>{article.readTime}</span>
      </div>
    </Link>
  );
}
