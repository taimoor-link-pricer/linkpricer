export const APP_NAME = "Linkpricer";
export const APP_TAGLINE = "The Analytical Architect.";
export const APP_DESCRIPTION =
  "Welcome back to the platform for advanced SEO architects. Your blueprint for digital authority awaits.";

export const SOCIAL_PROOF_COUNT = "2,000+";
export const SOCIAL_PROOF_LABEL = "SEO Strategists";

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  search: "/dashboard/search",
  orders: "/dashboard/orders",
  favorites: "/dashboard/favorites",
  monitors: "/dashboard/monitors",
  settings: "/dashboard/settings",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminOrders: "/admin/orders",
  adminBlog: "/admin/blog",
  adminBlogAuthors: "/admin/blog/authors",
  checkout: "/dashboard/checkout",
} as const;

export const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Help Center", href: "/help" },
] as const;

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Features", href: "/features" },
  { label: "Marketplace", href: "/marketplace" },
] as const;

export const FOOTER_LINKS = {
  product: [
    { label: "Features", href: "/features" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "Pricing", href: "/pricing" },
    { label: "Integrations", href: "/integrations" },
  ],
  resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Support", href: "/support" },
    { label: "API Status", href: "/status" },
    { label: "Community", href: "/community" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
} as const;
