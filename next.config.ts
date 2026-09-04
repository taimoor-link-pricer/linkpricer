import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These run at step 2 of Next's routing order — before proxy.ts (step 3) and
  // before any page renders (step 5). Anything matched here never reaches the
  // proxy, so auth-dependent rules must NOT live in this file: these fire
  // identically for signed-in and signed-out visitors.
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/search",
        permanent: false,
      },
      {
        // /marketing-login was a second copy of the login page, added in
        // a5b95ad and never linked from anywhere — no reference to it exists
        // in the repo. Because its path was neither /login nor /signup, it
        // fell outside proxy.ts's AUTH_ONLY_PATHS, making it the one auth
        // surface that still showed a login form to someone already logged
        // in: the same "am I signed in or not?" confusion the demo/app split
        // was built to end.
        //
        // Redirecting beats deleting outright — the URL keeps working for any
        // external link the repo can't see (an email campaign, an ad) — and
        // beats adding it to AUTH_ONLY_PATHS, which would have fixed only the
        // signed-in case while leaving a duplicate login page to maintain.
        // Routing it through /login inherits that page's behaviour for good:
        // the signed-in bounce, the ?redirect= carry, the expired-session
        // re-mint, and the metadata this page never had.
        source: "/marketing-login",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
