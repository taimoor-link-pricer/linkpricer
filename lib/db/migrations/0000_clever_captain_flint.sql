-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "api_request_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"domain" text NOT NULL,
	"http_status" integer NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "gdpr_deletion_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"reason" text,
	"verification_token" varchar,
	"verified_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_api_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marketplace_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"api_type" text NOT NULL,
	"base_url" text NOT NULL,
	"auth_type" text NOT NULL,
	"auth_config" jsonb,
	"max_concurrent_requests" integer DEFAULT 5,
	"requests_per_minute" integer DEFAULT 60,
	"timeout_ms" integer DEFAULT 10000,
	"cache_ttl_seconds" integer DEFAULT 300,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "marketplace_api_configs_marketplace_name_unique" UNIQUE("marketplace_name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text NOT NULL,
	"content_type" text DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"html_content" text,
	"css_content" text,
	"author_id" varchar,
	"author" text DEFAULT 'LinkPricer Team' NOT NULL,
	"author_title" text,
	"author_bio" text,
	"author_twitter_url" text,
	"author_linkedin_url" text,
	"author_website_url" text,
	"category" text NOT NULL,
	"cover_image_url" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'site_config' NOT NULL,
	"hero_image_url" text,
	"hero_image_alt" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lp_domain_price" (
	"domainId" bigint PRIMARY KEY NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"secondPrice" numeric(8, 2),
	"thirdPrice" numeric(8, 2),
	"currency" char(255),
	"gambling" numeric(8, 2),
	"adult" numeric(8, 2),
	"cbd" numeric(8, 2),
	"loan" numeric(8, 2),
	"dating" numeric(8, 2),
	"crypto" numeric(8, 2),
	"tradingForex" numeric(8, 2),
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSeenAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lp_updates_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"marketPlace" varchar(255) NOT NULL,
	"scrapedCount" bigint NOT NULL,
	"scrapedDate" date NOT NULL,
	CONSTRAINT "lp_updates_log_marketPlace_scrapedDate_key" UNIQUE("marketPlace","scrapedDate")
);
--> statement-breakpoint
CREATE TABLE "lp_marketplace_domains" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"w" varchar(255) NOT NULL,
	"marketPlace" varchar(255) NOT NULL,
	"sourceName" text,
	"showPrice" "bytea" NOT NULL,
	"category" text,
	"country" varchar(255),
	"language" varchar(255),
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"scrapedAt" timestamp NOT NULL,
	"embeddings" vector(1536),
	"isActive" boolean DEFAULT true NOT NULL,
	"lastSeenAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "lp_domain_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"w" text NOT NULL,
	"category" text,
	"tld" text NOT NULL,
	"summary" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "lp_domain_categories_w_key" UNIQUE("w")
);
--> statement-breakpoint
CREATE TABLE "market_benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"category" text NOT NULL,
	"avg_price" numeric(10, 2) NOT NULL,
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"std_dev" numeric(10, 2),
	"sample_size" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"avg_traffic" numeric(14, 2) NOT NULL,
	"avg_dr" numeric(10, 2) NOT NULL,
	"avg_gambling_price" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"bio" text,
	"avatar_url" text,
	"twitter_url" text,
	"linkedin_url" text,
	"website_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"country_main_traffic" text,
	"language_written_in_website" text,
	"category" text,
	"domain_rating" integer,
	"org_traffic" bigint,
	"org_keywords" bigint,
	"ref_domains" bigint,
	"linked_domains" bigint,
	"allowed_niche" text,
	"semantic_category" text,
	"semantic_summary" text,
	"category_confidence" numeric(5, 4),
	"embedding" vector(1536),
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	"value_score" numeric(5, 2),
	"value_grade" text,
	"gambling_value_score" numeric(5, 2),
	"gambling_value_grade" text,
	CONSTRAINT "domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "gdpr_consent_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"anonymous_id" varchar,
	"purpose" varchar NOT NULL,
	"status" varchar NOT NULL,
	"actor" varchar DEFAULT 'user' NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"consent_source" varchar DEFAULT 'cookie_banner' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gdpr_consents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"anonymous_id" varchar,
	"analytics_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"necessary_consent" boolean DEFAULT true NOT NULL,
	"lawful_basis" varchar DEFAULT 'consent' NOT NULL,
	"consent_source" varchar DEFAULT 'cookie_banner' NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gdpr_data_exports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"export_format" varchar DEFAULT 'json' NOT NULL,
	"download_url" text,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lp_domain_metrics" (
	"domainId" bigint PRIMARY KEY NOT NULL,
	"domainRating" numeric(8, 2),
	"orgTraffic" bigint,
	"orgKeywords" bigint,
	"refDomains" bigint,
	"linkedDomains" bigint,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lp_domain_info" (
	"domainId" bigint PRIMARY KEY NOT NULL,
	"info" text,
	"allowedNiche" text,
	"rejectedNiche" text,
	"publicationType" text,
	"linkType" text,
	"TAT" text,
	"linkNo" text,
	"wordCount" text,
	"sponsoredTag" text,
	"duration" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lp_domain_ai_metrics" (
	"domainUrl" varchar PRIMARY KEY NOT NULL,
	"semanticCategory" text,
	"semanticSummary" text,
	"categoryConfidence" numeric,
	"valueScore" numeric,
	"valueGrade" text,
	"gamblingValueScore" numeric,
	"gamblingValueGrade" text,
	"embeddings" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_clients_api_key_hash_key" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "marketplace_price_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"marketplace_name" text NOT NULL,
	"marketplace_url" text,
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"gambling_min_price" numeric(10, 2),
	"gambling_max_price" numeric(10, 2),
	"adult_min_price" numeric(10, 2),
	"adult_max_price" numeric(10, 2),
	"cbd_min_price" numeric(10, 2),
	"cbd_max_price" numeric(10, 2),
	"loan_min_price" numeric(10, 2),
	"loan_max_price" numeric(10, 2),
	"dating_min_price" numeric(10, 2),
	"dating_max_price" numeric(10, 2),
	"crypto_min_price" numeric(10, 2),
	"crypto_max_price" numeric(10, 2),
	"trading_forex_min_price" numeric(10, 2),
	"trading_forex_max_price" numeric(10, 2),
	"available" boolean DEFAULT true,
	"delivery_time_days" integer,
	"quality_score" integer,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"link_insertion_min_price" numeric(10, 2),
	"link_insertion_max_price" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"daily_limit" integer DEFAULT 1000 NOT NULL,
	"per_minute_limit" integer DEFAULT 60 NOT NULL,
	"data_scope" text DEFAULT 'price_only' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"usage_date" varchar,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"domain_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "link_monitors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"published_url" text NOT NULL,
	"target_url" text NOT NULL,
	"anchor_text" text NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_checked_at" timestamp,
	"next_check_at" timestamp NOT NULL,
	"is_indexed" boolean,
	"indexed_at" timestamp,
	"last_index_check" timestamp,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"days_live" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"marketplace_name" text NOT NULL,
	"price_type" text NOT NULL,
	"old_min_price" numeric(10, 2),
	"old_max_price" numeric(10, 2),
	"new_min_price" numeric(10, 2),
	"new_max_price" numeric(10, 2),
	"change_date" timestamp DEFAULT now(),
	"change_percentage" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"offer_id" varchar,
	"status" text DEFAULT 'Writing' NOT NULL,
	"order_type" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"snapshot_domain" text,
	"snapshot_marketplace_name" text,
	"snapshot_marketplace_url" text,
	"snapshot_currency" text DEFAULT 'USD',
	"snapshot_offer_metadata" jsonb,
	"price_captured_at" timestamp,
	"content_option" text DEFAULT 'provided' NOT NULL,
	"word_count" integer DEFAULT 750,
	"content_price" numeric(10, 2) DEFAULT '37.50',
	"uploaded_file_name" text,
	"original_file_name" text,
	"article_url" text,
	"email" text NOT NULL,
	"article_title" text,
	"target_url" text NOT NULL,
	"anchor_text" text,
	"requirements" text,
	"price_type" text DEFAULT 'base' NOT NULL,
	"selected_price" numeric(10, 2) NOT NULL,
	"review_notes" text,
	"live_url" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"company_id" varchar
);
--> statement-breakpoint
CREATE TABLE "onboarding_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"user_type" varchar NOT NULL,
	"user_type_other" text,
	"monthly_spend" varchar NOT NULL,
	"biggest_challenge" text NOT NULL,
	"priority_factors" text[] NOT NULL,
	"current_method" text[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "onboarding_responses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "passkey_credentials" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "marketplace_clicks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"domain_id" varchar,
	"domain" text NOT NULL,
	"marketplace_name" text NOT NULL,
	"marketplace_url" text NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_activity_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "external_url_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"summary" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "external_url_embeddings_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "link_monitoring_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_monitor_id" varchar NOT NULL,
	"status" text NOT NULL,
	"status_message" text,
	"link_found" boolean NOT NULL,
	"anchor_matched" boolean,
	"url_matched" boolean,
	"rel_attributes" text,
	"is_indexed" boolean,
	"index_check_error" text,
	"http_status_code" integer,
	"response_time_ms" integer,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"found_anchor_text" text
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"provider_account_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"access_token" varchar,
	"refresh_token" varchar,
	"expires_at" integer
);
--> statement-breakpoint
CREATE TABLE "marketplace_offers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" varchar NOT NULL,
	"marketplace_name" text NOT NULL,
	"marketplace_url" text,
	"show_price" boolean DEFAULT true NOT NULL,
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"gambling_min_price" numeric(10, 2),
	"gambling_max_price" numeric(10, 2),
	"adult_min_price" numeric(10, 2),
	"adult_max_price" numeric(10, 2),
	"cbd_min_price" numeric(10, 2),
	"cbd_max_price" numeric(10, 2),
	"loan_min_price" numeric(10, 2),
	"loan_max_price" numeric(10, 2),
	"dating_min_price" numeric(10, 2),
	"dating_max_price" numeric(10, 2),
	"crypto_min_price" numeric(10, 2),
	"crypto_max_price" numeric(10, 2),
	"trading_forex_min_price" numeric(10, 2),
	"trading_forex_max_price" numeric(10, 2),
	"delivery_time_days" integer,
	"requirements" text,
	"quality_score" integer,
	"available" boolean DEFAULT true NOT NULL,
	"price_source" text DEFAULT 'database',
	"last_fetched_at" timestamp,
	"sync_run_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP,
	"publication_type" text,
	"link_type" text,
	"word_count" text,
	"sponsored_tag" text,
	"duration" text,
	"link_no" text,
	"rejected_niche" text,
	"tat" text,
	"link_insertion_min_price" numeric(10, 2),
	"link_insertion_max_price" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" varchar PRIMARY KEY DEFAULT 'mysql_sync' NOT NULL,
	"last_processed_mysql_id" integer DEFAULT 0 NOT NULL,
	"total_records_processed" integer DEFAULT 0 NOT NULL,
	"total_domains_created" integer DEFAULT 0 NOT NULL,
	"total_offers_created" integer DEFAULT 0 NOT NULL,
	"last_sync_started_at" timestamp,
	"last_sync_completed_at" timestamp,
	"is_running" boolean DEFAULT false NOT NULL,
	"current_sync_run_id" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"preferred_currency" varchar DEFAULT 'USD' NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"welcome_email_sent" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"role" varchar DEFAULT 'client' NOT NULL,
	"status" varchar DEFAULT 'live' NOT NULL,
	"vendor_name" varchar,
	"company_id" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"topic" varchar NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" varchar DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_user_id" varchar NOT NULL,
	"vendor_user_id" varchar,
	"invite_token" varchar NOT NULL,
	"vendor_name" text NOT NULL,
	"vendor_email" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_invitations_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "supplier_offers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_user_id" varchar NOT NULL,
	"domain_id" varchar,
	"domain" text NOT NULL,
	"min_price" numeric(10, 2) NOT NULL,
	"max_price" numeric(10, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"gambling_min_price" numeric(10, 2),
	"gambling_max_price" numeric(10, 2),
	"adult_min_price" numeric(10, 2),
	"adult_max_price" numeric(10, 2),
	"cbd_min_price" numeric(10, 2),
	"cbd_max_price" numeric(10, 2),
	"loan_min_price" numeric(10, 2),
	"loan_max_price" numeric(10, 2),
	"dating_min_price" numeric(10, 2),
	"dating_max_price" numeric(10, 2),
	"crypto_min_price" numeric(10, 2),
	"crypto_max_price" numeric(10, 2),
	"trading_forex_min_price" numeric(10, 2),
	"trading_forex_max_price" numeric(10, 2),
	"delivery_time_days" integer,
	"content_included" boolean DEFAULT false NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'pending' NOT NULL,
	"link_insertion_min_price" numeric(10, 2),
	"link_insertion_max_price" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "api_billing_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"domain_id" bigint NOT NULL,
	"domain" text NOT NULL,
	"price_at_order" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"billed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_db_users" (
	"db_username" text PRIMARY KEY NOT NULL,
	"client_id" uuid
);
--> statement-breakpoint
CREATE TABLE "api_price_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"notification_type" text NOT NULL,
	"old_price" numeric(10, 2),
	"new_price" numeric(10, 2),
	"details" text,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_price_notifications_notification_type_check" CHECK (notification_type = ANY (ARRAY['price_increase'::text, 'order_cancelled'::text])),
	CONSTRAINT "api_price_notifications_status_check" CHECK (status = ANY (ARRAY['unread'::text, 'acknowledged'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "api_curated_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"domain" text NOT NULL,
	"org_traffic" bigint,
	"domain_rating" integer,
	"category" text,
	"allowed_niche" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"delivery_time_days" integer,
	"valid_until" timestamp with time zone,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_curated_domains_client_id_domain_key" UNIQUE("client_id","domain")
);
--> statement-breakpoint
ALTER TABLE "api_curated_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"domain_id" bigint,
	"domain" text NOT NULL,
	"target_url" text NOT NULL,
	"anchor_text" text NOT NULL,
	"article_body" text,
	"callback_url" text,
	"status" text DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"article_url" text,
	"client_order_ref" text,
	"offer_id" text,
	"published_url" text,
	"final_price" numeric(10, 2),
	"final_currency" varchar(3),
	"rejected_reason" text,
	"placed_at" timestamp with time zone,
	"idempotency_key" text,
	"metadata" jsonb,
	CONSTRAINT "api_orders_status_check" CHECK (status = ANY (ARRAY['received'::text, 'processing'::text, 'submitted_to_publisher'::text, 'live'::text, 'rejected'::text]))
);
--> statement-breakpoint
ALTER TABLE "api_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lp_domain_metrics_history" (
	"snapshotDate" date NOT NULL,
	"domainId" bigint NOT NULL,
	"domainRating" numeric(8, 2),
	"orgTraffic" bigint,
	"orgKeywords" bigint,
	"refDomains" bigint,
	"linkedDomains" bigint,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "lp_domain_metrics_history_pkey" PRIMARY KEY("snapshotDate","domainId")
);
--> statement-breakpoint
CREATE TABLE "lp_domain_info_history" (
	"snapshotDate" date NOT NULL,
	"domainId" bigint NOT NULL,
	"info" text,
	"allowedNiche" text,
	"rejectedNiche" text,
	"publicationType" text,
	"linkType" text,
	"TAT" text,
	"linkNo" text,
	"wordCount" text,
	"sponsoredTag" text,
	"duration" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "lp_domain_info_history_pkey" PRIMARY KEY("snapshotDate","domainId")
);
--> statement-breakpoint
CREATE TABLE "lp_marketplace_domains_history" (
	"snapshotDate" date NOT NULL,
	"id" bigint NOT NULL,
	"w" varchar(255) NOT NULL,
	"marketPlace" varchar(255) NOT NULL,
	"sourceName" text,
	"showPrice" "bytea" NOT NULL,
	"category" text,
	"country" varchar(255),
	"language" varchar(255),
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"scrapedAt" timestamp NOT NULL,
	"embeddings" vector(1536),
	"isActive" boolean NOT NULL,
	"lastSeenAt" timestamp NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "lp_marketplace_domains_history_pkey" PRIMARY KEY("snapshotDate","id")
);
--> statement-breakpoint
CREATE TABLE "lp_domain_price_history" (
	"snapshotDate" date NOT NULL,
	"domainId" bigint NOT NULL,
	"price" numeric(8, 2) NOT NULL,
	"secondPrice" numeric(8, 2),
	"thirdPrice" numeric(8, 2),
	"currency" char(255),
	"gambling" numeric(8, 2),
	"adult" numeric(8, 2),
	"cbd" numeric(8, 2),
	"loan" numeric(8, 2),
	"dating" numeric(8, 2),
	"crypto" numeric(8, 2),
	"tradingForex" numeric(8, 2),
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"isActive" boolean NOT NULL,
	"lastSeenAt" timestamp NOT NULL,
	CONSTRAINT "lp_domain_price_history_pkey" PRIMARY KEY("snapshotDate","domainId")
);
--> statement-breakpoint
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_deletion_requests" ADD CONSTRAINT "gdpr_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lp_domain_price" ADD CONSTRAINT "lp_domain_price_domainid_foreign" FOREIGN KEY ("domainId") REFERENCES "public"."lp_marketplace_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_consent_events" ADD CONSTRAINT "gdpr_consent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_data_exports" ADD CONSTRAINT "gdpr_data_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lp_domain_metrics" ADD CONSTRAINT "lp_domain_metrics_domainid_foreign" FOREIGN KEY ("domainId") REFERENCES "public"."lp_marketplace_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lp_domain_info" ADD CONSTRAINT "lp_domain_info_domainid_foreign" FOREIGN KEY ("domainId") REFERENCES "public"."lp_marketplace_domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_monitors" ADD CONSTRAINT "link_monitors_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_monitors" ADD CONSTRAINT "link_monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_price_history" ADD CONSTRAINT "marketplace_price_history_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_responses" ADD CONSTRAINT "onboarding_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey_credentials" ADD CONSTRAINT "passkey_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_clicks" ADD CONSTRAINT "marketplace_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_clicks" ADD CONSTRAINT "marketplace_clicks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_events" ADD CONSTRAINT "user_activity_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_monitoring_checks" ADD CONSTRAINT "link_monitoring_checks_link_monitor_id_link_monitors_id_fk" FOREIGN KEY ("link_monitor_id") REFERENCES "public"."link_monitors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_offers" ADD CONSTRAINT "marketplace_offers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invitations" ADD CONSTRAINT "supplier_invitations_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invitations" ADD CONSTRAINT "supplier_invitations_vendor_user_id_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_vendor_user_id_users_id_fk" FOREIGN KEY ("vendor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_billing_ledger" ADD CONSTRAINT "api_billing_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."api_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_billing_ledger" ADD CONSTRAINT "api_billing_ledger_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_db_users" ADD CONSTRAINT "agency_db_users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_price_notifications" ADD CONSTRAINT "api_price_notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."api_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_price_notifications" ADD CONSTRAINT "api_price_notifications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_curated_domains" ADD CONSTRAINT "api_curated_domains_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_orders" ADD CONSTRAINT "api_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_request_logs_api_key_id_idx" ON "api_request_logs" USING btree ("api_key_id" text_ops);--> statement-breakpoint
CREATE INDEX "api_request_logs_created_at_idx" ON "api_request_logs" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "api_request_logs_user_id_idx" ON "api_request_logs" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "gdpr_deletion_requests_user_id_idx" ON "gdpr_deletion_requests" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire" timestamp_ops);--> statement-breakpoint
CREATE INDEX "blog_published_date_idx" ON "blog_posts" USING btree ("published" timestamp_ops,"published_at" bool_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "blog_slug_idx" ON "blog_posts" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_price_active" ON "lp_domain_price" USING btree ("isActive" numeric_ops,"price" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_marketplace_date" ON "lp_updates_log" USING btree ("marketPlace" date_ops,"scrapedDate" date_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_active_domains" ON "lp_marketplace_domains" USING btree ("isActive" bool_ops,"lastSeenAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_category" ON "lp_marketplace_domains" USING btree ("category" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_country" ON "lp_marketplace_domains" USING btree ("country" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_domain_name" ON "lp_marketplace_domains" USING btree ("w" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_marketplace" ON "lp_marketplace_domains" USING btree ("marketPlace" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lp_marketplace_domains_unique" ON "lp_marketplace_domains" USING btree (w text_ops,marketPlace text_ops,COALESCE("sourceName", ''::text) text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_domain_lookup" ON "lp_domain_categories" USING btree ("w" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_tld" ON "lp_domain_categories" USING btree ("tld" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "unique_benchmark_idx" ON "market_benchmarks" USING btree ("country" text_ops,"category" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_domains_country" ON "domains" USING btree ("country_main_traffic" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_domains_embedding" ON "domains" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "IDX_domains_keywords" ON "domains" USING btree ("org_keywords" int8_ops);--> statement-breakpoint
CREATE INDEX "IDX_domains_rating" ON "domains" USING btree ("domain_rating" int4_ops);--> statement-breakpoint
CREATE INDEX "IDX_domains_traffic" ON "domains" USING btree ("org_traffic" int8_ops);--> statement-breakpoint
CREATE INDEX "gdpr_consent_events_created_at_idx" ON "gdpr_consent_events" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "gdpr_consent_events_user_id_idx" ON "gdpr_consent_events" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "gdpr_consents_anonymous_id_idx" ON "gdpr_consents" USING btree ("anonymous_id" text_ops);--> statement-breakpoint
CREATE INDEX "gdpr_consents_user_id_idx" ON "gdpr_consents" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "gdpr_data_exports_user_id_idx" ON "gdpr_data_exports" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_domain_rating" ON "lp_domain_metrics" USING btree ("domainRating" numeric_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_org_traffic" ON "lp_domain_metrics" USING btree ("orgTraffic" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_ai_metrics_embeddings_hnsw" ON "lp_domain_ai_metrics" USING hnsw ("embeddings" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "cache_expires_at_idx" ON "marketplace_price_cache" USING btree ("expires_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "domain_marketplace_cache_idx" ON "marketplace_price_cache" USING btree ("domain" text_ops,"marketplace_name" text_ops);--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash" text_ops);--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_domain_idx" ON "favorites" USING btree ("user_id" text_ops,"domain_id" text_ops);--> statement-breakpoint
CREATE INDEX "link_monitors_next_check_idx" ON "link_monitors" USING btree ("next_check_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "link_monitors_order_idx" ON "link_monitors" USING btree ("order_id" text_ops);--> statement-breakpoint
CREATE INDEX "link_monitors_status_idx" ON "link_monitors" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "link_monitors_user_idx" ON "link_monitors" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "price_history_domain_date_idx" ON "marketplace_price_history" USING btree ("domain_id" text_ops,"change_date" text_ops);--> statement-breakpoint
CREATE INDEX "event_type_timestamp_idx" ON "user_activity_events" USING btree ("event_type" text_ops,"timestamp" text_ops);--> statement-breakpoint
CREATE INDEX "user_timestamp_idx" ON "user_activity_events" USING btree ("user_id" text_ops,"timestamp" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "external_url_embeddings_url_idx" ON "external_url_embeddings" USING btree ("url" text_ops);--> statement-breakpoint
CREATE INDEX "link_checks_monitor_date_idx" ON "link_monitoring_checks" USING btree ("link_monitor_id" text_ops,"checked_at" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_idx" ON "oauth_accounts" USING btree ("provider" text_ops,"provider_account_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "domain_marketplace_idx" ON "marketplace_offers" USING btree ("domain_id" text_ops,"marketplace_name" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_invitations_client_user_id_idx" ON "supplier_invitations" USING btree ("client_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_invitations_token_idx" ON "supplier_invitations" USING btree ("invite_token" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_invitations_vendor_user_id_idx" ON "supplier_invitations" USING btree ("vendor_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_offers_domain_id_idx" ON "supplier_offers" USING btree ("domain_id" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_offers_domain_idx" ON "supplier_offers" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "supplier_offers_vendor_user_id_idx" ON "supplier_offers" USING btree ("vendor_user_id" text_ops);--> statement-breakpoint
CREATE INDEX "api_billing_ledger_billed_at_idx" ON "api_billing_ledger" USING btree ("billed_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "api_billing_ledger_client_id_idx" ON "api_billing_ledger" USING btree ("client_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_billing_ledger_order_id_idx" ON "api_billing_ledger" USING btree ("order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_price_notifications_client_idx" ON "api_price_notifications" USING btree ("client_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_price_notifications_order_idx" ON "api_price_notifications" USING btree ("order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_price_notifications_status_idx" ON "api_price_notifications" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "api_curated_domains_client_idx" ON "api_curated_domains" USING btree ("client_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_curated_domains_domain_idx" ON "api_curated_domains" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "api_orders_client_id_idx" ON "api_orders" USING btree ("client_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "api_orders_status_idx" ON "api_orders" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_metrics_history_domain" ON "lp_domain_metrics_history" USING btree ("domainId" date_ops,"snapshotDate" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_metrics_history_snapshot" ON "lp_domain_metrics_history" USING btree ("snapshotDate" date_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_info_history_domain" ON "lp_domain_info_history" USING btree ("domainId" date_ops,"snapshotDate" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_info_history_snapshot" ON "lp_domain_info_history" USING btree ("snapshotDate" date_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_domains_history_domain" ON "lp_marketplace_domains_history" USING btree ("w" text_ops,"snapshotDate" date_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_domains_history_snapshot" ON "lp_marketplace_domains_history" USING btree ("snapshotDate" date_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_price_history_domain" ON "lp_domain_price_history" USING btree ("domainId" date_ops,"snapshotDate" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_lp_price_history_snapshot" ON "lp_domain_price_history" USING btree ("snapshotDate" date_ops);--> statement-breakpoint
CREATE VIEW "public"."dominic_live_catalog" AS (SELECT d.id AS domain_id, d.w AS domain, min(p.price::double precision) AS price, TRIM(BOTH FROM COALESCE(max(p.currency), 'EUR'::bpchar)) AS currency, m."domainRating"::double precision AS dr, m."orgTraffic" AS monthly_traffic, d.category AS niche_category, d.country FROM lp_marketplace_domains d JOIN lp_domain_price p ON p."domainId" = d.id LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id WHERE d."isActive" = true AND p."isActive" = true AND d."deletedAt" IS NULL GROUP BY d.id, d.w, m."domainRating", m."orgTraffic", d.category, d.country);--> statement-breakpoint
CREATE VIEW "public"."adaptify_guest_post_offers" AS (SELECT concat('lp_', d.id::text) AS offer_id, d.w AS domain, true AS orderable, true AS is_guest_post, 'guest_post'::text AS placement_type, min(p.price::numeric) AS price, TRIM(BOTH FROM COALESCE(max(p.currency), 'EUR'::bpchar)) AS currency, m."domainRating"::numeric AS dr, m."orgTraffic" AS monthly_traffic, d.category AS niche, d.language, d.country AS country_code, 14 AS turnaround_days, true AS accepts_client_article, true AS will_write_article, 1 AS max_links, max(p."updatedAt") AS last_verified_at FROM lp_marketplace_domains d JOIN lp_domain_price p ON p."domainId" = d.id LEFT JOIN lp_domain_metrics m ON m."domainId" = d.id WHERE d."isActive" = true AND p."isActive" = true AND d."deletedAt" IS NULL GROUP BY d.id, d.w, m."domainRating", m."orgTraffic", d.category, d.language, d.country);--> statement-breakpoint
CREATE POLICY "agency_catalog_policy" ON "api_curated_domains" AS PERMISSIVE FOR SELECT TO "agency_readonly_client" USING (((client_id IS NULL) OR (client_id = ( SELECT agency_db_users.client_id
   FROM agency_db_users
  WHERE (agency_db_users.db_username = CURRENT_USER)))));
*/