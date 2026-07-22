import { NextResponse } from "next/server";
import { getUsdRates } from "@/lib/currency";

// Public, read-only — the same admin-configured rates used server-side for
// price conversion (lib/currency.ts), exposed so the frontend's currency
// toggle (lib/design-v1/format.ts RATES) can stay in sync instead of using
// its own separately-hardcoded numbers.
export async function GET() {
  const rates = await getUsdRates();
  return NextResponse.json({ rates });
}
