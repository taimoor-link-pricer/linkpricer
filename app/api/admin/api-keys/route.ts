export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";
import { requireAdminSession } from "@/lib/admin-auth";
import { adminAuth } from "@/lib/firebase/admin";
import { generateApiKey, keyStatus, parseAdminKeyFields } from "@/lib/api-keys";
import { monthWindow } from "@/lib/public-api/common";
import { pgErrorCode, PG_UNIQUE_VIOLATION } from "@/lib/db/pg-error";

const PAGE_SIZE = 25;
const TAG = "[/api/admin/api-keys]";

// Every response here is admin-only and one of them carries a plaintext key.
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

const STATUS_FILTERS: Record<string, SQL> = {
  // "current" is the default view: the key each user actually holds. Revoked
  // rows are history — a user accumulates one per regeneration.
  current: sql`k.is_active`,
  active: sql`k.is_active AND k.blocked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > NOW())`,
  blocked: sql`k.is_active AND k.blocked_at IS NOT NULL`,
  expired: sql`k.is_active AND k.blocked_at IS NULL AND k.expires_at <= NOW()`,
  revoked: sql`NOT k.is_active`,
};

interface KeyListRow {
  id: string;
  name: string;
  user_id: string;
  is_active: boolean;
  per_minute_limit: number;
  monthly_limit: number;
  month_used: number;
  last_used_at: string | null;
  created_at: string | null;
  expires_at: string | null;
  blocked_at: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  stripe_plan: string | null;
  has_subscription: boolean;
  granted_by_email: string | null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Forbidden" }, 403);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status") ?? "current";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const conditions: SQL[] = [STATUS_FILTERS[status] ?? STATUS_FILTERS.current];
  if (search) {
    const like = `%${search}%`;
    conditions.push(sql`(u.email ILIKE ${like} OR k.name ILIKE ${like} OR u.first_name ILIKE ${like} OR u.last_name ILIKE ${like})`);
  }
  const where = sql.join(conditions, sql` AND `);
  const month = monthWindow(new Date());

  try {
    const [rows, totals] = await Promise.all([
      db.execute(sql`
        SELECT k.id, k.name, k.user_id, k.is_active, k.per_minute_limit,
               COALESCE(k.monthly_limit, k.daily_limit * 30) AS monthly_limit,
               CASE WHEN k.month_window = ${month} THEN k.month_count ELSE 0 END AS month_used,
               k.last_used_at, k.created_at, k.expires_at, k.blocked_at,
               u.email, u.first_name, u.last_name, u.stripe_plan,
               (u.stripe_subscription_id IS NOT NULL) AS has_subscription,
               g.email AS granted_by_email
        FROM api_keys k
        JOIN users u ON u.id = k.user_id
        LEFT JOIN users g ON g.id = k.granted_by
        WHERE ${where}
        ORDER BY k.created_at DESC NULLS LAST, k.id
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total
        FROM api_keys k JOIN users u ON u.id = k.user_id
        WHERE ${where}
      `),
    ]);

    const total = Number((totals.rows[0] as { total: number }).total);
    return json({
      keys: (rows.rows as unknown as KeyListRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        userId: r.user_id,
        email: r.email ?? "—",
        userName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        // Where the key's entitlement comes from, for the admin's benefit: a
        // subscription's limits are rewritten by Stripe webhooks.
        source: r.has_subscription ? "subscription" : "admin",
        plan: r.stripe_plan ?? null,
        grantedBy: r.granted_by_email ?? null,
        monthlyLimit: Number(r.monthly_limit),
        monthUsed: Number(r.month_used),
        perMinuteLimit: Number(r.per_minute_limit),
        lastUsedAt: r.last_used_at ?? null,
        createdAt: r.created_at ?? null,
        expiresAt: r.expires_at ?? null,
        blockedAt: r.blocked_at ?? null,
        status: keyStatus({ isActive: r.is_active, blockedAt: r.blocked_at, expiresAt: r.expires_at }),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (err) {
    console.error(`${TAG} GET`, err);
    return json({ error: "Failed to load API keys" }, 500);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Finds the account for `email`, or creates it — a Firebase Auth user (so the
 * person can sign in) plus the Postgres row the key hangs off. The account
 * has no password; the caller hands back a set-password link.
 */
async function createAccount(email: string, firstName: string | null, lastName: string | null): Promise<string> {
  let uid: string;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  } catch (err) {
    if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || undefined;
    uid = (await adminAuth.createUser({ email, displayName })).uid;
  }
  await db.execute(sql`
    INSERT INTO users (id, email, first_name, last_name, role, has_completed_onboarding)
    VALUES (${uid}, ${email}, ${firstName}, ${lastName}, 'client', false)
    ON CONFLICT (id) DO NOTHING
  `);
  return uid;
}

// POST — issue a key without a subscription, optionally creating the account.
export async function POST(req: NextRequest) {
  const admin = await requireAdminSession();
  if (!admin) return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);

  if (body.monthlyLimit === undefined) return json({ error: "Monthly limit is required." }, 400);
  const parsed = parseAdminKeyFields({
    name: body.name,
    monthlyLimit: body.monthlyLimit,
    perMinuteLimit: body.perMinuteLimit ?? 60,
    expiresAt: body.expiresAt ?? null,
  });
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { monthlyLimit, perMinuteLimit, expiresAt } = parsed.fields;
  const name = parsed.fields.name ?? "Linkpricer API — Admin grant";

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
  const firstName = str(body.firstName);
  const lastName = str(body.lastName);

  try {
    const found = await db.execute(sql`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`);
    let userId = (found.rows[0] as { id: string } | undefined)?.id ?? null;
    let accountCreated = false;

    if (!userId) {
      if (body.createAccount !== true) {
        return json({ error: `No account exists for ${email}.`, code: "no_account" }, 404);
      }
      userId = await createAccount(email, firstName, lastName);
      accountCreated = true;
    }

    const { plain, hash } = generateApiKey();
    let inserted;
    try {
      // The plaintext is returned to the admin below and NOT parked in
      // plain_key_temp: that column exists so a paying customer's own
      // dashboard can show a key nobody was there to hand them.
      inserted = await db.execute(sql`
        INSERT INTO api_keys (user_id, key_hash, name, monthly_limit, daily_limit, per_minute_limit, is_active, expires_at, granted_by)
        VALUES (${userId}, ${hash}, ${name}, ${monthlyLimit!}, ${Math.ceil(monthlyLimit! / 30)}, ${perMinuteLimit!}, true, ${expiresAt ?? null}, ${admin.uid})
        RETURNING id
      `);
    } catch (err) {
      // api_keys_one_active_per_user: this user already holds a key.
      if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
        return json(
          { error: `${email} already has an API key. Find it in the list to change its limits or expiry.`, code: "has_active_key" },
          409
        );
      }
      throw err;
    }

    // Only for an account made here: an existing user already has a way in.
    let setPasswordLink: string | null = null;
    if (accountCreated) {
      try {
        setPasswordLink = await adminAuth.generatePasswordResetLink(email);
      } catch (err) {
        console.error(`${TAG} set-password link failed for a new account`, err);
      }
    }

    console.log(`${TAG} key ${(inserted.rows[0] as { id: string }).id} granted to user ${userId} by admin ${admin.uid}`);
    return json({ ok: true, key: plain, userId, email, accountCreated, setPasswordLink });
  } catch (err) {
    console.error(`${TAG} POST`, err);
    return json({ error: "Failed to create the API key." }, 500);
  }
}
