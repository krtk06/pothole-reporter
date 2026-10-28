import prisma from "../config/database";
import logger from "../config/logger";
import { buildBlockId } from "./geoService";

const COST_PER_POTHOLE = Number(process.env.TENDER_COST_PER_POTHOLE || 15_000);

function threshold(): number {
  const value = Number(process.env.POTHOLE_TENDER_THRESHOLD || 20);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

function costFor(count: number): number {
  return count * COST_PER_POTHOLE;
}

async function verifiedCount(blockId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM potholes WHERE block_id = $1 AND status = 'verified'`,
    blockId,
  );
  return Number(rows[0]?.count || 0);
}

async function findOpenTender(blockId: string) {
  return prisma.tender.findFirst({
    where: { block_id: blockId, status: { in: ["open", "assigned"] } },
    orderBy: { generated_at: "desc" },
  });
}

export async function hasOpenTender(blockId: string): Promise<boolean> {
  return Boolean(await findOpenTender(blockId));
}

/**
 * Create a tender once a block crosses the configured threshold. The partial
 * unique index on (block_id) WHERE status IN ('open','assigned') is the real
 * guard; the findFirst check only avoids the common-case error.
 */
export async function checkAndGenerateTender(blockId: string): Promise<boolean> {
  const count = await verifiedCount(blockId);
  if (count < threshold()) return false;
  if (await findOpenTender(blockId)) return false;

  try {
    await prisma.tender.create({
      data: {
        block_id: blockId,
        pothole_count: count,
        estimated_cost: costFor(count),
        status: "open",
      },
    });
    return true;
  } catch (err: any) {
    if (err?.code === "P2002") {
      logger.info({ blockId }, "Tender already exists for block (race resolved)");
      return false;
    }
    throw err;
  }
}

export async function getTenders() {
  return prisma.tender.findMany({ orderBy: { generated_at: "desc" } });
}

export async function dispatchTenderForMandal(params: {
  state?: string | null;
  district?: string | null;
  mandal: string;
  initiatedBy: string;
}): Promise<{
  tenderId: string;
  block_id: string;
  pothole_count: number;
  estimated_cost: number;
  status: string;
}> {
  const blockId = buildBlockId(params.state, params.district, params.mandal);
  if (!blockId) throw new Error("A valid mandal is required to dispatch a tender");

  const count = await verifiedCount(blockId);
  if (count === 0) {
    throw new Error(`No verified potholes exist in ${blockId}; no tender was created`);
  }

  const existing = await findOpenTender(blockId);
  const tender = existing || await prisma.tender.create({
    data: {
      block_id: blockId,
      pothole_count: count,
      estimated_cost: costFor(count),
      status: "open",
    },
  });

  logger.info({ tenderId: tender.id, blockId, initiatedBy: params.initiatedBy }, "Tender dispatched");
  return {
    tenderId: tender.id,
    block_id: tender.block_id,
    pothole_count: tender.pothole_count,
    estimated_cost: Number(tender.estimated_cost),
    status: tender.status,
  };
}

export { COST_PER_POTHOLE };
