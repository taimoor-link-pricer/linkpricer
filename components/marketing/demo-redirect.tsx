"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMarketingAuth } from "@/lib/hooks/use-marketing-auth";

/**
 * Backstop for proxy.ts's demo gating.
 *
 * proxy.ts redirects signed-in users away from /compare and /related-sites at
 * the edge, keyed on the `session` cookie — which is a 5-day fuse, while the
 * Firebase session behind it effectively never expires (see the PROTECTED_PATHS
 * comment in that file). So anyone returning after five days is still genuinely
 * signed in but arrives with no cookie, sails past the edge check and lands in
 * a demo full of fixture data. That is exactly the "why is the app showing me
 * fake results" confusion this whole change exists to kill, so it needs a
 * second check that reads the live Firebase state rather than the cookie.
 *
 * Renders nothing. `replace`, not `push`, so Back doesn't bounce them straight
 * back into the demo they were just pulled out of.
 */
export function DemoRedirect({ to }: { to: string }) {
  const { signedIn } = useMarketingAuth();
  const router = useRouter();

  useEffect(() => {
    if (signedIn) router.replace(to);
  }, [signedIn, to, router]);

  return null;
}
