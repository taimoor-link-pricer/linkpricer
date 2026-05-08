import { db } from "@/lib/db";
import { schema } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.select().from(schema.users).limit(1);
    return Response.json({ connected: true, sample: result });
  } catch (err) {
    return Response.json({ connected: false, error: String(err) }, { status: 500 });
  }
}
