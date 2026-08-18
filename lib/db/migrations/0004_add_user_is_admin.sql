-- Custom SQL migration file, put your code below! --
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;

-- Backfill: existing admins (role = 'vendor') keep working exactly as
-- before -- requireAdminSession() switches to checking is_admin instead of
-- role, so without this backfill every current admin would be locked out.
UPDATE "users" SET "is_admin" = true WHERE "role" = 'vendor';