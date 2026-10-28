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
  consecutive_failures: number;
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
const DEFAULT_API_KEY = process.env.TENDER_API_KEY || "";
const DEFAULT_INTERVAL_DAYS = 15;

function clampInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_DAYS;
  return Math.min(30, Math.max(15, Math.floor(value)));
}

function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(lower)) return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  if (lower.endsWith(".local") || lower.endsWith(".internal")) return true;
  return false;
}

export function validateTenderTargetUrl(value: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: "Tender target URL is not a valid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, reason: "Tender target URL must use http or https" };
  }
  const allowPrivate =
    process.env.ALLOW_PRIVATE_TENDER_URL === "1" || (process.env.NODE_ENV || "development") !== "production";
  if (isPrivateHost(parsed.hostname) && !allowPrivate) {
    return { ok: false, reason: "Tender target URL may not point at a private or loopback host" };
  }
  return { ok: true };
}

async function ensureSettingsRow(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO tender_sync_settings (
       id, target_url, api_key, sync_interval_days, is_enabled, next_sync_at, last_sync_status
     )
     SELECT 'default', $1, $2, $3, TRUE, NOW() + ($3::text || ' days')::interval, 'idle'
     WHERE NOT EXISTS (SELECT 1 FROM tender_sync_settings WHERE id = 'default')`,
    DEFAULT_TARGET_URL,
    DEFAULT_API_KEY,
    DEFAULT_INTERVAL_DAYS,
  );
}

export async function getTenderSyncConfig(): Promise<{ settings: TenderSyncSettings; logs: TenderSyncLog[] }> {
  await ensureSettingsRow();

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, target_url, api_key, sync_interval_days, is_enabled, last_sync_at,
            next_sync_at, last_sync_status, last_sync_message, consecutive_failures, updated_at
     FROM tender_sync_settings WHERE id = 'default' LIMIT 1`,
  );

  const row = rows[0];
  const settings: TenderSyncSettings = {
    id: "default",
    target_url: row?.target_url || DEFAULT_TARGET_URL,
    api_key: row?.api_key || DEFAULT_API_KEY,
    sync_interval_days: clampInterval(Number(row?.sync_interval_days ?? DEFAULT_INTERVAL_DAYS)),
    is_enabled: row?.is_enabled ?? true,
    last_sync_at: row?.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
    next_sync_at: row?.next_sync_at ? new Date(row.next_sync_at).toISOString() : null,
    last_sync_status: row?.last_sync_status || "idle",
    last_sync_message: row?.last_sync_message || null,
    consecutive_failures: Number(row?.consecutive_failures || 0),
    updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };

  const logs: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, synced_at, potholes_count, tenders_count, status, response_status, error_message, triggered_by
     FROM tender_sync_logs ORDER BY synced_at DESC LIMIT 20`,
  );

  return {
    settings,
    logs: (logs || []).map((log) => ({
      ...log,
      synced_at: new Date(log.synced_at).toISOString(),
      potholes_count: Number(log.potholes_count),
      tenders_count: Number(log.tenders_count),
      response_status: log.response_status === null ? null : Number(log.response_status),
    })),
  };
}

export async function updateTenderSyncConfig(data: {
  target_url?: string;
  api_key?: string;
  sync_interval_days?: number;
  is_enabled?: boolean;
}): Promise<TenderSyncSettings> {
  const { settings } = await getTenderSyncConfig();
  const target_url = data.target_url !== undefined ? data.target_url.trim() : settings.target_url;
  const api_key = data.api_key !== undefined ? data.api_key.trim() : settings.api_key;
  const sync_interval_days = data.sync_interval_days !== undefined
    ? clampInterval(Number(data.sync_interval_days))
    : settings.sync_interval_days;
  const is_enabled = data.is_enabled !== undefined ? Boolean(data.is_enabled) : settings.is_enabled;

  const validation = validateTenderTargetUrl(target_url);
  if (!validation.ok) throw new Error(validation.reason);

  const base = settings.last_sync_at ? new Date(settings.last_sync_at).getTime() : Date.now();
  const nextSync = new Date(base + sync_interval_days * 86_400_000);

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE tender_sync_settings
     SET target_url = $1, api_key = $2, sync_interval_days = $3, is_enabled = $4,
         next_sync_at = $5::timestamptz, updated_at = NOW()
     WHERE id = 'default'`,
    target_url,
    api_key,
    sync_interval_days,
    is_enabled,
    nextSync.toISOString(),
  );
  if (updated === 0) throw new Error("Tender sync settings row is missing");

  logger.info({ sync_interval_days, target_url, is_enabled }, "Tender sync config updated");
  return (await getTenderSyncConfig()).settings;
}

