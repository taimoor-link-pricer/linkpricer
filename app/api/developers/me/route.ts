import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { PLANS, type PlanKey } from "@/lib/stripe";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(session, true);
    const userId = decoded.uid;

    // Get user's active API key + plain key (one-time reveal)
    const keyRows = await db.execute(sql`
      SELECT id, key_hash, name, daily_limit, per_minute_limit, request_count,
             usage_date, last_used_at, plain_key_temp
      FROM api_keys
      WHERE user_id = ${userId} AND is_active = true
      LIMIT 1
    `);

    // Get user's Stripe plan info
    const userRows = await db.execute(sql`
      SELECT stripe_plan, stripe_subscription_id, email, first_name, last_name
      FROM users WHERE id = ${userId}
    `);

    const userRow = (userRows.rows ?? userRows)[0] as any;
    const keyRow = (keyRows.rows ?? keyRows)[0] as any;

    if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

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

    return NextResponse.json({
      user: {
        email: userRow.email,
        name: [userRow.first_name, userRow.last_name].filter(Boolean).join(" ") || null,
        plan: planKey,
        planName: planInfo?.name ?? null,
        monthlyQuota: planInfo?.monthlyQuota ?? null,
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
        limit: planInfo?.monthlyQuota ?? 0,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
