// Reads the x-api-key header and a request body on every call, so this is
// request-time work by construction — declared explicitly, matching v1.
export const dynamic = "force-dynamic";
// A 200-domain batch is one catalogue query, normally well under a second,
// but it is the heaviest thing a key can ask for; give it room rather than
// letting a slow moment on the database surface as a platform timeout.
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { handleBatchPricingRequest } from "@/lib/public-api/batch-handler";

/**
 * The batch pricing endpoint: up to 200 domains per call, each answered with
 * the same per-domain body GET /api/v1/public/domains/{domain}/pricing
 * returns. Quota is metered per domain found. See lib/public-api/batch.ts for
 * the request and response shape, pinned by lib/public-api/batch.test.ts.
 */
export async function POST(req: NextRequest) {
  return handleBatchPricingRequest(req);
}

// Anything but POST gets the documented JSON error envelope rather than an
// empty 405, so a client that sent GET by mistake is told what to do.
function methodNotAllowed() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: 'Use POST with a JSON body: { "domains": ["example.com", ...], "niche": "gambling" }.',
      status: 405,
    },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "private, no-store" } }
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
