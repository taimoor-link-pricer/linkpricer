/**
 * OAuth 2.1 for the MCP server, so an AI app (Claude.ai, ChatGPT) can connect
 * with "sign in to LinkPricer" instead of a pasted API key.
 *
 * The flow is the one the MCP authorization spec prescribes: the app registers
 * itself (dynamic client registration), sends the user to /oauth/authorize,
 * where they log in with their normal LinkPricer account and click Allow, and
 * swaps the code it gets back for tokens (with PKCE).
 *
 * Everything here is stateless. Client ids, codes and tokens are HMAC-signed
 * envelopes (MCP_OAUTH_SECRET) carrying what they need, so there is no OAuth
 * table and no migration on the shared database. What that costs:
 *   - a code can be redeemed more than once within its 5 minutes — harmless,
 *     since redeeming it needs the PKCE verifier only the client that started
 *     the flow holds, and each redemption yields the same user's tokens;
 *   - a single token cannot be revoked. A token only identifies a user; what
 *     it can spend is that user's API key, checked on every call, so blocking
 *     or deactivating the key cuts every connected app off at once, and
 *     rotating the secret signs every app out.
 *
 * Pure apart from reading the secret, so lib/mcp/oauth.test.ts can pin it.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const MCP_PATH = "/api/mcp";
export const AUTHORIZE_PATH = "/oauth/authorize";
export const TOKEN_PATH = "/api/oauth/token";
export const REGISTER_PATH = "/api/oauth/register";
export const SCOPE = "prices";

const CODE_TTL_S = 5 * 60;
export const ACCESS_TTL_S = 60 * 60;
const REFRESH_TTL_S = 90 * 24 * 60 * 60;

/** Prefix on every token this module issues — how the MCP route tells one from an lp_live_ key. */
export const TOKEN_PREFIX = "lpmcp_";

type Kind = "client" | "code" | "access" | "refresh";

/** The signing secret, or null when OAuth is not configured on this deployment. */
export function oauthSecret(): string | null {
  const s = process.env.MCP_OAUTH_SECRET;
  return s && s.length >= 32 ? s : null;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function mac(secret: string, kind: Kind, payload: string): string {
  return createHmac("sha256", secret).update(`${kind}.${payload}`).digest("base64url");
}

/** `lpmcp_<kind>_<payload>.<signature>`; the kind is signed too, so a code can never pass as a token. */
export function seal(secret: string, kind: Kind, data: Record<string, unknown>): string {
  const payload = b64url(JSON.stringify(data));
  return `${TOKEN_PREFIX}${kind}_${payload}.${mac(secret, kind, payload)}`;
}

/** The payload of a sealed value of this kind, or null when it is forged, malformed or expired. */
export function unseal<T extends Record<string, unknown>>(
  secret: string,
  kind: Kind,
  value: unknown,
  now = Date.now()
): T | null {
  if (typeof value !== "string") return null;
  const head = `${TOKEN_PREFIX}${kind}_`;
  if (!value.startsWith(head)) return null;
  const [payload, sig, extra] = value.slice(head.length).split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(secret, kind, payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const exp = (data as { exp?: unknown }).exp;
  if (typeof exp === "number" && exp * 1000 <= now) return null;
  return data as T;
}

const nowS = (now: number) => Math.floor(now / 1000);

// ─── clients ───────────────────────────────────────────────────────────────

export interface ClientInfo {
  name: string;
  redirect_uris: string[];
}

/**
 * Where an authorization code may be sent: an https URL, or http on the
 * loopback address for apps that run on the user's own machine (Claude Code,
 * Cursor). Nothing with a fragment, and no plain http anywhere else — a code
 * sent over it could be read on the way.
 */
export function isAllowedRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

export type Registration = { ok: true; client: ClientInfo } | { ok: false; message: string };

/** Validates an RFC 7591 registration request. */
export function parseRegistration(body: unknown): Registration {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;
  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10) {
    return { ok: false, message: "redirect_uris must list 1 to 10 URLs." };
  }
  const bad = uris.find((u) => !isAllowedRedirectUri(u));
  if (bad !== undefined) {
    return { ok: false, message: `Redirect URI not allowed: ${String(bad)}. Use https, or http on localhost.` };
  }
  const auth = b.token_endpoint_auth_method;
  if (auth != null && auth !== "none") {
    return { ok: false, message: 'Only public clients are supported: token_endpoint_auth_method must be "none".' };
  }
  const rawName = typeof b.client_name === "string" ? b.client_name.trim() : "";
  // Shown on the Allow screen, so kept short and printable.
  const name = rawName.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80) || "An AI app";
  return { ok: true, client: { name, redirect_uris: [...new Set(uris as string[])] } };
}

