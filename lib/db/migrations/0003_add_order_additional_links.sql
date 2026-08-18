-- Custom SQL migration file, put your code below! --
ALTER TABLE "orders" ADD COLUMN "additional_links" jsonb;
