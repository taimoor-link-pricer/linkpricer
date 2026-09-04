-- Custom SQL migration file, put your code below! --

-- ─── 1. Trusted marketplaces (drives the API's recommended_price) ──────────
--
-- The public API sells anonymized pricing, so it can never say *where* a
-- price came from -- which leaves a buyer unable to tell a placement from a
-- marketplace we'd actually stand behind from one we wouldn't. `trusted` is
-- the admin's answer to that, set per marketplace in /admin/marketplaces, and
-- recommended_price is the cheapest offer among trusted marketplaces only.
--
-- Defaults to false deliberately: an unreviewed marketplace is not a trusted
-- one, and a domain with no trusted offer returns recommended_price: null
-- rather than quietly recommending a marketplace nobody vetted.
ALTER TABLE "marketplaces" ADD COLUMN IF NOT EXISTS "trusted" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplaces_trusted_idx" ON "marketplaces" ("trusted") WHERE "trusted";
--> statement-breakpoint

-- ─── 2. Monthly quota enforcement ─────────────────────────────────────────
--
-- /developers/docs has always advertised a *monthly* quota ("Monthly quotas
-- reset on the 1st of each calendar month (UTC)"), but the code only ever
-- enforced ceil(monthly/30) as a daily cap. A Starter customer who paid for
-- 1,000 requests/month was 429'd at 34 in a day and could never spend what
-- they bought -- a backfill or a Monday-morning batch job hits the wall on
-- the first run.
--
-- Same atomic check-and-increment shape as minute_count/minute_window: the
-- limit is enforced by a conditional UPDATE on this key's own row, so there
-- is no COUNT(*) over api_request_logs on the hot path and no TOCTOU window.
-- month_window holds 'YYYY-MM' in UTC.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "monthly_limit" integer;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "month_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "month_window" varchar;
--> statement-breakpoint
-- Existing keys were issued under the daily-cap regime; derive the monthly
-- figure they were always entitled to rather than leaving them unlimited
-- (NULL monthly_limit falls back to daily_limit * 30 in code, but writing it
-- down means the dashboard shows the real number immediately).
UPDATE "api_keys" SET "monthly_limit" = "daily_limit" * 30 WHERE "monthly_limit" IS NULL;
--> statement-breakpoint

-- ─── 3. Usage lookup index ────────────────────────────────────────────────
--
-- GET /api/developers/me counts this calendar month's rows for one key on
-- every dashboard load and every post-checkout poll. The existing indexes are
-- on api_key_id and created_at separately, so that count degrades into a scan
-- of one key's entire history as the log table grows.
CREATE INDEX IF NOT EXISTS "api_request_logs_key_created_idx"
  ON "api_request_logs" ("api_key_id", "created_at" DESC);
