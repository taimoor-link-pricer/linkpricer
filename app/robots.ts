import type { MetadataRoute } from "next";

// TEMPORARY pre-launch lockdown: block every crawler (including Googlebot)
// while the site isn't ready to be public yet. Paired with the site-wide
// noindex in app/layout.tsx. When Karolis confirms we're ready to go live,
// restore the real policy below (kept here, commented out, for a one-line
// revert) — ported verbatim from linkpricer-old/client/public/robots.txt,
// same deliberate AI-bot split (allow citation bots, block training
// crawlers).
export default function robots(): MetadataRoute.Robots {
  return {
    // The one exception: the API reference. Trial partners integrate by
    // pointing an AI assistant at it, and those fetchers obey robots.txt.
    // Crawlable is not indexable: the site-wide noindex in app/layout.tsx still
    // covers the page, and its markdown copy sends X-Robots-Tag: noindex.
    rules: [{ userAgent: "*", allow: "/developers/docs", disallow: "/" }],
    sitemap: "https://linkpricer.com/sitemap.xml",
  };
}

// --- restore this policy when ready to go public ---
// export default function robots(): MetadataRoute.Robots {
//   return {
//     rules: [
//       {
//         userAgent: "*",
//         allow: ["/blog/"],
//         disallow: ["/admin/", "/api/", "/dashboard/"],
//       },
//       { userAgent: "OAI-SearchBot", allow: "/" },
//       { userAgent: "Claude-SearchBot", allow: "/" },
//       { userAgent: "PerplexityBot", allow: "/" },
//       { userAgent: "GPTBot", disallow: "/" },
//       { userAgent: "ClaudeBot", disallow: "/" },
//       { userAgent: "CCBot", disallow: "/" },
//       { userAgent: "anthropic-ai", disallow: "/" },
//       { userAgent: "Google-Extended", disallow: "/" },
//     ],
//     sitemap: "https://linkpricer.com/sitemap.xml",
//   };
// }
