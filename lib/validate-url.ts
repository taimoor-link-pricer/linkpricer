// Shared URL validation for customer-supplied link targets.
//
// Neither of the obvious tools is strict enough on its own. `new URL()` treats
// http/https as "special schemes" and quietly repairs a missing slash, so the
// very common typo `https:google` parses successfully with hostname "google".
// Zod's `.url()` is looser still — it accepts `javascript:alert(1)` and
// `ftp://x.com`. Both were in use here, so a target URL that could never
// resolve (and, server-side, a `javascript:` URL) validated clean and reached
// the database.
//
// These are public pages a customer wants a backlink pointed at, so the bar is
// a real, routable, public hostname: http(s), a dot-separated name, and a
// plausible TLD. Bare hostnames and bare IPs are rejected — for this field
// they are always a mistake.

// A DNS label: alphanumeric, hyphens allowed inside but not at either end.
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
// A TLD: two or more letters, or a punycode IDN TLD (xn--p1ai, xn--fiqs8s…).
const TLD_RE = /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/;

export type UrlProblem = "missing-slashes" | "wrong-scheme" | "incomplete-domain" | "malformed";

export function urlProblem(raw: string): UrlProblem | null {
  const value = raw.trim();
  if (!value) return "malformed";

  // Must be caught before parsing: `new URL()` would accept it and report a
  // hostname, so by the time we could inspect the result the evidence is gone.
  if (/^https?:(?!\/\/)/i.test(value)) return "missing-slashes";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "malformed";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "wrong-scheme";

  // Already lowercased and punycoded by the parser. A single trailing dot is a
  // legitimate fully-qualified name, so drop it rather than failing on it.
  const host = parsed.hostname.replace(/\.$/, "");
  const labels = host.split(".");

  // No dot means a bare host — "localhost", an intranet name, or the repaired
  // remains of a typo. Not something a public backlink can point at.
  if (labels.length < 2) return "incomplete-domain";
  if (!labels.every((label) => LABEL_RE.test(label))) return "incomplete-domain";
  // Also rejects bare IPv4, whose last label is numeric.
  if (!TLD_RE.test(labels[labels.length - 1])) return "incomplete-domain";

  return null;
}

export function isValidLinkUrl(raw: string): boolean {
  return urlProblem(raw) === null;
}

// Written to read as a sentence after a field label, e.g.
// "Target URL is missing the // after https:".
export function urlProblemMessage(problem: UrlProblem): string {
  switch (problem) {
    case "missing-slashes":
      return "is missing the // after https: — write it like https://example.com/page";
    case "wrong-scheme":
      return "must start with https:// — write it like https://example.com/page";
    case "incomplete-domain":
      return "needs a complete website address, like https://example.com/page";
    case "malformed":
      return "isn't a valid URL — write it like https://example.com/page";
  }
}
