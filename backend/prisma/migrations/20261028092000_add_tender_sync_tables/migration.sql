-- Tender website sync settings/logs. These tables previously existed only at
-- runtime in the older backend; the handoff database has no migration for them.
CREATE TABLE IF NOT EXISTS "tender_sync_settings" (
  "id" VARCHAR(50) NOT NULL,
  "target_url" TEXT NOT NULL DEFAULT 'http://localhost:3001/api/sync',
  "api_key" VARCHAR(255) NOT NULL DEFAULT '',
  "sync_interval_days" INTEGER NOT NULL DEFAULT 15,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_sync_at" TIMESTAMP(6) WITH TIME ZONE,
  "next_sync_at" TIMESTAMP(6) WITH TIME ZONE,
  "last_sync_status" VARCHAR(50) DEFAULT 'idle',
  "last_sync_message" TEXT,
  "sync_lock_until" TIMESTAMP(6) WITH TIME ZONE,
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tender_sync_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tender_sync_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "synced_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "potholes_count" INTEGER NOT NULL DEFAULT 0,
  "tenders_count" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(50) NOT NULL,
  "response_status" INTEGER,
  "error_message" TEXT,
  "triggered_by" VARCHAR(255) NOT NULL DEFAULT 'scheduler',
  CONSTRAINT "tender_sync_logs_pkey" PRIMARY KEY ("id")
);

-- Older deployments may have created these tables at runtime without the
-- lock/backoff columns. CREATE TABLE IF NOT EXISTS would silently leave them
-- out, so add them explicitly.
ALTER TABLE "tender_sync_settings"
  ADD COLUMN IF NOT EXISTS "sync_lock_until" TIMESTAMP(6) WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_sync_message" TEXT,
  ADD COLUMN IF NOT EXISTS "last_sync_status" VARCHAR(50) DEFAULT 'idle';

ALTER TABLE "tender_sync_logs"
  ADD COLUMN IF NOT EXISTS "response_status" INTEGER,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "triggered_by" VARCHAR(255) NOT NULL DEFAULT 'scheduler';

CREATE INDEX IF NOT EXISTS "tender_sync_logs_synced_at_idx"
  ON "tender_sync_logs" ("synced_at" DESC);

-- Seed only when absent; never overwrite an operator's configured URL/key.
INSERT INTO "tender_sync_settings" (
  "id", "target_url", "api_key", "sync_interval_days", "is_enabled",
  "next_sync_at", "last_sync_status"
)
SELECT
  'default', 'http://localhost:3001/api/sync', '', 15, TRUE,
  NOW() + INTERVAL '15 days', 'idle'
WHERE NOT EXISTS (SELECT 1 FROM "tender_sync_settings" WHERE "id" = 'default');

CREATE INDEX IF NOT EXISTS "tenders_block_id_status_idx"
  ON "tenders" ("block_id", "status");

-- Only one open/assigned tender per block. Partial is required: a withdrawn
-- tender is marked `rejected` and must remain re-tenderable. If historical
-- duplicates already exist, do not delete them; raise a notice and let the
-- deployment verification fail until an operator resolves them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "tenders"
    WHERE "status" IN ('open', 'assigned')
    GROUP BY "block_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate open/assigned tenders exist; partial unique index was not created. Resolve duplicates before enabling it.';
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "tenders_block_id_open_assigned_key" ON "tenders" ("block_id") WHERE "status" IN (''open'', ''assigned'')';
  END IF;
END $$;
