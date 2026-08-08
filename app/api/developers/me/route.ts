export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { PLANS, type PlanKey } from "@/lib/stripe";

// Carries the caller's own API key (in plaintext, right after issuance) and
// plan/usage data — every response from this route needs to bypass caching
// entirely. It previously had no explicit Cache-Control, which left Next's
// default (`public, max-age=0, must-revalidate`) in place: technically safe
// against a spec-compliant cache reusing a *stale* copy, but still the wrong
// directive for a per-user authenticated endpoint to be sending at all.
function noStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    ...init,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(req: NextRequest) {
  try {
    // Read the cookie directly off the request instead of next/headers'
    // cookies() — that async helper has been intermittently failing to see
    // a cookie that's demonstrably present on the request (0 external calls,
    // no thrown error, just missing). req.cookies is a plain sync read.
    const session = req.cookies.get("session")?.value;
    if (!session) return noStore({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const userId = decoded.uid;

    // Get user's active API key + plain key (one-time reveal)
    const keyRows = await db.execute(sql`
      SELECT id, key_hash, name, daily_limit, per_minute_limit, request_count,
             usage_date, last_used_at, created_at, plain_key_temp
      FROM api_keys
      WHERE user_id = ${userId} AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

    // Get user's Stripe plan info
    const userRows = await db.execute(sql`
      SELECT stripe_plan, stripe_subscription_id, email, first_name, last_name
      FROM users WHERE id = ${userId}
    `);

    const userRow = (userRows.rows ?? userRows)[0] as any;
    const keyRow = (keyRows.rows ?? keyRows)[0] as any;

    if (!userRow) return noStore({ error: "User not found" }, { status: 404 });

    // This is a plain read now — no side effects. The plaintext key reveal is
    // cleared explicitly by POST /api/developers/ack-key-reveal once the
    // client has durably shown it, not as a side effect of every GET here.
    // (This endpoint is polled repeatedly after checkout and hit again by
    // manual "refresh usage" clicks; clearing state on a GET meant whichever
    // of those calls happened to land first would silently blank the key for
    // every later read.)

    // Monthly usage: count requests in current calendar month
    let monthlyUsed = 0;
    if (keyRow) {
      const usageRows = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM api_request_logs
        WHERE api_key_id = ${keyRow.id}
          AND created_at >= date_trunc('month', NOW())
      `);
      const usageRow = (usageRows.rows ?? usageRows)[0] as any;
      monthlyUsed = usageRow?.cnt ?? 0;
    }

    const planKey = (userRow.stripe_plan as PlanKey) ?? null;
    const planInfo = planKey && PLANS[planKey] ? PLANS[planKey] : null;

    // Manually-granted keys (no Stripe subscription) still get a sensible display —
    // derive a monthly figure from the key's own daily limit rather than showing "no plan".
    const isPartnerKey = !planInfo && !!keyRow;
    const planName = planInfo?.name ?? (isPartnerKey ? "Partner access" : null);
    const monthlyQuota = planInfo?.monthlyQuota ?? (isPartnerKey ? keyRow.daily_limit * 30 : null);

    return noStore({
      user: {
        email: userRow.email,
        name: [userRow.first_name, userRow.last_name].filter(Boolean).join(" ") || null,
        plan: planKey,
        planName,
        monthlyQuota,
      },
      apiKey: keyRow
        ? {
            id: keyRow.id,
            name: keyRow.name,
            plainKeyTemp: keyRow.plain_key_temp ?? null,
            dailyLimit: keyRow.daily_limit,
            perMinuteLimit: keyRow.per_minute_limit,
            lastUsedAt: keyRow.last_used_at ?? null,
            createdAt: keyRow.created_at ?? null,
          }
        : null,
      usage: {
        used: monthlyUsed,
        limit: monthlyQuota ?? 0,
      },
    });
  } catch (err) {
    console.error("[/api/developers/me]", err);
    return noStore({ error: "Unauthorized" }, { status: 401 });
  }
}
