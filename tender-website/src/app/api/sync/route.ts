import { NextRequest, NextResponse } from "next/server";
import { getTenderData, ingestSyncPayload } from "@/lib/tenderStore";

const CONFIGURED_API_KEY = process.env.TENDER_API_KEY || "tender_portal_secret_key_2026";

function extractApiKey(request: NextRequest): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1].trim();
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const providedKey = extractApiKey(request);

    if (!providedKey || providedKey !== CONFIGURED_API_KEY) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid or missing API key. Pass 'X-API-Key' or 'Authorization: Bearer <key>'.",
        },
        { status: 401 }
      );
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
