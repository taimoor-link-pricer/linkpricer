import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/onboarding"];
const AUTH_ONLY_PATHS = ["/login", "/signup"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("session")?.value;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected && !session) {
    // A missing cookie here does not mean the user is signed out. The cookie is
    // a 5-day fuse while the Firebase session behind it effectively never
    // expires, so this fires routinely for anyone returning after a few days —
    // and because it happens at the edge, no client code gets a chance to
    // repair it. Carry the intent through so /login can re-mint the session
    // from the live Firebase user and forward them on, instead of making
    // someone who never actually logged out type their password again.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("session", "expired");
    url.searchParams.set("redirect", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
