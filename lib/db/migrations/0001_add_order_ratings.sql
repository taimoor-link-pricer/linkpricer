-- Custom SQL migration file, put your code below! --
CREATE TABLE "order_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_ratings_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "order_ratings_rating_check" CHECK (rating >= 1 AND rating <= 5)
);
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "order_ratings" ADD CONSTRAINT "order_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
