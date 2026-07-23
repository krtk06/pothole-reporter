import prisma from "../config/database";
import { notifyExternalWebhook } from "./externalWebhookService";

const THRESHOLD = parseInt(process.env.POTHOLE_TENDER_THRESHOLD || "5", 10);
const COST_PER_POTHOLE = 150.0;

export async function checkAndGenerateTender(blockId: string): Promise<boolean> {
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::bigint as count
    FROM potholes
    WHERE block_id = $1
      AND status = 'verified'
  `, blockId);

  const count = Number(result[0]?.count || 0);

  if (count >= THRESHOLD) {
    const existingTender = await prisma.tender.findFirst({
      where: { block_id: blockId, status: { in: ["open", "assigned"] } },
    });

    if (!existingTender) {
      await prisma.tender.create({
        data: {
          block_id: blockId,
          pothole_count: count,
          estimated_cost: count * COST_PER_POTHOLE,
        },
      });
      // Notify external website — non-blocking
      notifyExternalWebhook(blockId).catch(() => {});
      return true;
    }
  }
  return false;
}

export async function getTenders() {
  return prisma.tender.findMany({
    orderBy: { generated_at: "desc" },
  });
}
