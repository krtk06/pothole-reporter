-- Guard the tender pipeline against duplicate tenders for the same block.
--
-- checkAndGenerateTender (services/tenderService.ts) is check-then-act: it
-- looks for an existing open/assigned tender and then inserts one. Two admins
-- verifying the final potholes of a block concurrently both observe "no tender"
-- and both insert, producing duplicate tenders and duplicate outbound pushes.
--
-- The index is deliberately PARTIAL (open/assigned only) because a withdrawn
-- tender is marked 'rejected' by design (routes/admin.ts POST /tenders/:id/withdraw)
-- and must stay re-tenderable: checkAndGenerateTender only looks for open/assigned
-- tenders, so after a withdrawal the same block must be able to receive a new
-- one. A full unique index on block_id would break that flow.
--
-- Prisma has no first-class partial-index support, so this index is intentionally
-- absent from schema.prisma. `prisma migrate diff` will report it as drift; that
-- is expected and it must not be "corrected" by dropping the index.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "tenders"
    WHERE "status" IN ('open', 'assigned')
    GROUP BY "block_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate open/assigned tenders exist — resolve them manually before relying on the unique index below.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "tenders_block_id_open_assigned_key"
  ON "tenders" ("block_id")
  WHERE "status" IN ('open', 'assigned');