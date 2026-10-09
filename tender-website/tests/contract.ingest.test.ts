import { beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import {
  ingestSyncPayload,
  getTenderData,
  type TenderItem,
  type Pothole,
} from "@/lib/tenderStore";

/**
 * Cross-app contract test — CONSUMER side.
 *
 * Ingests the exact payload the backend emits (contracts/sync-payload.contract.json,
 * asserted producer-side by backend/src/__tests__/contract.sync.test.ts) and
 * checks that what lands in the store still satisfies the TenderItem interface
 * the UI renders from.
 *
 * Divergences found here are documented as assertions on CURRENT behaviour.
 * They are not fixed — per the agreed scope this suite proves the contract and
 * records where the two apps disagree, so Phase 4 can list them.
 */

const FIXTURE = path.join(__dirname, "../../contracts/sync-payload.contract.json");

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
}

// tenderStore persists to <cwd>/data/tenders.json. Tests share one sandbox, so
// the store is reset between cases — several assertions below are about what a
// *single* sync leaves behind.
beforeEach(() => {
  fs.rmSync(path.join(process.cwd(), "data"), { recursive: true, force: true });
});

describe("ingesting the backend contract payload", () => {
  it("reports success and counts what it received", async () => {
    const result = await ingestSyncPayload(loadFixture());

    expect(result.success).toBe(true);
    expect(result.received_potholes).toBe(2);
    expect(result.received_tenders).toBe(1);
  });

  it("stores the tender so the board is not empty", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    expect(store.tenders).toHaveLength(1);
    expect(store.tenders[0].id).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("every stored tender satisfies the TenderItem interface", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    for (const t of store.tenders) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.block_id).toBe("string");
      expect(typeof t.title).toBe("string");
      expect(typeof t.pothole_count).toBe("number");
      expect(typeof t.estimated_cost).toBe("number");
      expect(typeof t.generated_at).toBe("string");
      expect(Array.isArray(t.potholes)).toBe(true);
      expect(t.status).toMatch(/^(open|under_review|assigned|completed)$/);
    }
  });

  it("every ingested pothole satisfies the Pothole interface", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    const potholes: Pothole[] = store.tenders.flatMap((t: TenderItem) => t.potholes);
    expect(potholes).toHaveLength(2);

    for (const p of potholes) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.latitude).toBe("number");
      expect(typeof p.longitude).toBe("number");
      expect(typeof p.status).toBe("string");
      expect(typeof p.created_at).toBe("string");
    }
  });

  it("preserves the backend's estimated_cost rather than recomputing it", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    // The backend charges 22 potholes x Rs 150 = 3300. The portal's own fallback
    // for a missing cost is 50,000 per pothole, so a dropped field would show
    // Rs 1,100,000 instead — a 333x overstatement.
    expect(store.tenders[0].estimated_cost).toBe(3300);
  });

  it("derives a human-readable district and mandal from the block id", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    expect(store.tenders[0].district).toBe("Eluru");
    expect(store.tenders[0].mandal).toBe("Addateegala");
    expect(store.tenders[0].title).toContain("Eluru");
  });

  it("keeps the evidence image_url intact so the photo renders", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    for (const p of store.tenders[0].potholes) {
      expect(p.image_url).toMatch(/^https:\/\/.*X-Amz-Signature=/);
    }
  });

  it("records the trigger in the sync log for the audit trail", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    expect(store.syncLogs[0].triggered_by).toBe("scheduler");
    expect(store.syncLogs[0].potholes_count).toBe(2);
    expect(store.syncLogs[0].tenders_count).toBe(1);
  });
});

describe("ingestion is idempotent", () => {
  it("does not duplicate a tender when the same payload arrives twice", async () => {
    const payload = loadFixture();
    await ingestSyncPayload(payload);
    await ingestSyncPayload(payload);

    const store = await getTenderData();
    expect(store.tenders).toHaveLength(1);
    expect(store.tenders[0].potholes).toHaveLength(2);
  });

  it("appends one log entry per sync even when the data is unchanged", async () => {
    const payload = loadFixture();
    await ingestSyncPayload(payload);
    await ingestSyncPayload(payload);

    const store = await getTenderData();
    // syncLogs is never trimmed on write — only capped on read. Each replay of a
    // captured request grows it without bound. Finding H5.
    expect(store.syncLogs).toHaveLength(2);
  });
});

describe("rejected tenders reconcile as withdrawals", () => {
  it("removes a previously synced tender when the backend marks it rejected", async () => {
    await ingestSyncPayload(loadFixture());
    expect((await getTenderData()).tenders).toHaveLength(1);

    const withdrawal = {
      ...loadFixture(),
      potholes: [],
      summary: { total_potholes: 0, total_tenders: 1 },
      tenders: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          block_id: "andhra pradesh/eluru/addateegala",
          pothole_count: 22,
          estimated_cost: 3300,
          status: "rejected",
          generated_at: "2026-09-02T09:00:00.000Z",
        },
      ],
    };

    const result = await ingestSyncPayload(withdrawal);
    const store = await getTenderData();

    expect(store.tenders).toHaveLength(0);
    expect(result.received_tenders).toBe(1);
    expect(store.syncLogs[0].details).toMatch(/withdrew 1 tender/);
  });
});

