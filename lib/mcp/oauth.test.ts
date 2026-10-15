/**
 * The OAuth flow, pinned end to end without a server: register → authorize →
 * code → tokens → refresh → MCP call, plus every way a forged, stale or
 * misdirected value must be turned away.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import {
  checkAuthorizeRequest,
  exchangeToken,
  isAllowedRedirectUri,
  issueClientId,
  issueCode,
  parseRegistration,
  readAccessToken,
  readClient,
  seal,
  unseal,
  type AuthorizeRequest,
} from "@/lib/mcp/oauth";

const SECRET = "s".repeat(40);
const OTHER_SECRET = "o".repeat(40);
const AUD = "https://www.linkpricer.ai/api/mcp";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "v".repeat(43) + "-._~abc";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);

function register(uris = [REDIRECT]) {
  const reg = parseRegistration({ client_name: "Claude", redirect_uris: uris, token_endpoint_auth_method: "none" });
  if (!reg.ok) throw new Error(reg.message);
  return issueClientId(SECRET, reg.client, T0);
}

function authorize(clientId: string, extra: Record<string, string> = {}) {
  const check = checkAuthorizeRequest(
    SECRET,
    {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
      state: "xyz",
      resource: AUD,
      ...extra,
    },
    AUD
  );
  return check;
}

function codeFor(clientId: string, userId = "user-1"): string {
  const check = authorize(clientId);
  if (!check.ok) throw new Error("authorize failed");
  return issueCode(SECRET, userId, check.req as AuthorizeRequest, T0);
}

describe("sealed values", () => {
  it("round-trip, and refuse a different kind, secret or a tampered payload", () => {
    const v = seal(SECRET, "access", { sub: "u" });
    expect(unseal(SECRET, "access", v)).toEqual({ sub: "u" });
    expect(unseal(SECRET, "refresh", v)).toBeNull();
    expect(unseal(OTHER_SECRET, "access", v)).toBeNull();
    const [head, sig] = v.split(".");
    const forged = head.slice(0, -2) + (head.endsWith("A") ? "B" : "A") + head.slice(-1) + "." + sig;
    expect(unseal(SECRET, "access", forged)).toBeNull();
    expect(unseal(SECRET, "access", v + ".x")).toBeNull();
  });

  it("expire", () => {
    const v = seal(SECRET, "access", { sub: "u", exp: T0 / 1000 + 10 });
    expect(unseal(SECRET, "access", v, T0)).not.toBeNull();
    expect(unseal(SECRET, "access", v, T0 + 10_000)).toBeNull();
  });
});

describe("registration", () => {
  it("accepts https and loopback http, nothing else", () => {
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:53682/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:8080/cb")).toBe(true);
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://a.example/cb#frag")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("https://user:pw@a.example/")).toBe(false);
  });

  it("rejects bad requests and confidential clients", () => {
    expect(parseRegistration({}).ok).toBe(false);
    expect(parseRegistration({ redirect_uris: ["http://evil.example/cb"] }).ok).toBe(false);
    expect(parseRegistration({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" }).ok).toBe(false);
  });

  it("issues a client id that carries the app's name and redirect URIs", () => {
    const id = register();
    expect(readClient(SECRET, id)).toEqual({ name: "Claude", redirect_uris: [REDIRECT] });
    expect(readClient(OTHER_SECRET, id)).toBeNull();
  });

  it("cleans the name shown on the Allow screen", () => {
    const reg = parseRegistration({ client_name: "Bad\u0000App\n" + "x".repeat(200), redirect_uris: [REDIRECT] });
    expect(reg.ok && reg.client.name).toMatch(/^BadApp/);
    expect(reg.ok && reg.client.name.length).toBe(80);
  });
});

describe("authorize request", () => {
  it("accepts a well-formed request", () => {
    const check = authorize(register());
    expect(check.ok).toBe(true);
  });

  it("never redirects to an unregistered address", () => {
    expect(authorize("lpmcp_client_forged.sig")).toMatchObject({ ok: false, redirect: false });
    expect(authorize(register(), { redirect_uri: "https://evil.example/cb" })).toMatchObject({ ok: false, redirect: false });
  });

  it("sends protocol errors back to a registered address", () => {
    const id = register();
    expect(authorize(id, { code_challenge_method: "plain" })).toMatchObject({ ok: false, redirect: true, error: "invalid_request", state: "xyz" });
    expect(authorize(id, { code_challenge: "" })).toMatchObject({ ok: false, error: "invalid_request" });
    expect(authorize(id, { response_type: "token" })).toMatchObject({ ok: false, error: "unsupported_response_type" });
    expect(authorize(id, { resource: "https://other.example/mcp" })).toMatchObject({ ok: false, error: "invalid_target" });
  });
});

describe("token exchange", () => {
  it("swaps a code for tokens bound to the MCP URL, and refreshes them", () => {
    const id = register();
    const res = exchangeToken(
      SECRET,
      { grant_type: "authorization_code", client_id: id, code: codeFor(id), redirect_uri: REDIRECT, code_verifier: VERIFIER },
      AUD,
      T0
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.userId).toBe("user-1");
    expect(readAccessToken(SECRET, res.tokens.access_token, AUD, T0)).toBe("user-1");
    expect(readAccessToken(SECRET, res.tokens.access_token, "https://other.example/api/mcp", T0)).toBeNull();
    expect(readAccessToken(SECRET, res.tokens.access_token, AUD, T0 + 3601_000)).toBeNull();
    // A refresh token is not an access token.
    expect(readAccessToken(SECRET, res.tokens.refresh_token, AUD, T0)).toBeNull();

    const later = T0 + 2 * 3600_000;
    const refreshed = exchangeToken(SECRET, { grant_type: "refresh_token", client_id: id, refresh_token: res.tokens.refresh_token }, AUD, later);
    expect(refreshed.ok && readAccessToken(SECRET, refreshed.tokens.access_token, AUD, later)).toBe("user-1");
  });

  it("refuses a wrong verifier, redirect, client, expired code, or a code used as a refresh token", () => {
    const id = register();
    const code = codeFor(id);
    const base = { grant_type: "authorization_code", client_id: id, code, redirect_uri: REDIRECT, code_verifier: VERIFIER };
    expect(exchangeToken(SECRET, { ...base, code_verifier: "w".repeat(43) }, AUD, T0)).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(exchangeToken(SECRET, { ...base, redirect_uri: "https://claude.ai/other" }, AUD, T0)).toMatchObject({ ok: false, error: "invalid_grant" });
    const otherApp = register(["https://chatgpt.com/cb"]);
    expect(exchangeToken(SECRET, { ...base, client_id: otherApp }, AUD, T0)).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(exchangeToken(SECRET, { ...base, client_id: "nope" }, AUD, T0)).toMatchObject({ ok: false, error: "invalid_client" });
    expect(exchangeToken(SECRET, base, AUD, T0 + 6 * 60_000)).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(exchangeToken(SECRET, { grant_type: "refresh_token", client_id: id, refresh_token: code }, AUD, T0)).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(exchangeToken(SECRET, { ...base, grant_type: "password" }, AUD, T0)).toMatchObject({ ok: false, error: "unsupported_grant_type" });
  });
});
