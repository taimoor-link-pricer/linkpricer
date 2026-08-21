-- Custom SQL migration file, put your code below! --

-- Canonical per-marketplace registry. Until now the ~57 marketplaces only
-- existed implicitly, as SELECT DISTINCT marketplace_name FROM
-- marketplace_offers -- there was no row anywhere describing a marketplace
-- itself, so there was nowhere to hang the "Buy direct" destination.
--
-- Two URL columns on purpose:
--   affiliate_url -- revenue-bearing referral link (Linkpricer earns a
--                    commission when a buyer converts). This is why direct
--                    orders carry no 15% managed fee.
--   homepage_url  -- plain, non-monetized fallback, used when we have no
--                    affiliate deal for that marketplace (9 of 57 today).
-- Keeping them separate means an expired affiliate deal is a single
-- NULL-out, not data loss, and "which marketplaces are monetized" stays a
-- readable query rather than string-matching for "?ref=".
CREATE TABLE IF NOT EXISTS "marketplaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"homepage_url" text NOT NULL,
	"affiliate_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "marketplaces_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- Lookup is always by marketplace_name (the join key used across
-- marketplace_offers/clicks/orders); the unique constraint above already
-- provides that index, so no additional one is needed.
CREATE INDEX IF NOT EXISTS "marketplaces_enabled_idx" ON "marketplaces" ("enabled");
