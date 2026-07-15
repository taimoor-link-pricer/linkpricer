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
    rules: [{ userAgent: "*", disallow: "/" }],
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
