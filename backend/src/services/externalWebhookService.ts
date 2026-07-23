import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "./s3Service";

/**
 * Notifies an external website when a tender threshold is reached for a block.
 * Sends all pothole details (location, images, notes, status) for that block.
 * Uses EXTERNAL_WEBHOOK_URL and EXTERNAL_API_KEY environment variables.
 * Non-blocking — errors are logged but do not fail the main request.
 */
export async function notifyExternalWebhook(blockId: string): Promise<void> {
  const webhookUrl = process.env.EXTERNAL_WEBHOOK_URL;
  const apiKey = process.env.EXTERNAL_API_KEY;

  if (!webhookUrl || !apiKey) {
    logger.warn({ blockId }, "External webhook not configured (EXTERNAL_WEBHOOK_URL or EXTERNAL_API_KEY missing)");
    return;
  }

  try {
    // Fetch all verified potholes for this block
    const potholes: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        p.image_s3_key,
        ST_X(p.location::geometry) as longitude,
        ST_Y(p.location::geometry) as latitude,
        p.address_notes,
        p.block_id,
        p.status,
        p.created_at,
        u.name as reporter_name,
        u.email as reporter_email
      FROM potholes p
      JOIN users u ON u.id = p.reporter_id
      WHERE p.block_id = $1 AND p.status = 'verified'
      ORDER BY p.created_at DESC
    `, blockId);

    // Enrich with presigned image URLs
    const enriched = await Promise.all(
      potholes.map(async (p: any) => ({
        id: p.id,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        address_notes: p.address_notes,
        block_id: p.block_id,
        status: p.status,
        created_at: p.created_at,
        reporter_name: p.reporter_name,
        image_url: await generatePresignedDownloadUrl(p.image_s3_key).catch(() => null),
        image_s3_key: p.image_s3_key,
      }))
    );

    const payload = {
      block_id: blockId,
      total_potholes: enriched.length,
      triggered_at: new Date().toISOString(),
      potholes: enriched,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Source": "pothole-reporter",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      logger.info({ blockId, status: response.status }, "External webhook notified successfully");
    } else {
      logger.warn({ blockId, status: response.status }, "External webhook responded with non-2xx status");
    }
  } catch (err) {
    logger.error({ err, blockId }, "Failed to notify external webhook (non-blocking)");
  }
}
