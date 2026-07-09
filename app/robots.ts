import type { MetadataRoute } from "next";

// Policy ported verbatim from linkpricer-old/client/public/robots.txt —
// same crawl rules and the same deliberate AI-bot split (allow citation
// bots, block training crawlers), just expressed via Next's native
// robots.ts convention instead of a static file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/blog/"],
        disallow: ["/admin/", "/api/", "/dashboard/"],
      },
      { userAgent: "OAI-SearchBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "ClaudeBot", disallow: "/" },
      { userAgent: "CCBot", disallow: "/" },
      { userAgent: "anthropic-ai", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
    ],
    sitemap: "https://linkpricer.com/sitemap.xml",
  };
}
