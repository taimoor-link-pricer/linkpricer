export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    // Read the cookie off the request directly — see /api/developers/me for why.
    const sessionCookie = req.cookies.get("session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const rows = await db.execute(sql`
      SELECT stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1
    `);

    const customerId = rows.rows[0]?.stripe_customer_id as string | null;

    if (!customerId) {
      return NextResponse.json({ error: "No billing account found. Please subscribe first." }, { status: 404 });
    }

    const origin = req.headers.get("origin") ?? "https://linkpricer.ai";

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
