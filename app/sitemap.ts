import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog/queries";
import { toDate } from "@/lib/blog/format";

const BASE_URL = "https://linkpricer.com";

// Static marketing routes ported from linkpricer-old/server/routes/sitemap.routes.ts,
// trimmed to routes that actually exist in this app today (old app listed a
// few — /terms, /privacy, /dpa, /marketplaces — that haven't been built here yet).
const STATIC_ROUTES = ["", "/about", "/contact", "/docs", "/developers", "/blog", "/login", "/signup"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    changeFrequency: "daily",
    priority: route === "" ? 1.0 : 0.8,
  }));

  const posts = await getPublishedPosts();
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: toDate(post.updatedAt ?? post.publishedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...postEntries];
}
