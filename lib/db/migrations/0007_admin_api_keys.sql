-- Custom SQL migration file, put your code below! --

-- Admin-managed API keys (/admin/api-keys).
--
-- Until now a key could only come from a paid Stripe subscription; partner and
-- trial keys were inserted by hand, and "free trial to 2027-01-07" lived in the
-- key's NAME, enforced by nothing. These three columns are what the admin page
-- needs to grant, time-limit and block a key.
--
-- All three are nullable with no default, so existing rows are untouched and
-- code deployed before this migration keeps working.

-- When the key stops working. NULL = never expires.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint

-- Admin block. Deliberately NOT is_active = false: the Stripe webhook owns
-- is_active and flips the newest key back on whenever a subscription becomes
-- entitling, which would silently undo a block. A blocked key stays the user's
-- active key (so no replacement can be issued around it) and is refused at
-- request time.
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "blocked_at" timestamp with time zone;
--> statement-breakpoint

-- users.id of the admin who granted the key. NULL = self-serve (Stripe).
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "granted_by" varchar;
