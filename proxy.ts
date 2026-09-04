import { NextRequest, NextResponse } from "next/server";
// Proxy can be deployed to the CDN separately from the render code, and the
// docs warn against relying on shared modules here. lib/constants.ts is safe
// to import in spite of that: it has no imports of its own and holds nothing
// but frozen literals, so it inlines into the edge bundle and carries no
// runtime state that could differ between the two environments. Duplicating
// these paths instead would be the bigger risk — the nav in site-header.tsx
// has to agree with this file exactly.
import { DEMO_TO_APP, ROUTES } from "@/lib/constants";

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
    // ROUTES.search, not ROUTES.dashboard — /dashboard renders nothing, so
    // this used to drop everyone who hit /login while already signed in onto
    // a blank page.
    url.pathname = ROUTES.search;
    return NextResponse.redirect(url);
  }

  // Signed-in users never see a demo page. /compare and /related-sites run on
  // hardcoded fixtures (lib/design-v1/sample-data.ts, related-data.ts), so
  // there is nothing to "upgrade" them to in place — the real tool is a
  // different route. Redirecting at the edge means no flash of demo content.
  //
  // The inverse of the PROTECTED_PATHS caveat above applies: a *missing*
  // cookie doesn't prove the user is signed out, so this can't be the only
  // check. The two demo page bodies repeat it once Firebase resolves.
  const appEquivalent = DEMO_TO_APP[pathname];
  if (appEquivalent && session) {
    const url = req.nextUrl.clone();
    url.pathname = appEquivalent;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
};
