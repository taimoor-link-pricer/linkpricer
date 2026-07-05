// Placeholder body for blog articles that don't yet have real written
// copy in the design handoff — only two articles (the SaaS-backlinks guide
// and the Linkpricer-vs-agencies comparison) were fully written by Karolis.
// This mirrors the docs section's approach: an honest, clearly-labeled
// skeleton rather than invented claims/data under someone else's byline.
import type { BlogArticle } from "@/lib/design-v1/blog-data";

export function GenericArticleBody({ article }: { article: BlogArticle }) {
  return (
    <article className="lp-blog-wrap lp-blog-read lp-blog-prose">
      <p>
        This article hasn&apos;t been written yet — {article.title.toLowerCase()} is placeholder copy
        standing in for the real piece. The layout, headings and related-articles logic below are final;
        only the words need to be swapped in once the draft is ready.
      </p>

      <div className="lp-blog-callout">
        <span className="mark" />
        <p>
          <strong>Placeholder:</strong> {article.excerpt}
        </p>
      </div>

      <h2 id="overview">Overview</h2>
      <p>
        A short summary paragraph goes here, framing the problem or question this article answers and
        why it matters to someone buying or selling backlinks.
      </p>
      <p>
        A second paragraph continues the framing — this space exists to show reading rhythm and line
        length at the article&apos;s actual width, so the layout won&apos;t need to change once real
        copy replaces it.
      </p>

      <h2 id="details">The details</h2>
      <p>
        This is where the substantive body of the article lives — data, examples, a comparison, or a
        step-by-step framework, depending on what {article.title.toLowerCase()} turns out to cover.
      </p>
      <ul className="lead-list">
        <li><b>Key point one.</b> A concrete takeaway a reader should walk away with.</li>
        <li><b>Key point two.</b> Another distinct point, not a restatement of the first.</li>
        <li><b>Key point three.</b> Rounds out the summary before the closing section.</li>
      </ul>

      <h2 id="takeaway">Takeaway</h2>
      <p>
        A closing paragraph that ties the piece back to the practical decision a reader is trying to
        make, and points them toward pricing their own shortlist on Linkpricer.
      </p>
    </article>
  );
}