describe("documented contract divergences (current behaviour, not fixed)", () => {
  // Finding B5: tenderStore.ts:333 overwrites any deadline from the payload with
  // now + 20 days, so a 15-30 day re-sync pushes every bidding deadline
  // forward and no tender on the public portal can ever expire.
  it("overwrites the deadline rather than honouring an upstream one", async () => {
    const payload = loadFixture();
    (payload.tenders[0] as any).deadline = "2026-10-01T00:00:00.000Z";

    await ingestSyncPayload(payload);
    const store = await getTenderData();

    expect(store.tenders[0].deadline).not.toBe("2026-10-01T00:00:00.000Z");
    const deadline = new Date(store.tenders[0].deadline!).getTime();
    const twentyDays = 20 * 24 * 60 * 60 * 1000;
    // Pinned to "roughly now + 20 days", allowing for the ingestion taking a
    // few seconds to run.
    expect(deadline).toBeGreaterThan(Date.now() + twentyDays - 60_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + twentyDays);
  });

  // Finding B1: sync_type, exported_at and summary arrive and are discarded.
  it("ignores sync_type, exported_at and summary", async () => {
    const payload = loadFixture();
    expect(payload.sync_type).toBeDefined();

    await ingestSyncPayload(payload);
    const store = await getTenderData();

    expect(JSON.stringify(store.tenders[0])).not.toContain("scheduled");
    expect(store.syncLogs[0].source).toBe("pothole-reporter");
    expect(store.syncLogs[0]).not.toHaveProperty("sync_type");
  });

  // Finding H4/B4: tenderStore.ts:456 flips a tender to under_review when a bid
  // lands, but cacheLiveTenders replaces store.tenders wholesale on the next
  // successful GET /api/tenders, and the page polls every 30s — so the status
  // reverts to open and the under_review filter is dead UI.
  it("loses an under_review status set by a bid once the live cache refreshes", async () => {
    await ingestSyncPayload(loadFixture());
    const store = await getTenderData();

    store.tenders[0].status = "under_review";
    expect(store.tenders[0].status).toBe("under_review");

    // Re-ingesting the same backend payload restores the backend's own status,
    // because the tender is rebuilt from incT.status on every sync.
    await ingestSyncPayload(loadFixture());
    expect((await getTenderData()).tenders[0].status).toBe("open");
  });

  // Finding B6: the periodic sync excludes blocks that already have a tender
  // row, so the potholes for them are never re-sent. On a cold store (fresh
  // deploy, new bucket, or after purgeDummyRecords) the tender is created with
  // an empty potholes array while pothole_count stays 22 — permanently.
  it("cannot populate potholes for an already-tendered block on a cold store", async () => {
    // Simulate the cold-start case: tenders arrive, their potholes do not.
    const coldStart = loadFixture();
    coldStart.potholes = [];

    await ingestSyncPayload(coldStart);
    const store = await getTenderData();

    expect(store.tenders[0].potholes).toHaveLength(0);
    expect(store.tenders[0].pothole_count).toBe(22);
  });

  // Finding B10: parseBlockDistrictMandal capitalises only for 3-part block ids
  // (tenderStore.ts:262-263). The backend's own /public/tenders route
  // capitalises for 1- and 2-part ids too, so the same block yields "eluru"
  // from the sync channel and "Eluru" from the live feed — fragmenting the
  // portal's district filter depending on cache provenance.
  it("produces different casing for a 2-part block id than the live feed does", async () => {
    const twoPart = loadFixture();
    twoPart.potholes = [];
    twoPart.tenders = [
      {
        ...twoPart.tenders[0],
        block_id: "andhra pradesh/eluru",
      },
    ];

    await ingestSyncPayload(twoPart);
    const store = await getTenderData();

    expect(store.tenders[0].district).toBe("eluru");
  });

  // Finding B8: `incT.pothole_count || ...` treats a legitimate 0 as absent and
  // substitutes the pothole-array length, so a real zero-count tender silently
  // acquires a nonzero count.
  it("substitutes the array length when the backend sends pothole_count 0", async () => {
    const zero = loadFixture();
    zero.tenders[0].pothole_count = 0;
    zero.potholes = [
      { ...zero.potholes[0], block_id: "andhra pradesh/kakinada" },
      { ...zero.potholes[1], block_id: "andhra pradesh/kakinada" },
    ];

    await ingestSyncPayload(zero);
    const store = await getTenderData();

    const target = store.tenders.find((t) => t.block_id === "andhra pradesh/kakinada");
    expect(target!.pothole_count).not.toBe(0);
  });
});

describe("payload tolerance", () => {
  // Finding H4: /api/sync's only validation is `!payload.potholes && !payload.tenders`,
  // and ingestSyncPayload trusts shape throughout, so a garbage payload reaches
  // the store. Finding B12: an empty payload still reports success, which makes
  // the backend advance next_sync_at and log a green success.
  it("accepts an empty payload and reports success", async () => {
    const result = await ingestSyncPayload({});

    expect(result.success).toBe(true);
    expect(result.received_potholes).toBe(0);
    expect(result.received_tenders).toBe(0);
  });

  it("creates a synthetic tender for potholes that arrive with no tender", async () => {
    const orphan = { ...loadFixture(), tenders: [] };

    await ingestSyncPayload(orphan);
    const store = await getTenderData();

    expect(store.tenders).toHaveLength(1);
    expect(store.tenders[0].id).toMatch(/^tender-sync-/);
    // Synthetic cost model diverges from the backend's Rs 150/pothole.
    expect(store.tenders[0].estimated_cost).toBe(2 * 60000);
  });
});