// Reads the x-api-key header and a request body on every call, so this is
// request-time work by construction — declared explicitly.
export const dynamic = "force-dynamic";
// A search is one pass over the catalogue plus one pricing round trip,
// normally 1 to 4 seconds; give it room rather than letting a slow moment on
// the database surface as a platform timeout.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { handleSearchRequest } from "@/lib/public-api/search-handler";

/**
 * The public search endpoint: filters in, up to 50 matching domains out, each
 * with the pricing endpoint's own per-domain body. Quota is metered per
 * domain returned. See lib/public-api/search.ts for the request and response
 * shape, pinned by lib/public-api/search.test.ts.
 */
export async function POST(req: NextRequest) {
  return handleSearchRequest(req);
}

// Anything but POST gets the documented JSON error envelope rather than an
// empty 405, so a client that sent GET by mistake is told what to do.
function methodNotAllowed() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: 'Use POST with a JSON body: { "filters": { "min_dr": 40, "country": ["US"] }, "niche": "gambling" }.',
      status: 405,
    },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "private, no-store" } }
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
