-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('public', 'admin');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('light', 'dark');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'verified', 'rejected', 'fixed');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('open', 'assigned', 'completed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'public',
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "theme_preference" "ThemePreference" NOT NULL DEFAULT 'light',
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potholes" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "image_s3_key" VARCHAR(255) NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "address_notes" TEXT,
    "block_id" VARCHAR(100),
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "potholes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "block_id" VARCHAR(100) NOT NULL,
    "pothole_count" INTEGER NOT NULL,
    "estimated_cost" DECIMAL(10,2) NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'open',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "potholes" ADD CONSTRAINT "potholes_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
