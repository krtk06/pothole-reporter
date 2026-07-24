-- Administrative location directory and geocode cache.
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TABLE IF NOT EXISTS "administrative_areas" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "normalized_name" VARCHAR(255) NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "state_code" VARCHAR(20) NOT NULL,
    "state_name" VARCHAR(100) NOT NULL,
    "district_code" VARCHAR(20),
    "district_name" VARCHAR(100),
    "subdistrict_code" VARCHAR(20),
    "subdistrict_name" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bbox" JSONB,
    "boundary" geometry(MultiPolygon, 4326),
    "source" VARCHAR(255) NOT NULL DEFAULT 'LGD administrative directory',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administrative_areas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "administrative_areas_level_check" CHECK ("level" IN ('state', 'district', 'subdistrict', 'village'))
);

CREATE INDEX IF NOT EXISTS "administrative_areas_level_hierarchy_idx"
ON "administrative_areas" ("level", "state_code", "district_code", "subdistrict_code", "normalized_name");

CREATE INDEX IF NOT EXISTS "administrative_areas_district_idx"
ON "administrative_areas" ("district_code", "normalized_name");

CREATE INDEX IF NOT EXISTS "administrative_areas_subdistrict_idx"
ON "administrative_areas" ("subdistrict_code", "normalized_name");

CREATE INDEX IF NOT EXISTS "administrative_areas_boundary_gist_idx"
ON "administrative_areas" USING GIST ("boundary");
