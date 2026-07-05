import { ArticleCard } from "./article-card";
import { BLOG_ARTICLES } from "@/lib/design-v1/blog-data";

export function RelatedArticles({ currentSlug }: { currentSlug: string }) {
  const related = BLOG_ARTICLES.filter((a) => a.slug !== currentSlug).slice(0, 3);
  if (!related.length) return null;
  return (
    <section className="lp-blog-wrap lp-blog-read lp-blog-related">
      <h3>Related articles</h3>
      <div className="lp-blog-grid">
        {related.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
