export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkAuthorizeRequest, issueCode, MCP_PATH, oauthSecret, redirectWith } from "@/lib/mcp/oauth";
import { sessionUser } from "@/lib/mcp/session";

/**
 * The Allow / Cancel buttons on /oauth/authorize post here. Everything the
 * page checked is checked again — the form fields came back from the browser
 * and are not trusted for having passed through our page — and the user must
 * still be signed in. The session cookie is SameSite=Lax, so a form posted
 * from another site arrives without it; the Origin check is a second lock on
 * the same door.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const secret = oauthSecret();
  if (!secret) return new NextResponse("OAuth is not configured.", { status: 503 });

  const sentFrom = req.headers.get("origin");
  if (sentFrom && sentFrom !== origin) return new NextResponse("Forbidden", { status: 403 });

  const form = Object.fromEntries(await req.formData());
  const check = checkAuthorizeRequest(secret, form, origin + MCP_PATH);
  if (!check.ok) {
    if (!check.redirect) return new NextResponse(check.message, { status: 400 });
    return NextResponse.redirect(
      redirectWith(check.redirect_uri, { error: check.error, error_description: check.description, state: check.state }),
      303
    );
  }
  const { req: authz } = check;

  if (form.decision !== "allow") {
    return NextResponse.redirect(
      redirectWith(authz.redirect_uri, { error: "access_denied", error_description: "The user did not allow access.", state: authz.state }),
      303
    );
  }

  const user = await sessionUser(req.cookies.get("session")?.value);
  if (!user) {
    // Signed out between seeing the page and clicking: back through login to the same request.
    const back = new URLSearchParams(
      Object.entries(form).filter(([k, v]) => k !== "decision" && typeof v === "string") as [string, string][]
    );
    const login = new URL("/login", origin);
    login.searchParams.set("redirect", `/oauth/authorize?${back}`);
    return NextResponse.redirect(login, 303);
  }

  return NextResponse.redirect(
    redirectWith(authz.redirect_uri, { code: issueCode(secret, user.uid, authz), state: authz.state, iss: origin }),
    303
  );
}
