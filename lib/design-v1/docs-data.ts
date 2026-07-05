// Linkpricer Docs — content registry, ported verbatim from the design
// handoff's docs/docs-data.js. All article body copy is placeholder text
// (per the source file's own comment) pending real documentation.

export type DocIconName =
  | "rocket"
  | "compare"
  | "related"
  | "star"
  | "orders"
  | "settings"
  | "support";

export interface DocSection {
  id: string;
  label: string;
  alt?: string;
  icon: DocIconName;
  blurb: string;
}

export interface DocArticle {
  slug: string;
  section: string;
  title: string;
  desc: string;
  read: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    label: "Getting started",
    icon: "rocket",
    blurb:
      "Create your account, run your first search, and understand how Linkpricer pulls every marketplace into one view.",
  },
  {
    id: "domain-comparison",
    label: "Domain comparison",
    alt: "Domain Analyse",
    icon: "compare",
    blurb:
      "Paste a list of domains and compare live prices, authority metrics and the best available deal across vendors.",
  },
  {
    id: "related-sites",
    label: "Related sites",
    icon: "related",
    blurb:
      "Discover topically relevant domains you haven't considered, ranked by relevance and price-per-authority.",
  },
  {
    id: "favorites",
    label: "Favorites",
    icon: "star",
    blurb:
      "Save domains to lists, track price changes, and keep shortlists organised for each campaign or client.",
  },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    blurb: "Place orders, track placement status, manage briefs and anchors, and pay only after publication.",
  },
  {
    id: "settings-billing",
    label: "Settings & billing",
    icon: "settings",
    blurb: "Manage your profile, team seats, invoices, payment methods and notification preferences.",
  },
  {
    id: "support",
    label: "Support",
    icon: "support",
    blurb: "Reach the team, open a ticket, and find answers to the questions we hear most often.",
  },
];

export const DOC_ARTICLES: DocArticle[] = [
  // ---- getting started ----
  { slug: "what-is-linkpricer", section: "getting-started", title: "What is Linkpricer?", desc: "A 2-minute overview of how the marketplace aggregator works.", read: "2 min" },
  { slug: "create-your-account", section: "getting-started", title: "Create your account", desc: "Sign up, verify your email, and set up your workspace.", read: "3 min" },
  { slug: "your-first-search", section: "getting-started", title: "Run your first search", desc: "Paste domains, read the results table, and find the best deal.", read: "4 min" },
  { slug: "understanding-metrics", section: "getting-started", title: "Understanding the metrics", desc: "DR, traffic, price-per-authority and how we normalise vendors.", read: "5 min" },

  // ---- domain comparison ----
  { slug: "comparing-domains", section: "domain-comparison", title: "Comparing domains side by side", desc: "How the comparison table is built and what each column means.", read: "5 min" },
  { slug: "best-deal-logic", section: "domain-comparison", title: "How 'best deal' is calculated", desc: "The logic behind the highlighted lowest price per domain.", read: "3 min" },
  { slug: "filtering-sorting", section: "domain-comparison", title: "Filtering & sorting results", desc: "Narrow by DR, price, language, traffic and marketplace.", read: "4 min" },
  { slug: "bulk-input", section: "domain-comparison", title: "Bulk domain input", desc: "Paste hundreds of domains at once and price them in one pass.", read: "3 min" },

  // ---- related sites ----
  { slug: "finding-related-sites", section: "related-sites", title: "Finding related sites", desc: "Surface topically relevant domains beyond your shortlist.", read: "4 min" },
  { slug: "relevance-scoring", section: "related-sites", title: "How relevance is scored", desc: "What signals drive the relevance ranking and how to read it.", read: "3 min" },

  // ---- favorites ----
  { slug: "saving-favorites", section: "favorites", title: "Saving domains to Favorites", desc: "Build and organise shortlists for each campaign or client.", read: "2 min" },
  { slug: "price-alerts", section: "favorites", title: "Price-change tracking", desc: "Watch saved domains and get notified when prices move.", read: "3 min" },

  // ---- orders ----
  { slug: "placing-an-order", section: "orders", title: "Placing an order", desc: "From shortlist to checkout: briefs, anchors and confirmation.", read: "5 min" },
  { slug: "tracking-status", section: "orders", title: "Tracking placement status", desc: "What each order status means and typical turnaround times.", read: "4 min" },
  { slug: "briefs-and-anchors", section: "orders", title: "Managing briefs & anchor text", desc: "Provide instructions and anchors that publishers can action.", read: "4 min" },
  { slug: "pay-after-publication", section: "orders", title: "Pay-after-publication", desc: "How and when you're charged, and what happens if a link drops.", read: "3 min" },

  // ---- settings & billing ----
  { slug: "profile-team", section: "settings-billing", title: "Profile & team seats", desc: "Manage your details and invite teammates to your workspace.", read: "3 min" },
  { slug: "invoices-payment", section: "settings-billing", title: "Invoices & payment methods", desc: "Download invoices and manage cards or other payment methods.", read: "3 min" },
  { slug: "notifications", section: "settings-billing", title: "Notification preferences", desc: "Choose which emails and in-app alerts you receive.", read: "2 min" },

  // ---- support ----
  { slug: "contact-support", section: "support", title: "Contacting support", desc: "Ways to reach us and what to include for a fast response.", read: "2 min" },
  { slug: "faq", section: "support", title: "Frequently asked questions", desc: "Quick answers to the questions we hear most often.", read: "6 min" },
];

export function docSectionById(id: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.id === id);
}

export function docArticleBySlug(slug: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.slug === slug);
}

export function docArticlesInSection(sectionId: string): DocArticle[] {
  return DOC_ARTICLES.filter((a) => a.section === sectionId);
}

// First article in a section — used when a "Browse" card links straight
// into a section (mirrors the source's `article.html?section=id` fallback).
export function docFirstArticleInSection(sectionId: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.section === sectionId);
}

export interface DocSearchResult {
  article: DocArticle;
  section: DocSection;
  score: number;
}

export function docSearch(query: string): DocSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DOC_ARTICLES.map((a) => {
    const section = docSectionById(a.section) ?? { id: "", label: "", icon: "rocket" as DocIconName, blurb: "" };
    const hay = `${a.title} ${a.desc} ${section.label}`.toLowerCase();
    let score = -1;
    if (a.title.toLowerCase().indexOf(q) === 0) score = 100;
    else if (a.title.toLowerCase().includes(q)) score = 60;
    else if (section.label.toLowerCase().includes(q)) score = 40;
    else if (hay.includes(q)) score = 20;
    return { article: a, section, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
