import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import * as relations from "./relations";

type Schema = typeof schema & typeof relations;

let _db: NeonHttpDatabase<Schema> | null = null;

function getDb(): NeonHttpDatabase<Schema> {
  if (_db) return _db;
  const rawUrl = process.env.DATABASE_URL!;
  const cleanUrl = rawUrl.replace(/[&?]channel_binding=require/g, "");
  const sql = neon(cleanUrl);
  _db = drizzle(sql, { schema: { ...schema, ...relations } });
  return _db;
}

export const db = new Proxy({} as NeonHttpDatabase<Schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };
