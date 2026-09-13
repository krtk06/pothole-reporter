import { NextRequest, NextResponse } from "next/server";
import { getTenderData, withdrawTender } from "@/lib/tenderStore";
import { isAuthorized, UNAUTHORIZED_RESPONSE_BODY } from "@/lib/apiAuth";

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

/**
 * Withdraws a tender from the portal. Authenticated with the shared tender
 * API key (X-API-Key or Authorization: Bearer), called by the backend when an
 * admin "unsends" a tender.
 */
export async function DELETE(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(UNAUTHORIZED_RESPONSE_BODY, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    if (!body || (!body.tender_id && !body.block_id)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Body must contain 'tender_id' or 'block_id'.",
        },
        { status: 400 }
      );
    }

    const result = withdrawTender({
      tender_id: body.tender_id,
      block_id: body.block_id,
      triggered_by: body.triggered_by,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Not Found", message: result.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...result,
      message: "Tender successfully withdrawn from Tender Portal.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: err.message || "Failed to withdraw tender",
      },
      { status: 500 }
    );
  }
}
