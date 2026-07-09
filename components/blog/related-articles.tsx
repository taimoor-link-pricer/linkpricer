import { ArticleCard } from "./article-card";
import type { BlogPostSummary } from "@/lib/blog/types";

export function RelatedArticles({ posts }: { posts: BlogPostSummary[] }) {
  if (!posts.length) return null;
  return (
    <section className="lp-blog-wrap lp-blog-read lp-blog-related">
      <h3>Related articles</h3>
      <div className="lp-blog-grid">
        {posts.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
