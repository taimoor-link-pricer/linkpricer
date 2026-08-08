import sanitizeHtml from "sanitize-html";
import { proxiedImageSrc } from "./format";

const BASE_ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "ul", "ol", "li",
  "strong", "em", "code", "pre", "blockquote", "img", "br", "hr",
  "div", "span", "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "src", "alt", "title", "id", "class", "style", "target", "rel"];

// `style` is in ALLOWED_ATTR above, but sanitize-html only actually filters
// its *value* if allowedStyles is given — without it, the CSS filter is a
// documented no-op and any inline style="..." (including url()-based
// exfiltration/tracking) passes through untouched. This restricts inline
// styles to plain cosmetic/layout properties with value patterns that can
// never contain "url(" or similar.
const COLOR = "(#[0-9a-f]{3,8}|rgba?\\([\\d.,\\s%]+\\)|hsla?\\([\\d.,\\s%]+\\)|[a-z]+)";
const SAFE_COLOR = new RegExp(`^${COLOR}$`, "i");
const SAFE_LENGTH = /^-?\d*\.?\d+(px|em|rem|%|vw|vh)?$/i;
const SAFE_LENGTH_LIST = /^(-?\d*\.?\d+(px|em|rem|%)?\s*){1,4}$/i;
const SAFE_BORDER = new RegExp(`^\\d*\\.?\\d+(px|em)?\\s+(solid|dashed|dotted|double|none)\\s+${COLOR}$`, "i");
const ALLOWED_STYLES: Record<string, Record<string, RegExp[]>> = {
  "*": {
    color: [SAFE_COLOR],
    "background-color": [SAFE_COLOR],
    "font-size": [SAFE_LENGTH],
    "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
    "font-style": [/^(normal|italic|oblique)$/i],
    "text-align": [/^(left|right|center|justify)$/i],
    "text-decoration": [/^[a-z\s-]+$/i],
    "text-transform": [/^(none|capitalize|uppercase|lowercase)$/i],
    "line-height": [SAFE_LENGTH],
    "letter-spacing": [SAFE_LENGTH],
    margin: [SAFE_LENGTH_LIST],
    "margin-top": [SAFE_LENGTH], "margin-bottom": [SAFE_LENGTH], "margin-left": [SAFE_LENGTH], "margin-right": [SAFE_LENGTH],
    padding: [SAFE_LENGTH_LIST],
    "padding-top": [SAFE_LENGTH], "padding-bottom": [SAFE_LENGTH], "padding-left": [SAFE_LENGTH], "padding-right": [SAFE_LENGTH],
    border: [SAFE_BORDER],
    "border-color": [SAFE_COLOR],
    "border-radius": [SAFE_LENGTH],
    width: [SAFE_LENGTH],
    height: [SAFE_LENGTH],
    "max-width": [SAFE_LENGTH],
    display: [/^(block|inline|inline-block|flex|none|table|table-cell|table-row)$/i],
    "white-space": [/^(normal|nowrap|pre|pre-wrap|pre-line)$/i],
    "vertical-align": [/^[a-z-]+$/i],
  },
};

// sanitize-html's allowedTags/allowedStyles only govern tag and attribute
// *structure*. For an allowed <style> tag specifically (used for
// "html"-contentType posts, see below), the library hard-codes passing its
// raw text straight through — see its own index.js: "Allowing script tags
// is, by definition, game over for XSS protection... The same is essentially
// true for style tags" — it doesn't even invoke `textFilter` for them
// (verified: that early-return branch runs before the textFilter call).
// So this runs as a second pass over sanitizeHtml's OUTPUT below, the same
// way the table-wrap replace further down does — safe to do with a plain
// regex here because by this point <style>/</style> only appear as real
// tags, never inside unescaped text. Strips @import (fetches a remote
// stylesheet), url() (tracking pixels / exfiltration via attribute-selector
// CSS), and the old IE/Firefox script-equivalent CSS hooks.
const DANGEROUS_CSS = /@import\b[^;]*;?|url\s*\([^)]*\)|expression\s*\([^)]*\)|-moz-binding\s*:[^;]*;?|behaviou?r\s*:[^;]*;?/gi;
function stripDangerousCss(css: string): string {
  return css.replace(DANGEROUS_CSS, (match) => (match.toLowerCase().startsWith("url") ? "none" : ""));
}
function stripStyleTagContent(html: string): string {
  return html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open, css, close) => `${open}${stripDangerousCss(css)}${close}`);
}

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
    allowedStyles: ALLOWED_STYLES,
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
  return stripStyleTagContent(sanitized)
    .replace(/<table/g, '<div class="lp-blog-table-wrap"><table')
    .replace(/<\/table>/g, "</table></div>");
}

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

// Runs after tags are stripped from heading inner-HTML below — decodes the
// handful of entities TipTap/rich-text editors actually emit (ampersands,
// angle brackets, quotes, curly punctuation) so the TOC shows "Tips & Tricks"
// instead of the raw "Tips &amp; Tricks" markup source.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

function slugifyHeadingText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Runs after sanitizePostBody, on already-sanitized HTML: finds every h2/h3,
 * strips its inner tags to get plain text, and stamps on a unique slug id
 * (de-duped against repeat headings like "Conclusion"). Returns the patched
 * HTML alongside the flat heading list the TableOfContents component walks
 * to render real #anchor links — those are what let Google surface jump-to
 * links for the article in search results.
 */
export function injectHeadingIds(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const seen = new Map<string, number>();

  const patched = html.replace(/<(h[23])((?:\s[^>]*)?)>([\s\S]*?)<\/\1>/gi, (match, tag: string, attrs: string, inner: string) => {
    const level = (tag.toLowerCase() === "h2" ? 2 : 3) as 2 | 3;
    const text = decodeHtmlEntities(inner.replace(/<[^>]*>/g, "").trim());
    if (!text) return match;

    const base = slugifyHeadingText(text) || `section-${headings.length + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    headings.push({ id, text, level });

    const hasId = /\sid=/.test(attrs);
    const newAttrs = hasId ? attrs.replace(/\sid="[^"]*"/, ` id="${id}"`) : `${attrs} id="${id}"`;
    return `<${tag}${newAttrs}>${inner}</${tag}>`;
  });

  return { html: patched, headings };
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
