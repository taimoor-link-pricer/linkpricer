import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as relations from "./relations";

const rawUrl = process.env.DATABASE_URL!;
const cleanUrl = rawUrl.replace(/[&?]channel_binding=require/g, "");
const sql = neon(cleanUrl);
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
export { schema };
