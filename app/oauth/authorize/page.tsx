import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkAuthorizeRequest, MCP_PATH, oauthSecret, redirectWith } from "@/lib/mcp/oauth";
import { activeKeyHashFor } from "@/lib/mcp/auth";
import { originFromHeaders, sessionUser } from "@/lib/mcp/session";

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false, follow: false },
};

/**
 * Where an AI app sends the user to connect LinkPricer (OAuth authorize step).
 *
 * Signed out, the user goes through the normal /login (or /signup, which
 * /login links to with the same return path) and comes straight back here.
 * Signed in, they see who is asking and click Allow, which posts to
 * /api/oauth/authorize and sends them back to the app.
 *
 * The Allow step stays even though the user just logged in: anyone can
 * register an app under any name, so the page names the address the
 * connection would be sent to, and nothing is handed over without a click.
 *
 * Styled like the login card rather than designed — to be replaced when there
 * is a design for it.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const origin = originFromHeaders(await headers());
  const secret = oauthSecret();
  if (!secret) return <Card title="Not available">Connecting apps is not available right now.</Card>;

  const check = checkAuthorizeRequest(secret, params, origin + MCP_PATH);
  if (!check.ok) {
    if (!check.redirect) return <Card title="Can't connect this app">{check.message}</Card>;
    redirect(redirectWith(check.redirect_uri, { error: check.error, error_description: check.description, state: check.state }));
  }
  const req = check.req;

  const user = await sessionUser((await cookies()).get("session")?.value);
  if (!user) {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
    );
    redirect(`/login?redirect=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const hasKey = (await activeKeyHashFor(user.uid)) != null;
  const host = new URL(req.redirect_uri).host;

  return (
    <Card title={`Connect ${req.client.name} to LinkPricer`}>
      <p style={{ margin: "0 0 12px" }}>
        <strong>{req.client.name}</strong> wants to look up link prices and search sites with your LinkPricer
        account. Each site it looks up counts toward your API plan&apos;s monthly lookups.
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
        You will be returned to <strong style={{ color: "#111827" }}>{host}</strong>. Only allow this if you
        started connecting from that app.
      </p>
      {!hasKey && (
        <p style={{ margin: "0 0 12px", padding: "10px 12px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, fontSize: 13 }}>
          Your account has no API key yet. You can connect now; prices will work once you create a key on the{" "}
          <a href="/developers" style={{ color: "#0052cc", fontWeight: 600 }}>Developers page</a>.
        </p>
      )}
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>Signed in as {user.email ?? "your account"}</p>
      <form method="post" action="/api/oauth/authorize" style={{ display: "flex", gap: 12 }}>
        <input type="hidden" name="response_type" value="code" />
        <input type="hidden" name="client_id" value={req.client_id} />
        <input type="hidden" name="redirect_uri" value={req.redirect_uri} />
        <input type="hidden" name="code_challenge" value={req.code_challenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        {req.state != null && <input type="hidden" name="state" value={req.state} />}
        {req.resource != null && <input type="hidden" name="resource" value={req.resource} />}
        <button type="submit" name="decision" value="deny" style={buttonStyle(false)}>Cancel</button>
        <button type="submit" name="decision" value="allow" style={buttonStyle(true)}>Allow</button>
      </form>
    </Card>
  );
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    flex: 1,
    height: 44,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    border: primary ? "none" : "1px solid #d1d5db",
    background: primary ? "#0052cc" : "#fff",
    color: primary ? "#fff" : "#111827",
  };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ margin: 0, padding: 16, background: "#eff0f3", fontFamily: "Inter, -apple-system, system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", color: "#111827", fontSize: 15, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0052cc", marginBottom: 16 }}>LinkPricer</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>{title}</h1>
        {children}
      </div>
    </main>
  );
}
