CREATE TABLE "administrative_areas" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "normalized_name" VARCHAR(255) NOT NULL,
    "level" VARCHAR(24) NOT NULL,
    "state_code" VARCHAR(32),
    "state_name" VARCHAR(255),
    "district_code" VARCHAR(32),
    "district_name" VARCHAR(255),
    "subdistrict_code" VARCHAR(32),
    "subdistrict_name" VARCHAR(255),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "boundary" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "administrative_areas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "administrative_areas_level_state_name_normalized_name_idx"
  ON "administrative_areas"("level", "state_name", "normalized_name");
CREATE INDEX "administrative_areas_level_state_name_district_name_normalized_name_idx"
  ON "administrative_areas"("level", "state_name", "district_name", "normalized_name");
CREATE INDEX "administrative_areas_level_state_name_district_name_subdistrict_name_normalized_name_idx"
  ON "administrative_areas"("level", "state_name", "district_name", "subdistrict_name", "normalized_name");
