// Linkpricer Blog — content registry, ported verbatim from the design
// handoff's blog/blog-data.js.
//
// Content note: only two articles have real, fully-written bodies in the
// design handoff (blog/article.html and blog/comparison.html) — every other
// entry below points to one of those same two templates in the static
// mockup (i.e. the prototype itself reuses one example body per template
// type; it does not contain nine distinct articles). To avoid inventing
// copy Karolis never wrote, the two real bodies are rendered verbatim under
// their own slugs; every other slug renders an honest placeholder body
// (see components/blog/generic-article-body.tsx) until real copy exists.

export type BlogCategorySlug = "case-studies" | "comparisons" | "guides" | "playbooks";

export interface BlogCategory {
  slug: BlogCategorySlug;
  label: string;
}

export type BlogTemplate = "standard" | "comparison";

export interface BlogArticle {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategorySlug;
  author: string;
  date: string; // ISO yyyy-mm-dd
  read: string;
  template: BlogTemplate;
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  { slug: "case-studies", label: "Case Studies" },
  { slug: "comparisons", label: "Comparisons" },
  { slug: "guides", label: "Guides" },
  { slug: "playbooks", label: "Playbooks" },
];

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "how-to-build-backlinks-for-saas-products",
    title: "How to Build Backlinks for SaaS Products in 2026",
    excerpt: "A repeatable, budget-aware framework for earning and buying links that actually move SaaS rankings — without torching your domain.",
    category: "guides",
    author: "Karolis Butkus",
    date: "2026-06-10",
    read: "11 min read",
    template: "standard",
  },
  {
    slug: "linkpricer-vs-traditional-agencies",
    title: "Linkpricer vs. Traditional Link-Building Agencies",
    excerpt: "Marketplace transparency or full-service done-for-you? A criteria-by-criteria look at cost, speed, control and risk.",
    category: "comparisons",
    author: "Mara Devlin",
    date: "2026-06-04",
    read: "9 min read",
    template: "comparison",
  },
  {
    slug: "fintech-startup-3x-organic-traffic",
    title: "How a Fintech Startup 3×'d Organic Traffic in Two Quarters",
    excerpt: "We rebuilt one company's backlink mix around price-per-authority. Here's the data, the spend, and what we'd do differently.",
    category: "case-studies",
    author: "Devon Ray",
    date: "2026-05-28",
    read: "8 min read",
    template: "standard",
  },
  {
    slug: "what-is-a-fair-price-for-a-backlink",
    title: "What Is a Fair Price for a Backlink? A Benchmark Study",
    excerpt: "We pulled list prices across 28 marketplaces and normalised them against domain authority. The spread will surprise you.",
    category: "guides",
    author: "Karolis Butkus",
    date: "2026-05-21",
    read: "13 min read",
    template: "standard",
  },
  {
    slug: "guest-post-vs-niche-edit",
    title: "Guest Post vs. Niche Edit: Which Link Type Wins?",
    excerpt: "Two of the most-bought link products compared on speed, durability, cost and ranking impact.",
    category: "comparisons",
    author: "Mara Devlin",
    date: "2026-05-14",
    read: "7 min read",
    template: "comparison",
  },
  {
    slug: "ecommerce-link-velocity-playbook",
    title: "The E-commerce Link Velocity Playbook",
    excerpt: "How to sequence link purchases across a product launch so growth looks natural to search engines.",
    category: "playbooks",
    author: "Devon Ray",
    date: "2026-05-07",
    read: "10 min read",
    template: "standard",
  },
  {
    slug: "marketplace-arbitrage-case-study",
    title: "Marketplace Arbitrage: Saving 41% on the Same Placements",
    excerpt: "The exact same domains are listed at wildly different prices across vendors. Here's how one agency exploited that gap.",
    category: "case-studies",
    author: "Devon Ray",
    date: "2026-04-29",
    read: "6 min read",
    template: "standard",
  },
  {
    slug: "anchor-text-distribution-guide",
    title: "Anchor Text Distribution: A Practical Guide",
    excerpt: "Exact-match, partial, branded, naked URL — the ratios that keep a profile safe while still pushing target terms.",
    category: "guides",
    author: "Karolis Butkus",
    date: "2026-04-22",
    read: "9 min read",
    template: "standard",
  },
  {
    slug: "outreach-vs-marketplace-playbook",
    title: "Cold Outreach vs. Marketplaces: A Hybrid Playbook",
    excerpt: "When to grind for editorial links and when to just buy the placement — and how to blend both in one campaign.",
    category: "playbooks",
    author: "Mara Devlin",
    date: "2026-04-15",
    read: "12 min read",
    template: "standard",
  },
];

export function blogCategoryLabel(slug: string): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function blogArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function blogArticlesSorted(): BlogArticle[] {
  return [...BLOG_ARTICLES].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function blogInitials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function blogFormatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
