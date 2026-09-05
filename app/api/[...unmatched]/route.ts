import { NextResponse } from "next/server";

/**
 * JSON 404 for any /api path that matches no real route.
 *
 * Without this, an unmatched API URL fell through to the app's HTML 404 page,
 * so a client doing `JSON.parse(await res.text())` got a document starting with
 * "<!DOCTYPE html>" and threw — an exception in the caller's code rather than
 * the documented error envelope they can branch on.
 *
 * It is easier to hit than it looks. A path segment of "." or ".." is collapsed
 * by the client or the CDN before it ever reaches us, so
 * /api/v1/public/domains/../pricing arrives as /api/v1/public/domains/pricing,
 * which is one segment short of the real route and matches nothing. Someone
 * building a URL by string concatenation with an empty or relative variable in
 * it lands here, and the whole point of this endpoint's error contract is that
 * a caller never has to special-case the transport.
 *
 * Next resolves static and dynamic segments ahead of catch-alls, so this only
 * runs when no genuine route matched.
 */
function notFound() {
  return NextResponse.json(
    {
      error: "not_found",
      message: "No API endpoint matches this URL. Check the path against the documentation.",
      status: 404,
    },
    { status: 404, headers: { "Cache-Control": "private, no-store" } }
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
