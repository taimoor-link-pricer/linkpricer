import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";

// Nothing has ever rendered at /dashboard — the app's real landing page is
// Analyze — so this used to serve a blank screen, which is where proxy.ts's
// "already signed in, bounce them off /login" branch sent people.
//
// In practice this never runs: next.config.ts already redirects /dashboard at
// step 2 of Next's routing order, which is ahead of both proxy.ts (step 3) and
// page rendering (step 5). That config entry, not this file, is why proxy never
// logs /dashboard — and it fires auth-blind, returning the same 307 signed in
// or out. Kept as the fallback for if that entry is ever removed, since without
// a page here /dashboard would 404 rather than land somewhere useful.
//
// Signed out, the chain still ends at /login: /dashboard forwards to
// /dashboard/search, which *is* a protected path proxy sees and gates.
export default function DashboardPage() {
  redirect(ROUTES.search);
}
