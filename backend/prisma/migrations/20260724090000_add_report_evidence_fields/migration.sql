ALTER TABLE "potholes"
  ADD COLUMN "report_type" VARCHAR(20) NOT NULL DEFAULT 'single',
  ADD COLUMN "evidence_metadata" JSONB;
