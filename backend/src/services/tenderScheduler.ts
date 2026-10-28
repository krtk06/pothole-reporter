import logger from "../config/logger";
import { getTenderSyncConfig, performTenderSync } from "./tenderSyncService";

let schedulerTimer: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkAndTriggerScheduledSync(): Promise<void> {
  try {
    const { settings } = await getTenderSyncConfig();
    if (!settings.is_enabled || !settings.next_sync_at) return;
    if (Date.now() >= new Date(settings.next_sync_at).getTime()) {
      logger.info({ nextSyncAt: settings.next_sync_at }, "Scheduled tender sync due");
      const result = await performTenderSync("scheduler");
      logger.info({ result }, "Scheduled tender sync finished");
    }
  } catch (err) {
    logger.error({ err }, "Tender sync scheduler check failed");
  }
}

export function startTenderScheduler(): void {
  if (schedulerTimer) return;
  logger.info("Tender sync scheduler started (hourly check, 15-30 day interval)");
  setTimeout(() => void checkAndTriggerScheduledSync(), 10_000);
  schedulerTimer = setInterval(() => void checkAndTriggerScheduledSync(), CHECK_INTERVAL_MS);
}

export function stopTenderScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
