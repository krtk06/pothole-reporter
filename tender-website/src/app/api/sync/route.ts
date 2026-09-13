import { NextRequest, NextResponse } from "next/server";
import { getTenderData, ingestSyncPayload } from "@/lib/tenderStore";
import { isAuthorized, UNAUTHORIZED_RESPONSE_BODY } from "@/lib/apiAuth";

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(UNAUTHORIZED_RESPONSE_BODY, { status: 401 });
    }

    const payload = await request.json();

    if (!payload || (!payload.potholes && !payload.tenders)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Payload must contain 'potholes' or 'tenders' array.",
        },
        { status: 400 }
      );
    }

    const result = ingestSyncPayload(payload, payload.source || "pothole-reporter");

    return NextResponse.json({
      ...result,
      message: "Tender and pothole data successfully ingested into Tender Portal.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: err.message || "Failed to process tender sync payload",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const store = getTenderData();
  const totalPotholes = store.tenders.reduce((sum, t) => sum + (t.potholes?.length || 0), 0);

  return NextResponse.json({
    status: "online",
    service: "AP Road Infrastructure Tendering Portal API",
    last_sync_at: store.lastSyncAt,
    active_tenders: store.tenders.length,
    registered_potholes: totalPotholes,
    recent_sync_logs: store.syncLogs.slice(0, 5),
  });
}
