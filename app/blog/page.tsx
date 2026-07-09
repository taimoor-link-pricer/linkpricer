import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BlogStyles } from "@/components/blog/blog-styles";
import { ArticleCard } from "@/components/blog/article-card";
import { blogFormatDate, blogInitials } from "@/lib/blog/format";
import { getPublishedPosts } from "@/lib/blog/queries";

const BLOG_INDEX_TITLE = "Blog · Linkpricer — Backlink buying, pricing & link-building playbooks";
const BLOG_INDEX_DESCRIPTION =
  "Data-driven guides, case studies and marketplace comparisons on buying backlinks, link pricing, and building authority — from the team behind Linkpricer.";

export const metadata: Metadata = {
  title: BLOG_INDEX_TITLE,
  description: BLOG_INDEX_DESCRIPTION,
  openGraph: {
    type: "website",
    title: "The Linkpricer Blog",
    description: "Guides, case studies and marketplace comparisons on buying backlinks and link pricing.",
    url: "https://linkpricer.com/blog",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Linkpricer Blog",
    description: "Guides, case studies and marketplace comparisons on buying backlinks and link pricing.",
    images: ["/logo.png"],
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

  const all = await getPublishedPosts();
  const list = active === "all" ? all : all.filter((a) => a.categorySlug === active);

  const featured = active === "all" ? list[0] : undefined;
  const rest = active === "all" ? list.slice(1) : list;
  const gridLabel = active === "all" ? "Latest articles" : (list[0]?.categoryLabel ?? active);

  // Dynamic chips built from real category data present on published posts —
  // not a fixed taxonomy, since real content rarely has a category set.
  const categoryCounts = new Map<string, { label: string; count: number }>();
  for (const a of all) {
    const entry = categoryCounts.get(a.categorySlug);
    if (entry) entry.count += 1;
    else categoryCounts.set(a.categorySlug, { label: a.categoryLabel, count: 1 });
  }
  const chips = [
    { slug: "all", label: "All", count: all.length },
    ...[...categoryCounts.entries()]
      .sort((x, y) => y[1].count - x[1].count)
      .map(([slug, { label, count }]) => ({ slug, label, count })),
  ];

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "The Linkpricer Blog",
      description: BLOG_INDEX_DESCRIPTION,
      url: "https://linkpricer.com/blog",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://linkpricer.com" },
        { "@type": "ListItem", position: 2, name: "Blog", item: "https://linkpricer.com/blog" },
      ],
    },
  ];

  return (
    <div className="lp-reset" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <BlogStyles />
      <SiteHeader />

      <main className="lp-blog-wrap">
        <div className="lp-blog-head">
          <h1>The Linkpricer Blog</h1>
          <p>Data-driven playbooks, case studies and marketplace comparisons on buying backlinks, pricing links and building real authority.</p>
        </div>

        <div className="lp-blog-filters" role="tablist" aria-label="Filter articles by type">
          {chips.map((c) => (
            <Link
              key={c.slug}
              href={c.slug === "all" ? "/blog" : `/blog?type=${c.slug}`}
              className="lp-blog-chip"
              role="tab"
              aria-pressed={c.slug === active}
            >
              {c.label}
              <span className="lp-blog-chip__count">{c.count}</span>
            </Link>
          ))}
        </div>

        {!list.length ? (
          <div className="lp-blog-grid">
            <div className="lp-blog-empty">No articles in this category yet — check back soon.</div>
          </div>
        ) : (
          <>
            {featured && (
              <section>
                <article className="lp-blog-featured" data-lp-cat={featured.categorySlug}>
                  <div>
                    <Link className="lp-blog-featured__eyebrow" href={`/blog?type=${featured.categorySlug}`}>
                      <span className="lp-blog-tag">{featured.categoryLabel}</span>
                    </Link>
                    <h2><Link href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
                    <p className="lp-blog-featured__excerpt">{featured.excerpt}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, color: "var(--lp-mute)" }}>
                      <span className="lp-blog-avatar">{blogInitials(featured.author)}</span>
                      <span><strong>{featured.author}</strong></span>
                      <span className="lp-blog-dotsep">·</span><span>{blogFormatDate(featured.publishedAt)}</span>
                      <span className="lp-blog-dotsep">·</span><span>{featured.readTime}</span>
                    </div>
                  </div>
                  <Link className="lp-blog-ph lp-blog-featured__media" href={`/blog/${featured.slug}`}>
                    {featured.coverImageUrl ? (
                      <img
                        src={featured.coverImageUrl}
                        alt={featured.title}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", color: "transparent" }}
                      />
                    ) : (
                      <span className="lp-blog-ph__label">featured cover · 16:10</span>
                    )}
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
