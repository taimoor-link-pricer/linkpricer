/**
 * The signed-in user on the OAuth pages, from the same `session` cookie the
 * rest of the app uses. Null when there is no cookie or it no longer verifies —
 * either way the user is sent through /login, which re-mints a lapsed cookie
 * from a live Firebase sign-in before forwarding them back.
 */

import { adminAuth } from "@/lib/firebase/admin";

export async function sessionUser(cookie: string | undefined): Promise<{ uid: string; email: string | null } | null> {
  if (!cookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

/** This deployment's origin as the browser sees it, for pages that have no NextRequest. */
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
