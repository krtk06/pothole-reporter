-- Road issues are the public, deduplicated map layer. Store the jurisdiction
-- alongside the issue so public filters do not need to join every evidence row.
ALTER TABLE "road_issues" ADD COLUMN IF NOT EXISTS "block_id" VARCHAR(100);
ALTER TABLE "administrative_areas" ADD COLUMN IF NOT EXISTS "bbox" JSONB;

UPDATE "road_issues" AS ri
SET "block_id" = src."block_id"
FROM (
  SELECT DISTINCT ON ("canonical_issue_id")
    "canonical_issue_id", "block_id"
  FROM "potholes"
  WHERE "canonical_issue_id" IS NOT NULL AND "block_id" IS NOT NULL
  ORDER BY "canonical_issue_id", "created_at" ASC
) AS src
WHERE ri."id" = src."canonical_issue_id" AND ri."block_id" IS NULL;

CREATE INDEX IF NOT EXISTS "road_issues_block_id_idx" ON "road_issues" ("block_id");
CREATE INDEX IF NOT EXISTS "potholes_reporter_id_idx" ON "potholes" ("reporter_id");
CREATE INDEX IF NOT EXISTS "potholes_block_id_idx" ON "potholes" ("block_id");
CREATE INDEX IF NOT EXISTS "potholes_status_idx" ON "potholes" ("status");
CREATE INDEX IF NOT EXISTS "potholes_created_at_idx" ON "potholes" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "potholes_canonical_issue_id_idx" ON "potholes" ("canonical_issue_id");
