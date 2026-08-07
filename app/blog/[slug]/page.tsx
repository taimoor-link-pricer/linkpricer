import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BlogStyles } from "@/components/blog/blog-styles";
import { BlogCta } from "@/components/blog/blog-cta";
import { RelatedArticles } from "@/components/blog/related-articles";
import { ArticleContent } from "@/components/blog/article-content";
import { blogFormatDate, blogInitials, toDate } from "@/lib/blog/format";
import { getPublishedPostBySlug, getRelatedPosts } from "@/lib/blog/queries";
import type { BlogPostDetail } from "@/lib/blog/types";

export const revalidate = 300;

const DEFAULT_CTA = {
  eyebrow: "Try it yourself",
  heading: "Compare prices across 28+ marketplaces",
  body: "Paste your shortlist into Linkpricer and see every vendor's price for each domain side by side — then order the best deal directly, with one transparent fee.",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Blog" };

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  const url = `https://linkpricer.com/blog/${post.slug}`;
  const image = post.coverImageUrl ?? "/logo.png";

  return {
    title,
    description,
    authors: [{ name: post.author }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      images: [image],
      publishedTime: toDate(post.publishedAt).toISOString(),
      modifiedTime: post.updatedAt ? toDate(post.updatedAt).toISOString() : undefined,
      authors: [post.author],
      section: post.categoryLabel,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}

function buildArticleSchema(post: BlogPostDetail) {
  const url = `https://linkpricer.com/blog/${post.slug}`;
  // JSON-LD is hand-built here, unlike generateMetadata's openGraph.images
  // (which Next resolves against metadataBase automatically) — schema.org
  // requires an absolute URL, so resolve any relative proxy path ourselves.
  const image = post.coverImageUrl
    ? new URL(post.coverImageUrl, "https://linkpricer.com").toString()
    : "https://linkpricer.com/logo.png";
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.excerpt,
      image,
      datePublished: toDate(post.publishedAt).toISOString(),
      dateModified: toDate(post.updatedAt ?? post.publishedAt).toISOString(),
      author: { "@type": "Person", name: post.author },
      publisher: {
        "@type": "Organization",
        name: "Linkpricer",
        logo: { "@type": "ImageObject", url: "https://linkpricer.com/logo.png" },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: post.categoryLabel,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://linkpricer.com" },
        { "@type": "ListItem", position: 2, name: "Blog", item: "https://linkpricer.com/blog" },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const role = post.authorTitle || "Contributor, Linkpricer";
  const related = await getRelatedPosts(post);

  return (
    <div className="lp-reset" data-lp-cat={post.categorySlug} style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleSchema(post)) }} />
      <BlogStyles />
      <SiteHeader />

      <main>
        <div className="lp-blog-wrap lp-blog-read lp-blog-article-head">
          <Link className="lp-blog-crumb" href="/blog">← All articles</Link>
          <span className="lp-blog-tag">{post.categoryLabel}</span>
          <h1>{post.title}</h1>
          <p className="dek">{post.excerpt}</p>

          <div className="lp-blog-byline">
            <span className="who">
              <span className="lp-blog-avatar">{blogInitials(post.author)}</span>
              <span><b>{post.author}</b><br /><span>{role}</span></span>
            </span>
            <span className="facts">
              <span>{blogFormatDate(post.publishedAt)}</span><span className="lp-blog-dotsep">·</span>
              <span>{post.readTime}</span><span className="lp-blog-dotsep">·</span>
              <span className="lp-blog-tag">{post.categoryLabel}</span>
            </span>
          </div>
        </div>

        <div className="lp-blog-wrap lp-blog-read">
          <figure className="lp-blog-ph lp-blog-cover">
            {post.coverImageUrl ? (
              <img
                src={post.coverImageUrl}
                alt={post.title}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", color: "transparent" }}
              />
            ) : (
              <span className="lp-blog-ph__label">cover image · 1600×800</span>
            )}
          </figure>
        </div>

        <ArticleContent post={post} />

        <BlogCta eyebrow={DEFAULT_CTA.eyebrow} heading={DEFAULT_CTA.heading} body={DEFAULT_CTA.body} />
        <RelatedArticles posts={related} />
      </main>

      <SiteFooter />
    </div>
  );
}
