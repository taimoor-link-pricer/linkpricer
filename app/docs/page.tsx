import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { DocsSearch } from "@/components/docs/docs-search";
import { SectionCard } from "@/components/docs/section-card";
import { DOC_SECTIONS, docArticleBySlug } from "@/lib/design-v1/docs-data";
import { articleHref } from "@/lib/design-v1/docs-links";

export const metadata: Metadata = {
  title: "Documentation · Linkpricer",
  description:
    "Linkpricer documentation — guides and reference for domain comparison, related sites, favorites, orders, billing and support.",
  openGraph: {
    type: "website",
    title: "Linkpricer Documentation",
    description: "Searchable guides and reference for every Linkpricer feature.",
    url: "https://linkpricer.com/docs",
  },
  alternates: { canonical: "https://linkpricer.com/docs" },
};

const POPULAR_SLUGS = ["your-first-search", "placing-an-order", "understanding-metrics"];
const POPULAR_LABELS: Record<string, string> = {
  "your-first-search": "Run your first search",
  "placing-an-order": "Placing an order",
  "understanding-metrics": "Understanding metrics",
};

export default function DocsHomePage() {
  return (
    <div className="lp-reset" style={{ background: "#fff", minHeight: "100vh", fontFamily: "var(--lp-sans)", color: "var(--lp-ink)" }}>
      <SiteHeader />

      <main>
        <section className="docs-hero">
          <div className="eyebrow">Documentation</div>
          <h1>How can we help?</h1>
          <p>Guides and reference for every part of Linkpricer — search below or browse by feature.</p>

          <DocsSearch size="lg" />

          <div className="popular">
            <span>Popular:</span>
            {POPULAR_SLUGS.map((slug) => {
              const article = docArticleBySlug(slug);
              if (!article) return null;
              return (
                <a key={slug} href={articleHref(article)}>
                  {POPULAR_LABELS[slug]}
                </a>
              );
            })}
          </div>
        </section>

        <div className="docs-cards">
          {DOC_SECTIONS.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>

        <div style={{ height: 64 }} />
      </main>

      <SiteFooter />
    </div>
  );
}
