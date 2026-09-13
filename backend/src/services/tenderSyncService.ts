import prisma from "../config/database";
import logger from "../config/logger";
import { generatePresignedDownloadUrl } from "./s3Service";

export interface TenderSyncSettings {
  id: string;
  target_url: string;
  api_key: string;
  sync_interval_days: number;
  is_enabled: boolean;
  last_sync_at: string | null;
  next_sync_at: string | null;
  last_sync_status: string;
  last_sync_message: string | null;
  updated_at: string;
}

export interface TenderSyncLog {
  id: string;
  synced_at: string;
  potholes_count: number;
  tenders_count: number;
  status: "success" | "failed";
  response_status: number | null;
  error_message: string | null;
  triggered_by: string;
}

const DEFAULT_TARGET_URL = process.env.TENDER_WEBSITE_URL || "http://localhost:3001/api/sync";
const DEFAULT_API_KEY = process.env.TENDER_API_KEY || "tender_portal_secret_key_2026";
const DEFAULT_INTERVAL_DAYS = 15;

let tablesInitialized = false;

export async function ensureTenderSyncTablesExist(): Promise<void> {
  if (tablesInitialized) return;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tender_sync_settings (
        id VARCHAR(50) PRIMARY KEY,
        target_url TEXT NOT NULL DEFAULT 'http://localhost:3001/api/sync',
        api_key VARCHAR(255) NOT NULL DEFAULT 'tender_portal_secret_key_2026',
        sync_interval_days INT NOT NULL DEFAULT 15,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        next_sync_at TIMESTAMP WITH TIME ZONE,
        last_sync_status VARCHAR(50) DEFAULT 'idle',
        last_sync_message TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tender_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        potholes_count INT NOT NULL DEFAULT 0,
        tenders_count INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL,
        response_status INT,
        error_message TEXT,
        triggered_by VARCHAR(255) NOT NULL DEFAULT 'scheduler'
      );
    `);

    const existing: any[] = await prisma.$queryRawUnsafe(`
      SELECT id FROM tender_sync_settings WHERE id = 'default' LIMIT 1
    `);

    if (existing.length === 0) {
      const nextSync = new Date(Date.now() + DEFAULT_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await prisma.$executeRawUnsafe(`
        INSERT INTO tender_sync_settings (id, target_url, api_key, sync_interval_days, is_enabled, next_sync_at, last_sync_status)
        VALUES ('default', $1, $2, $3, true, $4::timestamptz, 'idle')
      `, DEFAULT_TARGET_URL, DEFAULT_API_KEY, DEFAULT_INTERVAL_DAYS, nextSync);
    }

    tablesInitialized = true;
    logger.info("Tender sync database tables verified/initialized.");
  } catch (err) {
    logger.error({ err }, "Error ensuring tender sync tables exist");
  }
}

let memorySettings: TenderSyncSettings = {
  id: "default",
  target_url: DEFAULT_TARGET_URL,
  api_key: DEFAULT_API_KEY,
  sync_interval_days: DEFAULT_INTERVAL_DAYS,
  is_enabled: true,
  last_sync_at: null,
  next_sync_at: new Date(Date.now() + DEFAULT_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  last_sync_status: "idle",
  last_sync_message: null,
  updated_at: new Date().toISOString(),
};

let memoryLogs: TenderSyncLog[] = [];

export async function getTenderSyncConfig(): Promise<{ settings: TenderSyncSettings; logs: TenderSyncLog[] }> {
  try {
    await ensureTenderSyncTablesExist();

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        target_url,
        api_key,
        sync_interval_days,
        is_enabled,
        last_sync_at,
        next_sync_at,
        last_sync_status,
        last_sync_message,
        updated_at
      FROM tender_sync_settings
      WHERE id = 'default'
      LIMIT 1
    `);

    if (rows && rows.length > 0) {
      memorySettings = rows[0];
    }

    const logs: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        synced_at,
        potholes_count,
        tenders_count,
        status,
        response_status,
        error_message,
        triggered_by
      FROM tender_sync_logs
      ORDER BY synced_at DESC
      LIMIT 20
    `);

    if (logs) {
      memoryLogs = logs;
    }
  } catch (err) {
    logger.warn({ err }, "Database unavailable for tender sync config; using fallback in-memory settings");
  }

  return { settings: memorySettings, logs: memoryLogs };
}

export async function updateTenderSyncConfig(data: {
  target_url?: string;
  api_key?: string;
  sync_interval_days?: number;
  is_enabled?: boolean;
}): Promise<TenderSyncSettings> {
  const current = memorySettings;

  const target_url = data.target_url !== undefined ? data.target_url.trim() : current.target_url;
  const api_key = data.api_key !== undefined ? data.api_key.trim() : current.api_key;
  let sync_interval_days = data.sync_interval_days !== undefined ? Number(data.sync_interval_days) : current.sync_interval_days;

  // Validate interval between 15 and 30 days as required
  if (isNaN(sync_interval_days) || sync_interval_days < 15) {
    sync_interval_days = 15;
  } else if (sync_interval_days > 30) {
    sync_interval_days = 30;
  }

  const is_enabled = data.is_enabled !== undefined ? Boolean(data.is_enabled) : current.is_enabled;

  let nextSyncDate: Date;
  if (current.last_sync_at) {
    nextSyncDate = new Date(new Date(current.last_sync_at).getTime() + sync_interval_days * 24 * 60 * 60 * 1000);
  } else {
    nextSyncDate = new Date(Date.now() + sync_interval_days * 24 * 60 * 60 * 1000);
  }

  memorySettings = {
    ...memorySettings,
    target_url,
    api_key,
    sync_interval_days,
    is_enabled,
    next_sync_at: nextSyncDate.toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    await ensureTenderSyncTablesExist();
    await prisma.$executeRawUnsafe(`
      UPDATE tender_sync_settings
      SET 
        target_url = $1,
        api_key = $2,
        sync_interval_days = $3,
        is_enabled = $4,
        next_sync_at = $5::timestamptz,
        updated_at = NOW()
      WHERE id = 'default'
    `, target_url, api_key, sync_interval_days, is_enabled, nextSyncDate.toISOString());
  } catch (err) {
    logger.warn({ err }, "Database unavailable; updated in-memory tender sync settings");
  }

  logger.info({ sync_interval_days, target_url, is_enabled }, "Tender sync config updated by admin");
  return memorySettings;
}


interface DispatchResult {
  ok: boolean;
  status: number | null;
  responseText: string;
}

/** Fetch the verified potholes for a single block (join reporter for display name). */
async function fetchBlockPotholes(blockId: string): Promise<any[]> {
  return prisma.$queryRawUnsafe(`
    SELECT
      p.id,
      p.image_s3_key,
      ST_X(p.location::geometry) as longitude,
      ST_Y(p.location::geometry) as latitude,
      p.address_notes,
      p.block_id,
      p.status,
      p.created_at,
      u.name as reporter_name
    FROM potholes p
    JOIN users u ON u.id = p.reporter_id
    WHERE p.block_id = $1 AND p.status = 'verified'
    ORDER BY p.created_at DESC
  `, blockId);
}

/** Attach a presigned S3 download URL to each pothole row (null when unavailable). */
async function enrichPotholeRows(potholes: any[]): Promise<any[]> {
  return Promise.all(
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
}

function mapTenderRows(tenders: any[]): any[] {
  return tenders.map((t: any) => ({
    id: t.id,
    block_id: t.block_id,
    pothole_count: Number(t.pothole_count),
    estimated_cost: Number(t.estimated_cost),
    status: t.status,
    generated_at: t.generated_at,
  }));
}

/** POST a sync payload to the tender website with API-key auth and a hard timeout. */
async function postPayloadToTenderWebsite(
  payload: unknown,
  targetUrl: string,
  apiKey: string
): Promise<DispatchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let responseText = "";
    try {
      responseText = await response.text();
    } catch {
      responseText = "";
    }

    return { ok: response.ok, status: response.status, responseText };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function performTenderSync(triggeredBy: string = "scheduler"): Promise<{
  success: boolean;
  potholes_count: number;
  tenders_count: number;
  message: string;
  response_status?: number;
}> {
  await ensureTenderSyncTablesExist();
  const { settings } = await getTenderSyncConfig();

  if (!settings.is_enabled && triggeredBy === "scheduler") {
    return {
      success: false,
      potholes_count: 0,
      tenders_count: 0,
      message: "Tender sync is currently disabled by admin.",
    };
  }

  if (!settings.target_url || !settings.api_key) {
    const errorMsg = "Tender sync target URL or API key is not configured.";
    await logSyncResult(0, 0, "failed", null, errorMsg, triggeredBy);
    return { success: false, potholes_count: 0, tenders_count: 0, message: errorMsg };
  }

  try {
    // 1. Fetch verified potholes that are still awaiting a tender
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
        u.name as reporter_name
      FROM potholes p
      JOIN users u ON u.id = p.reporter_id
      WHERE p.status = 'verified'
      ORDER BY p.created_at DESC
    `);

    // 2. Fetch all tenders (reconciliation channel: upsert + withdrawal healing)
    const tenders: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        block_id,
        pothole_count,
        estimated_cost,
        status,
        generated_at
      FROM tenders
      ORDER BY generated_at DESC
    `);

    // 3. Enrich potholes with image presigned URLs
    const enrichedPotholes = await enrichPotholeRows(potholes);

    const payload = {
      source: "pothole-reporter",
      exported_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      summary: {
        total_potholes: enrichedPotholes.length,
        total_tenders: tenders.length,
      },
      tenders: mapTenderRows(tenders),
      potholes: enrichedPotholes,
    };

    // 4. Send payload to Tender Website with API Key
    const { ok: isSuccess, status: responseStatus, responseText } =
      await postPayloadToTenderWebsite(payload, settings.target_url, settings.api_key);

    if (isSuccess) {
      const now = new Date();
      const nextSync = new Date(now.getTime() + settings.sync_interval_days * 24 * 60 * 60 * 1000);

      await prisma.$executeRawUnsafe(`
        UPDATE tender_sync_settings
        SET
          last_sync_at = $1::timestamptz,
          next_sync_at = $2::timestamptz,
          last_sync_status = 'success',
          last_sync_message = $3,
          updated_at = NOW()
        WHERE id = 'default'
      `, now.toISOString(), nextSync.toISOString(), `Successfully sent ${enrichedPotholes.length} potholes and ${tenders.length} tenders`);

      await logSyncResult(
        enrichedPotholes.length,
        tenders.length,
        "success",
        responseStatus,
        null,
        triggeredBy
      );

      logger.info(
        { potholesCount: enrichedPotholes.length, tendersCount: tenders.length, triggeredBy },
        "Tender sync completed successfully"
      );

      return {
        success: true,
        potholes_count: enrichedPotholes.length,
        tenders_count: tenders.length,
        message: `Successfully synchronized ${enrichedPotholes.length} potholes and ${tenders.length} tenders to tender website.`,
        response_status: responseStatus ?? undefined,
      };
    } else {
      const errMsg = `Tender website returned status ${responseStatus}: ${responseText.slice(0, 200)}`;
      await logSyncResult(
        enrichedPotholes.length,
        tenders.length,
        "failed",
        responseStatus,
        errMsg,
        triggeredBy
      );

      await prisma.$executeRawUnsafe(`
        UPDATE tender_sync_settings
        SET
          last_sync_status = 'failed',
          last_sync_message = $1,
          updated_at = NOW()
        WHERE id = 'default'
      `, errMsg);

      logger.warn({ responseStatus, responseText }, "Tender sync failed with non-2xx status");

      return {
        success: false,
        potholes_count: enrichedPotholes.length,
        tenders_count: tenders.length,
        message: errMsg,
        response_status: responseStatus ?? undefined,
      };
    }
  } catch (err: any) {
    const errMsg = err.message || "Failed to reach tender website";
    await logSyncResult(0, 0, "failed", null, errMsg, triggeredBy);

    await prisma.$executeRawUnsafe(`
      UPDATE tender_sync_settings
      SET
        last_sync_status = 'failed',
        last_sync_message = $1,
        updated_at = NOW()
      WHERE id = 'default'
    `, errMsg).catch(() => {});

    logger.error({ err }, "Error during tender sync");
    return {
      success: false,
      potholes_count: 0,
      tenders_count: 0,
      message: `Sync failed: ${errMsg}`,
    };
  }
}

/**
 * Immediately dispatches a block's verified potholes and its tender to the
 * tender website. Called when a block crosses POTHOLE_TENDER_THRESHOLD.
 *
 * Unlike performTenderSync this is mandatory (independent of the admin's
 * enable/disable toggle, which governs only the periodic scheduler) and never
 * advances last_sync_at / next_sync_at so the periodic cycle is unaffected.
 * Failures are logged and healed by the next scheduled sync via block_id upsert.
 */
export async function pushBlockToTenderWebsite(
  blockId: string,
  triggeredBy: string = "threshold"
): Promise<{ success: boolean; potholes_count: number; message: string }> {
  await ensureTenderSyncTablesExist();
  const { settings } = await getTenderSyncConfig();

  if (!settings.target_url || !settings.api_key) {
    const errorMsg = "Tender website push skipped: target URL or API key is not configured.";
    logger.warn({ blockId, triggeredBy }, errorMsg);
    return { success: false, potholes_count: 0, message: errorMsg };
  }

  try {
    const potholes = await fetchBlockPotholes(blockId);
    if (potholes.length === 0) {
      const message = `No verified potholes found for block ${blockId}; nothing to push.`;
      logger.warn({ blockId, triggeredBy }, message);
      return { success: false, potholes_count: 0, message };
    }

    const tenders: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        block_id,
        pothole_count,
        estimated_cost,
        status,
        generated_at
      FROM tenders
      WHERE block_id = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `, blockId);

    const enrichedPotholes = await enrichPotholeRows(potholes);

    const payload = {
      source: "pothole-reporter",
      sync_type: "threshold",
      exported_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      summary: {
        total_potholes: enrichedPotholes.length,
        total_tenders: tenders.length,
      },
      tenders: mapTenderRows(tenders),
      potholes: enrichedPotholes,
    };

    const { ok, status, responseText } = await postPayloadToTenderWebsite(
      payload,
      settings.target_url,
      settings.api_key
    );

    if (ok) {
      await logSyncResult(
        enrichedPotholes.length,
        tenders.length,
        "success",
        status,
        null,
        triggeredBy
      );
      logger.info(
        { blockId, potholesCount: enrichedPotholes.length, triggeredBy, status },
        "Threshold tender push completed successfully"
      );
      return {
        success: true,
        potholes_count: enrichedPotholes.length,
        message: `Pushed ${enrichedPotholes.length} potholes for block ${blockId} to tender website.`,
      };
    }

    const errMsg = `Tender website returned status ${status}: ${responseText.slice(0, 200)}`;
    await logSyncResult(
      enrichedPotholes.length,
      tenders.length,
      "failed",
      status,
      errMsg,
      triggeredBy
    );
    logger.warn({ blockId, triggeredBy, status, responseText }, "Threshold tender push failed with non-2xx status");
    return { success: false, potholes_count: enrichedPotholes.length, message: errMsg };
  } catch (err: any) {
    const errMsg = err.message || "Failed to reach tender website";
    await logSyncResult(0, 0, "failed", null, errMsg, triggeredBy);
    logger.error({ err, blockId, triggeredBy }, "Threshold tender push failed (non-blocking)");
    return { success: false, potholes_count: 0, message: `Push failed: ${errMsg}` };
  }
}

async function logSyncResult(
  potholesCount: number,
  tendersCount: number,
  status: "success" | "failed",
  responseStatus: number | null,
  errorMessage: string | null,
  triggeredBy: string
) {
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO tender_sync_logs (potholes_count, tenders_count, status, response_status, error_message, triggered_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, potholesCount, tendersCount, status, responseStatus, errorMessage, triggeredBy);
  } catch (err) {
    logger.error({ err }, "Failed to write tender sync log");
  }
}
