import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { BlogStyles } from "@/components/blog/blog-styles";
import { BlogCta } from "@/components/blog/blog-cta";
import { RelatedArticles } from "@/components/blog/related-articles";
import { SaasBacklinksBody } from "@/components/blog/articles/saas-backlinks-body";
import { VsAgenciesBody } from "@/components/blog/articles/vs-agencies-body";
import { GenericArticleBody } from "@/components/blog/generic-article-body";
import { BLOG_ARTICLES, blogArticleBySlug, blogCategoryLabel, blogFormatDate, blogInitials } from "@/lib/design-v1/blog-data";

const AUTHOR_ROLES: Record<string, string> = {
  "Karolis Butkus": "Head of Growth, Linkpricer",
  "Mara Devlin": "Editor, Linkpricer",
  "Devon Ray": "Contributor, Linkpricer",
};

// Custom deks (subheads) + CTA copy, verbatim where the design handoff wrote
// them; a neutral default for slugs that don't have hand-written copy yet.
const DEKS: Record<string, string> = {
  "how-to-build-backlinks-for-saas-products":
    "Earning links for a SaaS product is its own discipline: long sales cycles, technical buyers and a thin content surface. Here is the budget-aware framework we use to grow authority without torching a domain.",
  "linkpricer-vs-traditional-agencies":
    "Both can grow your backlink profile. They differ sharply on what you pay, how much you control, and how fast you move. Here's the honest, criteria-by-criteria breakdown.",
};

const CTAS: Record<string, { eyebrow: string; heading: string; body: string }> = {
  "how-to-build-backlinks-for-saas-products": {
    eyebrow: "Stop overpaying for links",
    heading: "Compare prices across 28+ marketplaces",
    body: "Paste your shortlist into Linkpricer and see every vendor's price for each domain side by side — then order the best deal directly, with one transparent fee.",
  },
  "linkpricer-vs-traditional-agencies": {
    eyebrow: "See the price difference yourself",
    heading: "Compare prices across 28+ marketplaces",
    body: "Paste your shortlist into Linkpricer and see every vendor's price for each domain side by side — one transparent fee, pay only after publication.",
  },
};
const DEFAULT_CTA = {
  eyebrow: "Try it yourself",
  heading: "Compare prices across 28+ marketplaces",
  body: "Paste your shortlist into Linkpricer and see every vendor's price for each domain side by side — then order the best deal directly, with one transparent fee.",
};

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = blogArticleBySlug(slug);
  if (!article) return { title: "Blog · Linkpricer" };
  return {
    title: `${article.title} · Linkpricer`,
    description: article.excerpt,
    authors: [{ name: article.author }],
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url: `https://linkpricer.com/blog/${article.slug}`,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = blogArticleBySlug(slug);
  if (!article) notFound();

  const dek = DEKS[article.slug] ?? article.excerpt;
  const cta = CTAS[article.slug] ?? DEFAULT_CTA;
  const role = AUTHOR_ROLES[article.author] ?? "Contributor, Linkpricer";

  return (
    <div className="lp-reset" data-lp-cat={article.category} style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <BlogStyles />
      <SiteHeader />

      <main>
        <div className="lp-blog-wrap lp-blog-read lp-blog-article-head">
          <Link className="lp-blog-crumb" href="/blog">← All articles</Link>
          <span className="lp-blog-tag">{blogCategoryLabel(article.category)}</span>
          <h1>{article.title}</h1>
          <p className="dek">{dek}</p>

          <div className="lp-blog-byline">
            <span className="who">
              <span className="lp-blog-avatar">{blogInitials(article.author)}</span>
              <span><b>{article.author}</b><br /><span>{role}</span></span>
            </span>
            <span className="facts">
              <span>{blogFormatDate(article.date)}</span><span className="lp-blog-dotsep">·</span>
              <span>{article.read}</span><span className="lp-blog-dotsep">·</span>
              <span className="lp-blog-tag">{blogCategoryLabel(article.category)}</span>
            </span>
          </div>
        </div>

        <div className="lp-blog-wrap lp-blog-read">
          <figure className="lp-blog-ph lp-blog-cover"><span className="lp-blog-ph__label">cover image · 1600×800</span></figure>
          <p className="lp-blog-cover-cap">Replace with a hero illustration or product screenshot (16:8, ≥1600px wide).</p>
        </div>

        {article.template === "comparison" ? (
          article.slug === "linkpricer-vs-traditional-agencies" ? <VsAgenciesBody /> : <GenericArticleBody article={article} />
        ) : article.slug === "how-to-build-backlinks-for-saas-products" ? (
          <SaasBacklinksBody />
        ) : (
          <GenericArticleBody article={article} />
        )}

        <BlogCta eyebrow={cta.eyebrow} heading={cta.heading} body={cta.body} />
        <RelatedArticles currentSlug={article.slug} />
      </main>

      <SiteFooter />
    </div>
  );
}
