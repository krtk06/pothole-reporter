-- Reconcile schema drift: the AdminScope enum, the users jurisdiction columns
-- (state/district/mandal/admin_scope) and the TenderStatus 'rejected' value
-- were missing from the migration history although the Prisma schema and the
-- application code rely on them (previously applied to existing environments
-- by hand). All statements are guarded to be idempotent.

DO $$ BEGIN
  CREATE TYPE "AdminScope" AS ENUM ('mandal', 'district', 'state');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "state" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "district" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "mandal" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "admin_scope" "AdminScope";

ALTER TYPE "TenderStatus" ADD VALUE IF NOT EXISTS 'rejected';
