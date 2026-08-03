"use client";

import { useEffect, useState } from "react";
import type { TocHeading } from "@/lib/blog/content";

export function TableOfContents({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav className="lp-blog-toc" aria-label="Table of contents">
      <button
        type="button"
        className="lp-blog-toc__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="lp-blog-toc__label">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4h9M4 8h9M4 12h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="1.4" cy="4" r="1.1" fill="currentColor" />
            <circle cx="1.4" cy="8" r="1.1" fill="currentColor" />
            <circle cx="1.4" cy="12" r="1.1" fill="currentColor" />
          </svg>
          On this page
        </span>
        <svg
          className={open ? "lp-blog-toc__chev is-open" : "lp-blog-toc__chev"}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ol className="lp-blog-toc__rail">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? "lp-blog-toc__sub" : undefined}>
              <a href={`#${h.id}`} aria-current={h.id === activeId ? "location" : undefined}>
                {h.text}
              </a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
