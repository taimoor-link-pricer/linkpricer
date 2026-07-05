// Route helpers for the docs section. The design handoff used query strings
// (article.html?a=slug, article.html?section=id) since it's static HTML;
// in the Next.js app each article gets its own clean route instead.
import type { DocArticle, DocSection } from "./docs-data";
import { docFirstArticleInSection } from "./docs-data";

export function articleHref(article: DocArticle): string {
  return `/docs/${article.slug}`;
}

// Mirrors the source's `article.html?section=id` fallback: browsing a
// section with no specific article opens that section's first article.
export function sectionHref(section: DocSection): string {
  const first = docFirstArticleInSection(section.id);
  return first ? articleHref(first) : "/docs";
}
