import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ensureCurrencyRatesTable, invalidateRatesCache } from "@/lib/currency";
import { getCurrentUser } from "@/lib/get-current-user";

// GET — list all admin-configured currency rates
export async function GET() {
  try {
    await ensureCurrencyRatesTable();
    const rows = await db.execute(sql`
      SELECT currency, usd_rate, updated_at, updated_by
      FROM currency_rates
      ORDER BY currency ASC
    `);
    return NextResponse.json({ rates: rows.rows });
  } catch (err) {
    console.error("[/api/admin/currency-rates GET]", err);
    return NextResponse.json({ error: "Failed to load rates" }, { status: 500 });
  }
}

// POST — upsert a currency rate. `usd_rate` is "1 unit of currency = usd_rate USD".
export async function POST(req: NextRequest) {
  let body: { currency: string; usd_rate: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currency = body.currency?.trim().toUpperCase();
  const usdRate = Number(body.usd_rate);
  if (!currency || !Number.isFinite(usdRate) || usdRate <= 0) {
    return NextResponse.json({ error: "currency and a positive usd_rate are required" }, { status: 400 });
  }
  // USD is pinned to 1 everywhere in the conversion logic and never read from
  // this table — storing a different rate for it would be silently ignored
  // at best, or mask a real bug at worst.
  if (currency === "USD") {
    return NextResponse.json({ error: "USD is always 1:1 and isn't configurable" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser();
    const updatedBy = user?.email ?? "unknown";

    await ensureCurrencyRatesTable();
    await db.execute(sql`
      INSERT INTO currency_rates (currency, usd_rate, updated_at, updated_by)
      VALUES (${currency}, ${usdRate}, CURRENT_TIMESTAMP, ${updatedBy})
      ON CONFLICT (currency) DO UPDATE SET
        usd_rate = EXCLUDED.usd_rate,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by
    `);
    invalidateRatesCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/currency-rates POST]", err);
    return NextResponse.json({ error: "Failed to save rate" }, { status: 500 });
  }
}

// DELETE — remove a currency rate (falls back to hardcoded default, if any, once removed)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency")?.trim().toUpperCase();
  if (!currency) return NextResponse.json({ error: "currency required" }, { status: 400 });

  try {
    await ensureCurrencyRatesTable();
    await db.execute(sql`DELETE FROM currency_rates WHERE currency = ${currency}`);
    invalidateRatesCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/currency-rates DELETE]", err);
    return NextResponse.json({ error: "Failed to delete rate" }, { status: 500 });
  }
}
