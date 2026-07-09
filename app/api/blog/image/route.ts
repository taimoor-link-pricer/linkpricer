import { NextRequest, NextResponse } from "next/server";

// lh3.googleusercontent.com (legacy migrated cover/inline images) serves a
// valid image to a direct server-side request but appears to refuse the
// same URL when the browser embeds it as a cross-origin <img> — confirmed
// via curl (returns image/png + permissive CORS) vs. a real browser <img>
// (fails, net::ERR_BLOCKED_BY_ORB). Proxying through our own origin sidesteps
// whatever hotlink/embed check Google applies to third-party page embeds.
const ALLOWED_HOSTS = new Set(["lh3.googleusercontent.com", "storage.googleapis.com"]);

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new NextResponse("Missing src", { status: 400 });

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return new NextResponse("Invalid src", { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("Host not allowed", { status: 400 });
  }

  const upstream = await fetch(url.toString());
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Upstream error", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
