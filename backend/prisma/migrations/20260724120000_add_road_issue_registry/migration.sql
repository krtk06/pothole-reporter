-- Keep individual submissions as evidence, while road_issues holds one canonical
-- map marker for a physically verified road problem.
CREATE TYPE "RoadIssueStatus" AS ENUM ('active', 'fixed', 'dismissed');
CREATE TYPE "DeduplicationState" AS ENUM ('new', 'reused', 'not_an_issue');

CREATE TABLE "road_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "condition" VARCHAR(64) NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "severity_score" DECIMAL(5,2),
    "pothole_count" INTEGER NOT NULL DEFAULT 1,
    "confidence" DECIMAL(5,4),
    "status" "RoadIssueStatus" NOT NULL DEFAULT 'active',
    "model_version" VARCHAR(128),
    "analysis" JSONB,
    "evidence_count" INTEGER NOT NULL DEFAULT 1,
    "first_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_issues_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "potholes"
  ADD COLUMN "canonical_issue_id" UUID,
  ADD COLUMN "deduplication_state" "DeduplicationState" NOT NULL DEFAULT 'new',
  ADD COLUMN "ai_result" JSONB;

ALTER TABLE "potholes"
  ADD CONSTRAINT "potholes_canonical_issue_id_fkey"
  FOREIGN KEY ("canonical_issue_id") REFERENCES "road_issues"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "road_issues_location_gist_idx" ON "road_issues" USING GIST ("location");
CREATE INDEX "road_issues_active_recent_idx" ON "road_issues" ("status", "last_detected_at" DESC);
CREATE INDEX "potholes_canonical_issue_id_idx" ON "potholes" ("canonical_issue_id");
