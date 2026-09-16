import { NextRequest, NextResponse } from "next/server";
import { runScheduledNotifications } from "@/lib/notifications/scheduled";

export const dynamic = "force-dynamic";
// The digest walks every open order; the default 10s serverless budget is not
// enough once there are a few hundred.
export const maxDuration = 60;

// Driven by the Vercel cron entry in vercel.json (08:00 UTC daily). Vercel signs
// cron requests with CRON_SECRET as a bearer token; without the secret set, the
// route refuses to run rather than leaving a public endpoint that can email
// every client on demand.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[/api/cron/notifications] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await runScheduledNotifications(req.nextUrl.origin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[/api/cron/notifications GET]", err);
    return NextResponse.json({ error: "Scheduled notifications failed" }, { status: 500 });
  }
}
