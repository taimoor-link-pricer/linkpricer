export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json() as { userId: string };

    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }

    const rows = await db.execute(sql`
      SELECT stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1
    `);

    const customerId = rows.rows[0]?.stripe_customer_id as string | null;

    if (!customerId) {
      return NextResponse.json({ error: "No billing account found. Please subscribe first." }, { status: 404 });
    }

    const origin = req.headers.get("origin") ?? "https://linkpricer.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/developers/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[/api/developers/billing-portal]", err);
    return NextResponse.json({ error: "Failed to open billing portal." }, { status: 500 });
  }
}
