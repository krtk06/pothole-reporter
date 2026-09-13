import logger from "../config/logger";
import { getTenderSyncConfig, performTenderSync } from "./tenderSyncService";

let schedulerTimer: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

async function checkAndTriggerScheduledSync(): Promise<void> {
  try {
    const { settings } = await getTenderSyncConfig();

    if (!settings.is_enabled) {
      return;
    }

    if (!settings.next_sync_at) {
      return;
    }

    const nextSyncTime = new Date(settings.next_sync_at).getTime();
    const now = Date.now();

    if (now >= nextSyncTime) {
      logger.info({ nextSyncTime: settings.next_sync_at }, "Next sync time reached. Triggering automatic tender sync...");
      const result = await performTenderSync("scheduler");
      logger.info({ result }, "Scheduled tender sync execution completed");
    }
  } catch (err) {
    logger.error({ err }, "Error running tender sync scheduler check");
  }
}

export function startTenderScheduler(): void {
  if (schedulerTimer) {
    logger.warn("Tender sync scheduler already running.");
    return;
  }

  logger.info("Initializing Tender Sync Periodic Scheduler (checking hourly for 15-30 day trigger)...");

  // Run an initial check after 10 seconds of startup to avoid slowing down initial boot
  setTimeout(() => {
    checkAndTriggerScheduledSync().catch(() => {});
  }, 10000);

  schedulerTimer = setInterval(() => {
    checkAndTriggerScheduledSync().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

export function stopTenderScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Tender sync scheduler stopped.");
  }
}
