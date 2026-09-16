import { NextRequest, NextResponse } from "next/server";
import { sendUnansweredChatReminders } from "@/lib/notifications/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called every 5 minutes by the `chatReminders` Firebase scheduled function in
// linkpricer-serverless (the Vercel Hobby plan only allows daily crons). Same CRON_SECRET guard as
// /api/cron/notifications.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[/api/cron/chat-reminders] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await sendUnansweredChatReminders(req.nextUrl.origin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[/api/cron/chat-reminders GET]", err);
    return NextResponse.json({ error: "Chat reminders failed" }, { status: 500 });
  }
}
