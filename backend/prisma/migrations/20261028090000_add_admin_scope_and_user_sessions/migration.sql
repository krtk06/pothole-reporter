-- Additive migration for the live database.
--
-- The live database may have either the handoff `locality` column or the older
-- `mandal` column, and `admin_scope` may be a VARCHAR or the older AdminScope
-- enum. This migration reconciles both without dropping data or touching
-- passwords/roles.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locality" VARCHAR(160);

-- If the older `mandal` column exists, mirror it into `locality` (the API's
-- underlying mandal value). Do not overwrite an existing locality.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'mandal'
  ) THEN
    EXECUTE 'UPDATE "users" SET "locality" = "mandal"
             WHERE "locality" IS NULL AND "mandal" IS NOT NULL';
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_scope" VARCHAR(32);

-- Normalise the older enum to VARCHAR so the API and Prisma model agree.
DO $$
DECLARE column_type text;
BEGIN
  SELECT udt_name INTO column_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'admin_scope';

  IF column_type = 'AdminScope' THEN
    EXECUTE 'ALTER TABLE "users"
             ALTER COLUMN "admin_scope" TYPE VARCHAR(32)
             USING "admin_scope"::text';
  END IF;
END $$;

UPDATE "users"
SET "admin_scope" = CASE
  WHEN NULLIF(TRIM("district"), '') IS NOT NULL
   AND NULLIF(TRIM("locality"), '') IS NOT NULL THEN 'mandal'
  WHEN NULLIF(TRIM("district"), '') IS NOT NULL THEN 'district'
  WHEN NULLIF(TRIM("district"), '') IS NULL
   AND NULLIF(TRIM("locality"), '') IS NULL THEN 'state'
  ELSE NULL
END
WHERE "role" = 'admin' AND "admin_scope" IS NULL;

-- Enforced for new rows. Existing rows are left untouched so a malformed
-- legacy admin cannot block the migration; verify:deploy reports those rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_admin_scope_fields_check'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_admin_scope_fields_check"
      CHECK (
        "admin_scope" IS NULL
        OR ("admin_scope" = 'state' AND NULLIF(TRIM("district"), '') IS NULL AND NULLIF(TRIM("locality"), '') IS NULL)
        OR ("admin_scope" = 'district' AND NULLIF(TRIM("district"), '') IS NOT NULL AND NULLIF(TRIM("locality"), '') IS NULL)
        OR ("admin_scope" = 'mandal' AND NULLIF(TRIM("district"), '') IS NOT NULL AND NULLIF(TRIM("locality"), '') IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_admin_scope_idx" ON "users" ("admin_scope");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");

-- Sessions allow citizens to stay signed in on multiple devices while admins
-- are limited to one active session. The old users.refresh_token column is
-- retained for a grace period but is no longer authoritative.
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "refresh_token_hash" VARCHAR(64) NOT NULL,
  "user_agent" VARCHAR(512),
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(6) WITH TIME ZONE,
  "expires_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  "revoked_at" TIMESTAMP(6) WITH TIME ZONE,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_refresh_token_hash_key"
  ON "user_sessions" ("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions" ("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE "user_sessions"
      ADD CONSTRAINT "user_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