async function acquireLock(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE tender_sync_settings
     SET sync_lock_until = NOW() + INTERVAL '10 minutes'
     WHERE id = 'default'
       AND (sync_lock_until IS NULL OR sync_lock_until < NOW())
     RETURNING id`,
  );
  return rows.length === 1;
}

async function releaseLock(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE tender_sync_settings SET sync_lock_until = NULL WHERE id = 'default'`,
  );
}

async function logSyncResult(
  potholesCount: number,
  tendersCount: number,
  status: "success" | "failed",
  responseStatus: number | null,
  errorMessage: string | null,
  triggeredBy: string,
) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO tender_sync_logs (potholes_count, tenders_count, status, response_status, error_message, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      potholesCount,
      tendersCount,
      status,
      responseStatus,
      errorMessage,
      triggeredBy,
    );
  } catch (err) {
    logger.error({ err }, "Failed to write tender sync log");
  }
}

async function postPayload(payload: unknown, targetUrl: string, apiKey: string) {
  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  const text = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, text };
}

async function fetchBlockPotholes(blockId: string): Promise<any[]> {
  return prisma.$queryRawUnsafe(
    `SELECT p.id, p.image_s3_key,
            ST_X(p.location::geometry) AS longitude,
            ST_Y(p.location::geometry) AS latitude,
            p.address_notes, p.block_id, p.status, p.created_at,
            u.name AS reporter_name
     FROM potholes p
     JOIN users u ON u.id = p.reporter_id
     WHERE p.block_id = $1 AND p.status = 'verified'
     ORDER BY p.created_at DESC`,
    blockId,
  );
}

async function enrichPotholeRows(potholes: any[]): Promise<any[]> {
  return Promise.all(
    potholes.map(async (p) => ({
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
    })),
  );
}

function mapTenderRows(tenders: any[]) {
  return tenders.map((t) => ({
    id: t.id,
    block_id: t.block_id,
    pothole_count: Number(t.pothole_count),
    estimated_cost: Number(t.estimated_cost),
    status: t.status,
    generated_at: t.generated_at,
  }));
}

export async function performTenderSync(triggeredBy = "scheduler"): Promise<{
  success: boolean;
  potholes_count: number;
  tenders_count: number;
  message: string;
  response_status?: number;
}> {
  const { settings } = await getTenderSyncConfig();
  if (!settings.is_enabled && triggeredBy === "scheduler") {
    return { success: false, potholes_count: 0, tenders_count: 0, message: "Tender sync is disabled by admin." };
  }

  const urlCheck = validateTenderTargetUrl(settings.target_url);
  if (!urlCheck.ok || !settings.api_key) {
    const message = urlCheck.reason || "Tender sync target URL or API key is not configured.";
    await logSyncResult(0, 0, "failed", null, message, triggeredBy);
    return { success: false, potholes_count: 0, tenders_count: 0, message };
  }

  if (!(await acquireLock())) {
    return { success: false, potholes_count: 0, tenders_count: 0, message: "A tender sync is already running." };
  }

  try {
    const potholes: any[] = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.image_s3_key,
              ST_X(p.location::geometry) AS longitude,
              ST_Y(p.location::geometry) AS latitude,
              p.address_notes, p.block_id, p.status, p.created_at,
              u.name AS reporter_name
       FROM potholes p
       JOIN users u ON u.id = p.reporter_id
       WHERE p.status = 'verified'
         AND p.block_id IS NOT NULL
         AND p.block_id NOT IN (SELECT DISTINCT block_id FROM tenders WHERE block_id IS NOT NULL)
       ORDER BY p.created_at DESC`,
    );

    const tenders: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, block_id, pothole_count, estimated_cost, status, generated_at
       FROM tenders ORDER BY generated_at DESC`,
    );

    const enriched = await enrichPotholeRows(potholes);
    const payload = {
      source: "pothole-reporter",
      sync_type: "scheduled",
      exported_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      summary: { total_potholes: enriched.length, total_tenders: tenders.length },
      tenders: mapTenderRows(tenders),
      potholes: enriched,
    };

    const result = await postPayload(payload, settings.target_url, settings.api_key);
    if (!result.ok) {
      const message = `Tender website returned ${result.status}: ${result.text.slice(0, 200)}`;
      await markFailure(settings, message);
      await logSyncResult(enriched.length, tenders.length, "failed", result.status, message, triggeredBy);
      return { success: false, potholes_count: enriched.length, tenders_count: tenders.length, message, response_status: result.status };
    }

    const now = new Date();
    const nextSync = new Date(now.getTime() + settings.sync_interval_days * 86_400_000);
    await prisma.$executeRawUnsafe(
      `UPDATE tender_sync_settings
       SET last_sync_at = $1::timestamptz, next_sync_at = $2::timestamptz,
           last_sync_status = 'success', last_sync_message = $3,
           consecutive_failures = 0, sync_lock_until = NULL, updated_at = NOW()
       WHERE id = 'default'`,
      now.toISOString(),
      nextSync.toISOString(),
      `Sent ${enriched.length} potholes and ${tenders.length} tenders`,
    );
    await logSyncResult(enriched.length, tenders.length, "success", result.status, null, triggeredBy);
    logger.info({ potholes: enriched.length, tenders: tenders.length, triggeredBy }, "Tender sync completed");
    return {
      success: true,
      potholes_count: enriched.length,
      tenders_count: tenders.length,
      message: `Synchronized ${enriched.length} potholes and ${tenders.length} tenders.`,
      response_status: result.status,
    };
  } catch (err: any) {
    const message = err?.message || "Failed to reach tender website";
    await markFailure(settings, message);
    await logSyncResult(0, 0, "failed", null, message, triggeredBy);
    logger.error({ err }, "Tender sync failed");
    return { success: false, potholes_count: 0, tenders_count: 0, message: `Sync failed: ${message}` };
  } finally {
    await releaseLock().catch(() => undefined);
  }
}

