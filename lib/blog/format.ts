export function blogInitials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const PROXIED_HOSTS = new Set(["lh3.googleusercontent.com", "storage.googleapis.com"]);

// Routes images from hosts known to block cross-origin <img> embeds through
// our own /api/blog/image proxy (see that route for why). Leaves anything
// else (e.g. a future direct-hosted CDN) untouched.
export function proxiedImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (PROXIED_HOSTS.has(url.hostname)) {
      return `/api/blog/image?src=${encodeURIComponent(src)}`;
    }
  } catch {
    return null;
  }
  return src;
}

// Postgres `timestamp` columns (mode: 'string') come back as
// "YYYY-MM-DD HH:mm:ss.sss" — space-separated, not strict ISO 8601.
// `new Date(...)` parses that leniently in V8 but isn't guaranteed
// elsewhere, so normalize before handing it to Date.
export function toDate(timestamp: string): Date {
  const normalized = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T");
  return new Date(normalized);
}

export function blogFormatDate(timestamp: string): string {
  return toDate(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Real post titles/excerpts vary a lot in length — an uncapped title can
// wrap to more lines than its neighbors in a card grid, pushing that card's
// excerpt/meta row down and breaking row alignment. Truncate to a fixed
// budget so every card in a row starts its excerpt at the same line.
export function truncate(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "..";
}
