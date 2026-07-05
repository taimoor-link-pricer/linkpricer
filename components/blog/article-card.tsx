import Link from "next/link";
import type { BlogArticle } from "@/lib/design-v1/blog-data";
import { blogCategoryLabel, blogFormatDate, blogInitials } from "@/lib/design-v1/blog-data";

export function ArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link href={`/blog/${article.slug}`} className="lp-blog-card" data-lp-cat={article.category}>
      <span className="lp-blog-ph lp-blog-card__media">
        <span className="lp-blog-ph__label">cover · {article.category}</span>
      </span>
      <div className="lp-blog-card__cat">
        <span className="lp-blog-tag">{blogCategoryLabel(article.category)}</span>
      </div>
      <h3 className="lp-blog-card__title">{article.title}</h3>
      <p className="lp-blog-card__excerpt">{article.excerpt}</p>
      <div className="lp-blog-card__meta">
        <span className="lp-blog-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{blogInitials(article.author)}</span>
        <span>{article.author}</span>
        <span className="lp-blog-dotsep">·</span>
        <span>{blogFormatDate(article.date)}</span>
        <span className="lp-blog-dotsep">·</span>
        <span>{article.read}</span>
      </div>
    </Link>
  );
}
