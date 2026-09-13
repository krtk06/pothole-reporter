import { NextResponse } from "next/server";
import { getTenderData } from "@/lib/tenderStore";

export async function GET() {
  const store = getTenderData();

  const totalPotholes = store.tenders.reduce((sum, t) => sum + (t.potholes?.length || 0), 0);
  const totalBudget = store.tenders.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0);

  return NextResponse.json({
    tenders: store.tenders,
    stats: {
      total_tenders: store.tenders.length,
      open_tenders: store.tenders.filter(t => t.status === "open").length,
      total_potholes: totalPotholes,
      total_budget: totalBudget,
      total_bids: store.bids.length,
    },
    last_sync_at: store.lastSyncAt,
    sync_logs: store.syncLogs.slice(0, 10),
  });
}
