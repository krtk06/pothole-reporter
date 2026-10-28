ALTER TABLE "users"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "state" VARCHAR(120),
  ADD COLUMN "district" VARCHAR(120),
  ADD COLUMN "locality" VARCHAR(160);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
