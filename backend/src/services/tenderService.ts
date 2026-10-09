import prisma from "../config/database";
import logger from "../config/logger";
import { pushBlockToTenderWebsite } from "./tenderSyncService";

const THRESHOLD = parseInt(process.env.POTHOLE_TENDER_THRESHOLD || "5", 10);
const COST_PER_POTHOLE = 150.0;

/** Prisma's unique-constraint violation code. */
const P2002 = "P2002";

export async function checkAndGenerateTender(blockId: string): Promise<boolean> {
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::bigint as count
    FROM potholes
    WHERE block_id = $1
      AND status = 'verified'
  `, blockId);

  const count = Number(result[0]?.count || 0);

  if (count < THRESHOLD) {
    return false;
  }

  const existingTender = await prisma.tender.findFirst({
    where: { block_id: blockId, status: { in: ["open", "assigned"] } },
  });

  if (existingTender) {
    return false;
  }

  try {
    await prisma.tender.create({
      data: {
        block_id: blockId,
        pothole_count: count,
        estimated_cost: count * COST_PER_POTHOLE,
      },
    });
  } catch (err: any) {
    // The read above is not atomic with this insert. When two verifies for the
    // same block race, the partial unique index
    // "tenders_block_id_open_assigned_key" rejects the loser — which is the
    // correct outcome, since the winner already created the tender. Treat it as
    // "a tender now exists" rather than an error.
    if (err?.code === P2002) {
      logger.info({ blockId }, "Tender already created concurrently for block");
      return false;
    }
    throw err;
  }

  // Push block to tender website immediately — non-blocking
  pushBlockToTenderWebsite(blockId, "threshold").catch(() => {});
  return true;
}

export async function getTenders() {
  return prisma.tender.findMany({
    orderBy: { generated_at: "desc" },
  });
}
