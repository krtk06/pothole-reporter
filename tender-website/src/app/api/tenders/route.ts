import { NextRequest, NextResponse } from "next/server";
import { getTenderData, withdrawTender, cacheLiveTenders } from "@/lib/tenderStore";
import { fetchLiveTenders, sanitizeTenders } from "@/lib/liveSource";
import { isAuthorized, UNAUTHORIZED_RESPONSE_BODY } from "@/lib/apiAuth";

// Real-time read path: prefer the live backend feed (Postgres + fresh AWS S3
// evidence URLs). Fall back to the local sync cache when the backend is
// unreachable. Expired cached presigned URLs are nulled so the UI never
// shows broken images.
export async function GET() {
  const store = getTenderData();

  let tenders = store.tenders;
  let live: { backend_reachable: boolean; source: string; fetched_at: string | null; error?: string } = {
    backend_reachable: false,
    source: "local-sync-cache",
    fetched_at: null,
  };
  let lastSyncAt = store.lastSyncAt;

  try {
    const liveRes = await fetchLiveTenders();
    if (liveRes.ok) {
      tenders = sanitizeTenders(liveRes.tenders);
      live = {
        backend_reachable: true,
        source: "postgres+aws-s3-live",
        fetched_at: liveRes.fetchedAt,
      };
      lastSyncAt = liveRes.fetchedAt || new Date().toISOString();
      // Keep the offline cache fresh without spamming sync logs
      try {
        cacheLiveTenders(liveRes.tenders);
      } catch {
        /* best-effort */
      }
    } else {
      tenders = sanitizeTenders(store.tenders);
      live = {
        backend_reachable: false,
        source: "local-sync-cache",
        fetched_at: null,
        error: liveRes.error,
      };
    }
  } catch (err: any) {
    tenders = sanitizeTenders(store.tenders);
    live = {
      backend_reachable: false,
      source: "local-sync-cache",
      fetched_at: null,
      error: err?.message || "live fetch failed",
    };
  }

  // Local bids only for tenders that currently exist
  const liveIds = new Set(tenders.map((t) => t.id));
  const bids = store.bids.filter((b) => liveIds.has(b.tender_id));

  const totalPotholes = tenders.reduce((sum, t) => sum + (t.potholes?.length || 0), 0);
  const totalBudget = tenders.reduce((sum, t) => sum + Number(t.estimated_cost || 0), 0);

  return NextResponse.json({
    tenders,
    bids,
    stats: {
      total_tenders: tenders.length,
      open_tenders: tenders.filter(t => t.status === "open").length,
      total_potholes: totalPotholes,
      total_budget: totalBudget,
      total_bids: bids.length,
    },
    last_sync_at: lastSyncAt,
    sync_logs: store.syncLogs.slice(0, 10),
    live,
    empty: tenders.length === 0,
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
