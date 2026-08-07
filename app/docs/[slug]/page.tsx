import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { DocArticleShell } from "@/components/docs/doc-article-shell";
import { DOC_ARTICLES, docArticleBySlug, docSectionById } from "@/lib/design-v1/docs-data";

export function generateStaticParams() {
  return DOC_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = docArticleBySlug(slug);
  if (!article) return { title: "Documentation" };
  return {
    title: `${article.title} · Docs`,
    description: article.desc,
  };
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = docArticleBySlug(slug);
  if (!article) notFound();

  const section = docSectionById(article.section);
  if (!section) notFound();

  const idx = DOC_ARTICLES.findIndex((a) => a.slug === article.slug);
  const prev = idx > 0 ? DOC_ARTICLES[idx - 1] : undefined;
  const next = idx < DOC_ARTICLES.length - 1 ? DOC_ARTICLES[idx + 1] : undefined;

  return (
    <div className="lp-reset" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <span id="top" />
      <SiteHeader />
      <DocArticleShell article={article} section={section} prev={prev} next={next} />
      <SiteFooter />
    </div>
  );
}
