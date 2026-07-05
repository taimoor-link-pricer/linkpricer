import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BlogStyles } from "@/components/blog/blog-styles";
import { ArticleCard } from "@/components/blog/article-card";
import { BLOG_CATEGORIES, blogArticlesSorted, blogCategoryLabel, blogFormatDate, blogInitials } from "@/lib/design-v1/blog-data";

export const metadata: Metadata = {
  title: "Blog · Linkpricer — Backlink buying, pricing & link-building playbooks",
  description:
    "Data-driven guides, case studies and marketplace comparisons on buying backlinks, link pricing, and building authority — from the team behind Linkpricer.",
  openGraph: {
    type: "website",
    title: "The Linkpricer Blog",
    description: "Guides, case studies and marketplace comparisons on buying backlinks and link pricing.",
    url: "https://linkpricer.com/blog",
  },
  alternates: { canonical: "https://linkpricer.com/blog" },
};

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const active = type ?? "all";

  const all = blogArticlesSorted();
  const list = active === "all" ? all : all.filter((a) => a.category === active);

  const featured = active === "all" ? list[0] : undefined;
  const rest = active === "all" ? list.slice(1) : list;
  const gridLabel = active === "all" ? "Latest articles" : blogCategoryLabel(active);

  const chips = [{ slug: "all", label: "All" }, ...BLOG_CATEGORIES];

  return (
    <div className="lp-reset" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <BlogStyles />
      <SiteHeader />

      <main className="lp-blog-wrap">
        <div className="lp-blog-head">
          <h1>The Linkpricer Blog</h1>
          <p>Data-driven playbooks, case studies and marketplace comparisons on buying backlinks, pricing links and building real authority.</p>
        </div>

        <div className="lp-blog-filters" role="tablist" aria-label="Filter articles by type">
          {chips.map((c) => {
            const count = c.slug === "all" ? all.length : all.filter((a) => a.category === c.slug).length;
            return (
              <Link
                key={c.slug}
                href={c.slug === "all" ? "/blog" : `/blog?type=${c.slug}`}
                className="lp-blog-chip"
                role="tab"
                aria-pressed={c.slug === active}
              >
                {c.label}
                <span className="lp-blog-chip__count">{count}</span>
              </Link>
            );
          })}
        </div>

        {!list.length ? (
          <div className="lp-blog-grid">
            <div className="lp-blog-empty">No articles in this category yet — check back soon.</div>
          </div>
        ) : (
          <>
            {featured && (
              <section>
                <article className="lp-blog-featured" data-lp-cat={featured.category}>
                  <div>
                    <Link className="lp-blog-featured__eyebrow" href={`/blog?type=${featured.category}`}>
                      <span className="lp-blog-tag">{blogCategoryLabel(featured.category)}</span>
                    </Link>
                    <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
                    <p className="lp-blog-featured__excerpt">{featured.excerpt}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: "var(--lp-mute)" }}>
                      <span className="lp-blog-avatar">{blogInitials(featured.author)}</span>
                      <span><strong>{featured.author}</strong></span>
                      <span className="lp-blog-dotsep">·</span><span>{blogFormatDate(featured.date)}</span>
                      <span className="lp-blog-dotsep">·</span><span>{featured.read}</span>
                    </div>
                  </div>
                  <Link className="lp-blog-ph lp-blog-featured__media" href={`/blog/${featured.slug}`}>
                    <span className="lp-blog-ph__label">featured cover · 16:10</span>
                  </Link>
                </article>
              </section>
            )}

            <h2 className="lp-blog-section-label">{gridLabel}</h2>
            <div className="lp-blog-grid">
              {rest.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </>
        )}

        <div style={{ height: 40 }} />
      </main>

      <SiteFooter />
    </div>
  );
}
