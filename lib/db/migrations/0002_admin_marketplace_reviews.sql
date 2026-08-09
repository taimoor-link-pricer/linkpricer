-- Custom SQL migration file, put your code below! --
ALTER TABLE "order_ratings" ALTER COLUMN "order_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD COLUMN "marketplace_name" text;
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD COLUMN "source" text DEFAULT 'buyer' NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_source_check" CHECK (source IN ('buyer', 'admin'));
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_attribution_check" CHECK (order_id IS NOT NULL OR marketplace_name IS NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "order_ratings_admin_marketplace_idx" ON "order_ratings" ("user_id", "marketplace_name") WHERE "order_id" IS NULL;