async function markFailure(settings: TenderSyncSettings, message: string) {
  const failures = Math.min(settings.consecutive_failures + 1, 10);
  const backoffHours = Math.min(24, 2 ** Math.min(failures, 5));
  await prisma.$executeRawUnsafe(
    `UPDATE tender_sync_settings
     SET last_sync_status = 'failed', last_sync_message = $1,
         consecutive_failures = $2,
         next_sync_at = NOW() + ($3::text || ' hours')::interval,
         sync_lock_until = NULL, updated_at = NOW()
     WHERE id = 'default'`,
    message,
    failures,
    String(backoffHours),
  ).catch(() => undefined);
}

export async function pushBlockToTenderWebsite(blockId: string, triggeredBy = "threshold") {
  const { settings } = await getTenderSyncConfig();
  const urlCheck = validateTenderTargetUrl(settings.target_url);
  if (!urlCheck.ok || !settings.api_key) {
    const message = urlCheck.reason || "Tender website URL or API key is not configured.";
    logger.warn({ blockId, triggeredBy }, message);
    return { success: false, potholes_count: 0, message };
  }

  try {
    const potholes = await enrichPotholeRows(await fetchBlockPotholes(blockId));
    if (potholes.length === 0) {
      return { success: false, potholes_count: 0, message: `No verified potholes in ${blockId}.` };
    }
    const tenders: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, block_id, pothole_count, estimated_cost, status, generated_at
       FROM tenders WHERE block_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      blockId,
    );
    const payload = {
      source: "pothole-reporter",
      sync_type: "threshold",
      exported_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      summary: { total_potholes: potholes.length, total_tenders: tenders.length },
      tenders: mapTenderRows(tenders),
      potholes,
    };
    const result = await postPayload(payload, settings.target_url, settings.api_key);
    await logSyncResult(
      potholes.length,
      tenders.length,
      result.ok ? "success" : "failed",
      result.status,
      result.ok ? null : `Tender website returned ${result.status}: ${result.text.slice(0, 200)}`,
      triggeredBy,
    );
    return {
      success: result.ok,
      potholes_count: potholes.length,
      message: result.ok ? `Pushed ${potholes.length} potholes for ${blockId}.` : `Push failed with ${result.status}.`,
    };
  } catch (err: any) {
    const message = err?.message || "Failed to reach tender website";
    await logSyncResult(0, 0, "failed", null, message, triggeredBy);
    logger.error({ err, blockId }, "Threshold tender push failed");
    return { success: false, potholes_count: 0, message };
  }
}
