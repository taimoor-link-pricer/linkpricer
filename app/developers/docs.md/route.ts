import { buildDocsMarkdown } from "@/lib/public-api/docs-markdown";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildDocsMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}
