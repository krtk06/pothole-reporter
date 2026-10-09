-- Bring tender_sync_settings and tender_sync_logs under the migration history.
--
-- Both tables are created at runtime by ensureTenderSyncTablesExist()
-- (src/services/tenderSyncService.ts:42-68) and therefore appear in no
-- migration. A `prisma migrate deploy` against a clean database produced a
-- schema missing both tables; they only came into existence when the app
-- handled its first sync request.
--
-- IF NOT EXISTS is required, not stylistic: these tables already exist in
-- deployed environments (created by that runtime call), so a plain
-- CREATE TABLE would abort the deploy. The runtime creation is left in place
-- as an idempotent safety net.
--
-- The DDL below is byte-for-byte the same as the runtime statements, so the
-- migration is a no-op against an already-initialised database and creates the
-- tables from scratch otherwise.

CREATE TABLE IF NOT EXISTS tender_sync_settings (
  id VARCHAR(50) PRIMARY KEY,
  target_url TEXT NOT NULL DEFAULT 'http://localhost:3001/api/sync',
  api_key VARCHAR(255) NOT NULL DEFAULT '',
  sync_interval_days INT NOT NULL DEFAULT 15,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  last_sync_status VARCHAR(50) DEFAULT 'idle',
  last_sync_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tender_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  potholes_count INT NOT NULL DEFAULT 0,
  tenders_count INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL,
  response_status INT,
  error_message TEXT,
  triggered_by VARCHAR(255) NOT NULL DEFAULT 'scheduler'
);

-- Seed the single settings row, matching the runtime seed so the two paths
-- cannot diverge. Idempotent: a deployed database already has this row.
INSERT INTO tender_sync_settings (
  id, target_url, api_key, sync_interval_days, is_enabled, next_sync_at, last_sync_status
)
SELECT
  'default',
  'http://localhost:3001/api/sync',
  '',
  15,
  true,
  NOW() + INTERVAL '15 days',
  'idle'
WHERE NOT EXISTS (SELECT 1 FROM tender_sync_settings WHERE id = 'default');