export function issueClientId(secret: string, client: ClientInfo, now = Date.now()): string {
  return seal(secret, "client", { n: client.name, r: client.redirect_uris, iat: nowS(now) });
}

export function readClient(secret: string, clientId: unknown): ClientInfo | null {
  const d = unseal<{ n?: unknown; r?: unknown }>(secret, "client", clientId);
  if (!d || typeof d.n !== "string" || !Array.isArray(d.r) || !d.r.every((u) => typeof u === "string")) return null;
  return { name: d.n, redirect_uris: d.r as string[] };
}

/** Short stable fingerprint of a client id, so codes and tokens can be bound to one without embedding it. */
function clientRef(clientId: string): string {
  return createHash("sha256").update(clientId).digest("base64url").slice(0, 22);
}

// ─── authorization requests ────────────────────────────────────────────────

export interface AuthorizeRequest {
  client_id: string;
  client: ClientInfo;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  resource: string | null;
}

export type AuthorizeCheck =
  | { ok: true; req: AuthorizeRequest }
  /** Not safe to redirect: the client or redirect URI cannot be trusted, so the error is shown on our page. */
  | { ok: false; redirect: false; message: string }
  /** The redirect URI is trusted, so the error goes back to the app the OAuth way. */
  | { ok: false; redirect: true; redirect_uri: string; error: string; description: string; state: string | null };

const one = (v: unknown): string | null => (typeof v === "string" ? v : Array.isArray(v) && typeof v[0] === "string" ? v[0] : null);

/** Validates the query of /oauth/authorize (and the form the Allow button posts, which carries the same fields). */
export function checkAuthorizeRequest(
  secret: string,
  params: Record<string, unknown>,
  expectedResource: string
): AuthorizeCheck {
  const clientId = one(params.client_id);
  const client = clientId ? readClient(secret, clientId) : null;
  if (!clientId || !client) {
    return { ok: false, redirect: false, message: "This app is not registered with LinkPricer. Try connecting again from the app." };
  }
  const redirectUri = one(params.redirect_uri);
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return { ok: false, redirect: false, message: "The app sent a return address it did not register. Try connecting again from the app." };
  }
  const state = one(params.state);
  const fail = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    redirect: true,
    redirect_uri: redirectUri,
    error,
    description,
    state,
  });

  if (one(params.response_type) !== "code") return fail("unsupported_response_type", "response_type must be code.");
  const challenge = one(params.code_challenge);
  if (!challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
    return fail("invalid_request", "A PKCE code_challenge is required.");
  }
  if (one(params.code_challenge_method) !== "S256") {
    return fail("invalid_request", "code_challenge_method must be S256.");
  }
  const resource = one(params.resource);
  if (resource && resource.replace(/\/$/, "") !== expectedResource) {
    return fail("invalid_target", `This server can only issue tokens for ${expectedResource}.`);
  }
  return {
    ok: true,
    req: { client_id: clientId, client, redirect_uri: redirectUri, code_challenge: challenge, state, resource },
  };
}

/** Where to send the browser after the user answers: the app's redirect URI with the result attached. */
export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

