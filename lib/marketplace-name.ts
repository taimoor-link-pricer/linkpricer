const SUBDOMAIN_PREFIXES = ["app", "portal", "panel", "cp", "crm", "www", "dashboard", "newcp", "tool", "market", "en", "pr"];
const TLD_SUFFIX_RE = /\.(com|net|org|io|fr|eu|biz|link|market|co|pro|club)$/i;

// Casing/branding facts a generic hostname-stripping algorithm can't infer.
const OVERRIDES: Record<string, string> = {
  "meup.com": "MeUp",
};

export function prettyMarketplaceName(raw: string): string {
  // Vendor-sourced offers are labeled "Vendor: <business name>" everywhere
  // (lib/orders/pricing.ts, catalog-search.ts, /api/analyze) — never a
  // scraped hostname. Guard here (not just at call sites that happen to
  // have an offerType handy) so this function is safe to call unconditionally,
  // including from pages like orders/ that don't carry an offerType field.
  if (raw.startsWith("Vendor: ")) return raw;

  const key = raw.trim().toLowerCase();
  if (OVERRIDES[key]) return OVERRIDES[key];

  let core = key;
  let stripped = false;

  const parts = core.split(".");
  if (parts.length > 2 && SUBDOMAIN_PREFIXES.includes(parts[0])) {
    core = parts.slice(1).join(".");
    stripped = true;
  }

  if (TLD_SUFFIX_RE.test(core)) {
    core = core.replace(TLD_SUFFIX_RE, "");
    stripped = true;
  }

  // Nothing recognizable to strip — don't guess, show the raw value as-is.
  if (!stripped) return raw;

  return core
    .split(/[.\-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
