import { notifyTeam } from "./team";

const YEAR = 365 * 24 * 60 * 60 * 1000;

// Same rule as isTestOrder() uses for the customer email: test accounts look
// like taimourtest@gmail.com or test+3@linkpricer.com.
function isTestAccount(email: string) {
  return email.toLowerCase().includes("test");
}

// Called only when a users row was actually inserted, so a returning user
// signing in again never triggers it. The session route and /api/user/me can
// both race to create the same row on first sign-in; onConflictDoNothing lets
// only one of them insert, and the once-a-year dedupe key covers anything else.
export async function notifyUserSignup(params: {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  // Firebase sign_in_provider: "password", "google.com", ...
  provider?: string | null;
  origin: string;
}): Promise<void> {
  if (isTestAccount(params.email)) return;

  const name = [params.firstName, params.lastName].filter(Boolean).join(" ");
  await notifyTeam({
    event: "user_signup",
    dedupeKey: `user_signup:${params.userId}`,
    dedupeWindowMs: YEAR,
    subject: `[NEW SIGNUP] ${params.email}`,
    lines: [
      name && `Name: ${name}`,
      `Email: ${params.email}`,
      params.provider && `Signed up with: ${params.provider === "password" ? "email + password" : params.provider}`,
      `${params.origin}/admin/users`,
    ],
    userId: params.userId,
  });
}