export function issueCode(secret: string, userId: string, req: AuthorizeRequest, now = Date.now()): string {
  return seal(secret, "code", {
    sub: userId,
    cid: clientRef(req.client_id),
    ru: req.redirect_uri,
    cc: req.code_challenge,
    exp: nowS(now) + CODE_TTL_S,
  });
}

// ─── tokens ────────────────────────────────────────────────────────────────

export interface TokenSet {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export type TokenExchange =
  | { ok: true; userId: string; tokens: TokenSet }
  | { ok: false; error: "invalid_request" | "invalid_grant" | "invalid_client" | "unsupported_grant_type"; description: string };

function issueTokens(secret: string, userId: string, cref: string, audience: string, now: number): TokenSet {
  return {
    access_token: seal(secret, "access", { sub: userId, cid: cref, aud: audience, exp: nowS(now) + ACCESS_TTL_S }),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: seal(secret, "refresh", { sub: userId, cid: cref, exp: nowS(now) + REFRESH_TTL_S }),
    scope: SCOPE,
  };
}

function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const want = Buffer.from(challenge);
  const got = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * The token endpoint's logic for both grants. `audience` is the MCP URL on
 * this deployment; every access token is bound to it.
 */
export function exchangeToken(
  secret: string,
  params: Record<string, string | undefined>,
  audience: string,
  now = Date.now()
): TokenExchange {
  const clientId = params.client_id;
  if (!clientId || !readClient(secret, clientId)) {
    return { ok: false, error: "invalid_client", description: "Unknown client_id. Register the app again." };
  }
  const cref = clientRef(clientId);

  if (params.grant_type === "authorization_code") {
    const code = unseal<{ sub: string; cid: string; ru: string; cc: string }>(secret, "code", params.code, now);
    if (!code || code.cid !== cref) {
      return { ok: false, error: "invalid_grant", description: "The code is invalid, expired or was issued to another app." };
    }
    if (params.redirect_uri !== code.ru) {
      return { ok: false, error: "invalid_grant", description: "redirect_uri does not match the one the code was issued for." };
    }
    if (!params.code_verifier || !pkceMatches(params.code_verifier, code.cc)) {
      return { ok: false, error: "invalid_grant", description: "PKCE verification failed." };
    }
    return { ok: true, userId: code.sub, tokens: issueTokens(secret, code.sub, cref, audience, now) };
  }

  if (params.grant_type === "refresh_token") {
    const rt = unseal<{ sub: string; cid: string }>(secret, "refresh", params.refresh_token, now);
    if (!rt || rt.cid !== cref) {
      return { ok: false, error: "invalid_grant", description: "The refresh token is invalid, expired or was issued to another app." };
    }
    return { ok: true, userId: rt.sub, tokens: issueTokens(secret, rt.sub, cref, audience, now) };
  }

  return { ok: false, error: "unsupported_grant_type", description: "Use authorization_code or refresh_token." };
}

/** The user an access token speaks for, or null when it is not a valid token for this server. */
export function readAccessToken(secret: string, token: string, audience: string, now = Date.now()): string | null {
  const t = unseal<{ sub?: unknown; aud?: unknown }>(secret, "access", token, now);
  if (!t || typeof t.sub !== "string" || t.aud !== audience) return null;
  return t.sub;
}

// ─── discovery ─────────────────────────────────────────────────────────────

/** RFC 9728: tells an app which authorization server guards the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: origin + MCP_PATH,
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "LinkPricer",
    resource_documentation: origin + "/developers/docs",
  };
}

/** RFC 8414: where to register, authorize and get tokens. */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: origin + AUTHORIZE_PATH,
    token_endpoint: origin + TOKEN_PATH,
    registration_endpoint: origin + REGISTER_PATH,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: origin + "/developers/docs",
  };
}

/** CORS for the OAuth and MCP endpoints: browser-based MCP clients call them cross-origin, with bearer tokens, never cookies. */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, Mcp-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
} as const;
