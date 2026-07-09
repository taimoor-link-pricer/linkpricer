export interface BlogPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryLabel: string;
  categorySlug: string;
  author: string;
  authorTitle: string | null;
  coverImageUrl: string | null;
  publishedAt: string;
  updatedAt: string | null;
  readTime: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  contentType: string;
  content: string;
  htmlContent: string | null;
  authorBio: string | null;
  authorTwitterUrl: string | null;
  authorLinkedinUrl: string | null;
  authorWebsiteUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}
