import sanitizeHtml from "sanitize-html";
import { proxiedImageSrc } from "./format";

const BASE_ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "ul", "ol", "li",
  "strong", "em", "code", "pre", "blockquote", "img", "br", "hr",
  "div", "span", "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "id", "class", "style", "target", "rel"];

/**
 * "html"-contentType posts embed their own per-post scoped <style> block
 * (e.g. #sports-betting-post) directly in the body — that's the only place
 * their custom design actually lives, so `style` is allowed for that type.
 * The separate `cssContent` DB column is NOT used here: in the real data
 * it holds a full duplicate standalone HTML document (verified via direct
 * query), not extracted CSS, so injecting it as a <style> block would leak
 * raw article text onto the page rather than apply real styling.
 */
export function sanitizePostBody(html: string, contentType: string): string {
  const allowedTags = contentType === "html" ? [...BASE_ALLOWED_TAGS, "style"] : BASE_ALLOWED_TAGS;
  const sanitized = sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: { "*": ALLOWED_ATTR },
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          // Inline <img src> pointed at hosts that block cross-origin embeds
          // (see /api/blog/image/route.ts) needs the same proxy rewrite
          // applied to cover images elsewhere in lib/blog/queries.ts.
          src: proxiedImageSrc(attribs.src) ?? attribs.src,
          // Some legacy posts reference images on the old app's storage
          // that no longer exist (404) — hide the raw alt-text fallback
          // browsers show for a failed/loading <img> instead of letting it
          // clash with the page design.
          style: [attribs.style, "color:transparent"].filter(Boolean).join(";"),
        },
      }),
    },
  });

  // Real content (unlike the design's own hand-written example bodies,
  // which always wrap tables in .lp-blog-table-wrap) can include bare
  // <table> markup with several columns — wrap it the same way so wide
  // data tables scroll horizontally instead of breaking mobile layout.
  // Safe to do with a plain string replace here: the HTML has already
  // been through sanitizeHtml above, so <table>/</table> only appear as
  // real tags, never inside untrusted/unescaped text.
  return sanitized
    .replace(/<table/g, '<div class="lp-blog-table-wrap"><table')
    .replace(/<\/table>/g, "</table></div>");
}

export function computeReadingTime(rawContent: string): string {
  const wordsPerMinute = 200;
  const stripped = rawContent.replace(/<[^>]*>/g, " ");
  const wordCount = stripped.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  return `${minutes} min read`;
}

/**
 * Same 200wpm estimate as computeReadingTime, but from a raw character count
 * instead of the full text — lets list views ask Postgres for `length()`
 * instead of transferring every post's full content/htmlContent (up to
 * ~50KB each) just to show a "N min read" label.
 */
export function computeReadingTimeFromCharCount(charCount: number): string {
  const avgCharsPerWord = 6; // ~5 letters + 1 space, includes HTML tag overhead
  const wordsPerMinute = 200;
  const minutes = Math.max(1, Math.ceil(charCount / avgCharsPerWord / wordsPerMinute));
  return `${minutes} min read`;
}

export function slugifyCategory(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
