import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!.replace(/[&?]channel_binding=require/g, ''));

for (const table of ['marketplace_offers', 'lp_domain_price', 'lp_marketplace_domains']) {
  const rows = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${table} ORDER BY ordinal_position`;
  console.log(`\n=== ${table} ===`);
  rows.forEach((r: any) => console.log(`  ${r.column_name}: ${r.data_type}`));
}
