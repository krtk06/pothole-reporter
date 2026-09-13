import dotenv from "dotenv";
dotenv.config();

import { ensureTenderSyncTablesExist, getTenderSyncConfig, updateTenderSyncConfig, performTenderSync } from "../services/tenderSyncService";

async function main() {
  console.log("1. Ensuring tender sync tables exist...");
  await ensureTenderSyncTablesExist();

  console.log("2. Fetching tender sync config...");
  const config = await getTenderSyncConfig();
  console.log("Config settings target_url:", config.settings.target_url);
  console.log("Config sync_interval_days:", config.settings.sync_interval_days);

  console.log("3. Updating interval to 20 days...");
  const updated = await updateTenderSyncConfig({
    target_url: "http://localhost:3001/api/sync",
    api_key: "tender_portal_secret_key_2026",
    sync_interval_days: 20,
    is_enabled: true,
  });
  console.log("Updated interval days:", updated.sync_interval_days);
  console.log("Next sync date:", updated.next_sync_at);

  console.log("4. Performing live sync to Tender Website...");
  const result = await performTenderSync("test-admin");
  console.log("Live Sync result:", result);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error in testSync:", err);
  process.exit(1);
});
