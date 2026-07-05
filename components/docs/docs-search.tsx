"use client";

// Docs search box + instant results dropdown. Ported from docs/docs.js
// (wireSearch / search / highlight) — client-side only, searches the
// static DOC_ARTICLES registry.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { docSearch } from "@/lib/design-v1/docs-data";
import { articleHref } from "@/lib/design-v1/docs-links";

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: "#fff2ab", color: "inherit", padding: "0 1px", borderRadius: 3 }}>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function DocsSearch({ size = "sm" }: { size?: "sm" | "lg" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = useMemo(() => docSearch(query), [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // "/" keyboard shortcut focuses this box (matches source behaviour)
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "/" && !/input|textarea/i.test((document.activeElement?.tagName ?? ""))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length) setActive((n) => (n + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((n) => (n - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (active >= 0 && results[active]) router.push(articleHref(results[active].article));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  let lastSectionLabel: string | null = null;

  return (
    <div ref={rootRef} className={`docs-search${size === "lg" ? " docs-search--lg" : ""}`}>
      <div className={`docs-search__box${open ? " is-active" : ""}`} onClick={() => inputRef.current?.focus()}>
        <svg width={size === "lg" ? 20 : 18} height={size === "lg" ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search the docs…"
          aria-label="Search the docs"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className="docs-search__kbd">/</span>
      </div>

      {open && (
        <div className="docs-search__results is-open">
          {!query.trim() ? (
            <div className="docs-search__hint">Type to search the docs — try "order", "metrics" or "anchor".</div>
          ) : !results.length ? (
            <div className="docs-search__empty">No results for "{query}".<br />Try a feature name like "orders" or "billing".</div>
          ) : (
            results.map((r, idx) => {
              const showLabel = r.section.label !== lastSectionLabel;
              lastSectionLabel = r.section.label;
              return (
                <div key={r.article.slug}>
                  {showLabel && <div className="docs-search__sectionlabel">{r.section.label}</div>}
                  <a
                    className={`docs-search__item${idx === active ? " is-active" : ""}`}
                    href={articleHref(r.article)}
                  >
                    <div className="t">{highlight(r.article.title, query)}</div>
                    <div className="d">{r.article.desc}</div>
                  </a>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
