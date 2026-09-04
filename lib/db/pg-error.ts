/**
 * The Postgres SQLSTATE for an error thrown by a Drizzle query.
 *
 * Drizzle wraps driver errors in its own `Error` ("Failed query: …") and the
 * driver's error — the one carrying `code` — is hung off `cause`. So the
 * obvious `err.code === "23505"` is always false against a real Drizzle
 * error, and every handler written that way silently falls through to its
 * rethrow branch.
 *
 * That was not theoretical: the checkout webhook's duplicate-key recovery
 * ("if it still rejects us, deactivate whatever won and retry once") never
 * ran, so a unique-violation there returned 500 to Stripe forever instead of
 * recovering, and /api/developers/regenerate-key returned 500 where it meant
 * to return a friendly 409. Both read the code through this helper now.
 *
 * Checks the top level too, so it keeps working if a driver is ever used
 * unwrapped.
 */
export function pgErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === "string") return e.code;
  const cause = e.cause as { code?: unknown } | undefined;
  if (cause && typeof cause.code === "string") return cause.code;
  return null;
}

/** Unique-constraint violation. */
export const PG_UNIQUE_VIOLATION = "23505";
