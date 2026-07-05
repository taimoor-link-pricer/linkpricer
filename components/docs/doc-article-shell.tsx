"use client";

// Docs article shell: sidebar nav, topbar search, prose body (placeholder
// copy, per the design handoff), scrollspy "on this page" ToC, pager, and
// the mobile sidebar drawer. Ported from docs/article.html + docs-article.js.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DocIcon } from "@/lib/design-v1/docs-icons";
import type { DocArticle, DocSection } from "@/lib/design-v1/docs-data";
import { DOC_SECTIONS, docArticlesInSection } from "@/lib/design-v1/docs-data";
import { articleHref, sectionHref } from "@/lib/design-v1/docs-links";
import { DocsSearch } from "./docs-search";

const HEADINGS = [
  { id: "overview", text: "Overview", level: 2 },
  { id: "step-by-step", text: "Step by step", level: 2 },
  { id: "example", text: "Example", level: 3 },
  { id: "tips", text: "Tips & best practices", level: 2 },
  { id: "related", text: "Related articles", level: 2 },
] as const;

function Heading({ id, level, children }: { id: string; level: 2 | 3; children: React.ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id}>
      {children}
      <a className="anchor" href={`#${id}`} aria-hidden="true">#</a>
    </Tag>
  );
}

const LOREM = [
  "This is placeholder copy that will be replaced with the real documentation text. It describes what the feature does, why it matters, and the outcome a user can expect once they complete the steps below.",
  "Keep paragraphs focused on a single idea so the page stays easy to scan. Where a concept needs defining, use a term callout; where an exact value or command matters, use inline code.",
  "When the supplied content arrives, swap these paragraphs out — the headings, anchors, sidebar entry and on-this-page list will continue to work unchanged.",
  "Each step should map to one clear action the user takes in the product, written in plain language and ordered the way they'll actually do it.",
];

export function DocArticleShell({
  article,
  section,
  prev,
  next,
}: {
  article: DocArticle;
  section: DocSection;
  prev?: DocArticle;
  next?: DocArticle;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>(HEADINGS[0].id);
  const proseRef = useRef<HTMLDivElement>(null);

  const related = docArticlesInSection(article.section)
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4);

  useEffect(() => {
    function onScroll() {
      const pos = window.scrollY + 150;
      let current: string = HEADINGS[0].id;
      for (const h of HEADINGS) {
        const el = document.getElementById(h.id);
        if (el && el.offsetTop <= pos) current = h.id;
      }
      setActiveHeading(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <div className="docs-topbar">
        <div className="docs-topbar__in">
          <button className="docs-menu-btn" aria-label="Open docs menu" onClick={() => setSidebarOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            Menu
          </button>
          <DocsSearch />
        </div>
      </div>

      <div className="docs-shell">
        {/* sidebar */}
        <aside className={`side${sidebarOpen ? " is-open" : ""}`} aria-label="Docs navigation">
          <button className="side__close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div className="side__group">
            <ul className="side__list">
              {DOC_SECTIONS.map((s) => {
                const arts = docArticlesInSection(s.id);
                const open = s.id === article.section;
                return (
                  <li key={s.id} className={`side__sec${open ? " is-open" : ""}`}>
                    <Link href={sectionHref(s)}>
                      <DocIcon name={s.icon} className="ic" />
                      <span>{s.label}</span>
                    </Link>
                    <ul className="side__sub">
                      {arts.map((a) => (
                        <li key={a.slug}>
                          <Link href={articleHref(a)} aria-current={a.slug === article.slug ? "page" : undefined} onClick={() => setSidebarOpen(false)}>
                            {a.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
        <div className={`side-backdrop${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} />

        {/* main article */}
        <main className="doc-main">
          <nav className="doc-crumbs">
            <Link href="/docs">Docs</Link>
            <span className="sep">/</span>
            <Link href={sectionHref(section)}>{section.label}</Link>
            <span className="sep">/</span>
            <span className="here">{article.title}</span>
          </nav>

          <h1>{article.title}</h1>
          <p className="doc-lede">{article.desc} This page uses placeholder text until the final copy is supplied.</p>
          <div className="doc-updated">
            <span className="tag">{section.label}</span>
            <span>{article.read} read</span>
            <span className="dotsep">·</span>
            <span>Last updated Jun 24, 2026</span>
          </div>

          <div className="doc-prose" ref={proseRef}>
            <p>{LOREM[0]}</p>
            <div className="doc-term">
              <span className="k">Term</span>
              <p><strong>{article.title.split(" ")[0]}</strong> — a short, plain-language definition of a key concept used in this article. Replace with the real glossary copy.</p>
            </div>

            <Heading id="overview" level={2}>Overview</Heading>
            <p>{LOREM[1]}</p>
            <p>{LOREM[2]}</p>
            <ul>
              <li>A key point or benefit of this feature, kept to one line.</li>
              <li>Another point — what the user can accomplish here.</li>
              <li>A third point that rounds out the summary.</li>
            </ul>

            <Heading id="step-by-step" level={2}>Step by step</Heading>
            <p>Follow these steps to complete the task. Replace the placeholder actions with the real flow.</p>
            <ol>
              <li>Open the relevant area of the app and locate the primary action.</li>
              <li>Enter or paste the required input — for example a list of <code>domains</code>.</li>
              <li>Review the result and adjust any options as needed.</li>
              <li>Confirm to finish. You&apos;ll see a confirmation once it&apos;s done.</li>
            </ol>
            <div className="doc-term note">
              <span className="k">Note</span>
              <p>Use this callout for tips, caveats or anything the reader should not miss. Swap for real guidance.</p>
            </div>

            <Heading id="example" level={3}>Example</Heading>
            <p>A short worked example helps readers map the steps to their own situation:</p>
            <pre><code>{"forbes.com\nhealthline.com\ntechcrunch.com 1100\nexample-blog.net"}</code></pre>
            <p>{LOREM[0]}</p>

            <Heading id="tips" level={2}>Tips &amp; best practices</Heading>
            <p>{LOREM[1]}</p>
            <ul>
              <li>A recommended habit that helps users get more from the feature.</li>
              <li>A common pitfall to avoid, phrased as a positive action.</li>
            </ul>

            <Heading id="related" level={2}>Related articles</Heading>
            <p>Point readers to logical next steps. These links are generated from the same section so they stay accurate as content grows.</p>
            {related.length > 0 && (
              <ul>
                {related.map((a) => (
                  <li key={a.slug}>
                    <Link href={articleHref(a)}>{a.title}</Link> — {a.desc}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="doc-foot">
            <div className="helpful">
              <span>Was this page helpful?</span>
              <button type="button">👍 Yes</button>
              <button type="button">👎 No</button>
            </div>
            <div className="doc-pager">
              {prev && (
                <Link href={articleHref(prev)}>
                  <span className="lbl">← Previous</span>
                  <span className="ttl">{prev.title}</span>
                </Link>
              )}
              {next && (
                <Link href={articleHref(next)} style={{ textAlign: "right" }}>
                  <span className="lbl">Next →</span>
                  <span className="ttl">{next.title}</span>
                </Link>
              )}
            </div>
          </div>
        </main>

        {/* on this page */}
        <aside className="doc-toc" aria-label="On this page">
          <div className="doc-toc__h">On this page</div>
          <ul className="doc-toc__list">
            {HEADINGS.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className={`${h.level === 3 ? "lvl-3" : ""}${h.id === activeHeading ? " is-active" : ""}`}>
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
          <a
            className="doc-toc__top"
            href="#top"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); history.replaceState(null, "", location.pathname); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            Back to top
          </a>
        </aside>
      </div>
    </>
  );
}
