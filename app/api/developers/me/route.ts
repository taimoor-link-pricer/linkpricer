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
      SELECT id, key_hash, name, monthly_limit, daily_limit, per_minute_limit,
             month_count, month_window, last_used_at, created_at,
             -- The plaintext reveal EXPIRES, whether or not anyone acked it.
             --
             -- Clearing it was previously the sole responsibility of
             -- POST /ack-key-reveal, which only fires if the dashboard actually
             -- renders the key. A customer who buys a key and never opens the
             -- dashboard — or whose ack request fails — left their key sitting
             -- in the database in plaintext indefinitely. Six live keys were in
             -- that state when this was found, the oldest 50 days old, which
             -- defeats the entire point of storing only a hash.
             --
             -- A reveal is only ever useful in the minutes after issuance, so
             -- anything older than an hour is treated as gone on read and
             -- deleted below.
             CASE WHEN created_at > NOW() - INTERVAL '1 hour'
                  THEN plain_key_temp ELSE NULL END AS plain_key_temp,
             (plain_key_temp IS NOT NULL AND created_at <= NOW() - INTERVAL '1 hour') AS plain_key_expired
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

    // Actually delete an expired reveal rather than merely hiding it — hiding
    // it from this response would leave the credential readable to anything
    // with database access, which is exactly the problem.
    if (keyRow?.plain_key_expired) {
      await db.execute(sql`
        UPDATE api_keys SET plain_key_temp = NULL
        WHERE id = ${keyRow.id} AND plain_key_temp IS NOT NULL
      `).catch((err) => console.error("[/api/developers/me] expiring stale key reveal failed", err));
    }

    if (!userRow) return noStore({ error: "User not found" }, { status: 404 });

    // This is a plain read now — no side effects. The plaintext key reveal is
    // cleared explicitly by POST /api/developers/ack-key-reveal once the
    // client has durably shown it, not as a side effect of every GET here.
    // (This endpoint is polled repeatedly after checkout and hit again by
    // manual "refresh usage" clicks; clearing state on a GET meant whichever
    // of those calls happened to land first would silently blank the key for
    // every later read.)

    // Monthly usage, read off the same counter the API actually enforces
    // rather than re-counting api_request_logs.
    //
    // The log count was both slower (a growing scan of one key's history on
    // every dashboard load and every post-checkout poll) and, more
    // importantly, a *different number* from the one that triggers a 429:
    // a request rejected for being over quota still writes a log row, and a
    // log write that fails does not refund quota. A customer seeing "1,002 of
    // 1,000 used" or "998 of 1,000 used" while being blocked has no way to
    // tell which figure is real. There is exactly one enforced counter, so
    // this shows that one.
    //
    // month_window is 'YYYY-MM' in UTC; a stale window means nothing has been
    // spent yet this month.
    const nowMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
    const monthlyUsed = keyRow && keyRow.month_window === nowMonth ? Number(keyRow.month_count ?? 0) : 0;

    const planKey = (userRow.stripe_plan as PlanKey) ?? null;
    const planInfo = planKey && PLANS[planKey] ? PLANS[planKey] : null;

    // Manually-granted keys (no Stripe subscription) still get a sensible display —
    // derive a monthly figure from the key's own daily limit rather than showing "no plan".
    const isPartnerKey = !planInfo && !!keyRow;
    const planName = planInfo?.name ?? (isPartnerKey ? "Partner access" : null);
    // The key's own monthly_limit is authoritative — it is what the API
    // enforces. The plan figure is only a fallback for a key issued before
    // that column existed, and daily_limit * 30 mirrors the same fallback the
    // API applies when monthly_limit is NULL.
    const monthlyQuota =
      (keyRow?.monthly_limit != null ? Number(keyRow.monthly_limit) : null) ??
      planInfo?.monthlyQuota ??
      (isPartnerKey ? keyRow.daily_limit * 30 : null);

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
            monthlyLimit: monthlyQuota,
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
