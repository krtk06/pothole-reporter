import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import fs from "fs";
import path from "path";

/**
 * Cross-app contract test — PRODUCER side.
 *
 * The backend builds the payload POSTed to the tender portal's /api/sync. The
 * portal consumes it in `ingestSyncPayload` against the `TenderItem` interface
 * (tender-website/src/lib/tenderStore.ts:18-30). Nothing in either repo
 * validates that the producer still satisfies that interface, so a rename or a
 * Decimal-vs-number slip is invisible until the portal renders "No Tenders
 * Available".
 *
 * This test runs the REAL payload builder, then asserts it matches the shared
 * fixture in contracts/sync-payload.contract.json — which the portal-side
 * contract test ingests. Drift on either side fails a test.
 */

const FIXTURE = path.join(__dirname, "../../../contracts/sync-payload.contract.json");

/** Contract mirrors tender-website's TenderItem / Pothole interfaces. */
const potholeSchema = z.object({
  id: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  address_notes: z.string().nullable(),
  block_id: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  reporter_name: z.string(),
  image_url: z.string().nullable(),
  image_s3_key: z.string(),
});

const tenderSchema = z.object({
  id: z.string().min(1),
  block_id: z.string().min(1),
  pothole_count: z.number(),
  estimated_cost: z.number(),
  status: z.enum(["open", "assigned", "completed", "rejected"]),
  generated_at: z.string(),
});

const syncPayloadSchema = z.object({
  source: z.string(),
  sync_type: z.string(),
  exported_at: z.string(),
  triggered_by: z.string(),
  summary: z.object({
    total_potholes: z.number(),
    total_tenders: z.number(),
  }),
  tenders: z.array(tenderSchema),
  potholes: z.array(potholeSchema),
});

const mockPrisma = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));

vi.mock("../services/s3Service", () => ({
  generatePresignedDownloadUrl: vi.fn(
    async (key: string) =>
      `https://pothole-evidence.s3.ap-south-1.amazonaws.com/${key}?X-Amz-Signature=deadbeef`,
  ),
  generatePresignedUploadUrl: vi.fn(async () => ({ uploadUrl: "u", key: "k" })),
}));

import { performTenderSync } from "../services/tenderSyncService";

const POTHOLE_ROWS = [
  {
    id: "pothole-uuid-0001",
    image_s3_key: "uploads/aa11.jpg",
    longitude: "78.4867",
    latitude: "17.3850",
    address_notes: "Near the flyover entrance",
    block_id: "andhra pradesh/eluru/addateegala",
    status: "verified",
    created_at: "2026-09-01T10:00:00.000Z",
    reporter_name: "Ravi Kumar",
  },
  {
    id: "pothole-uuid-0002",
    image_s3_key: "uploads/bb22.jpg",
    longitude: "78.4900",
    latitude: "17.3900",
    address_notes: null,
    block_id: "andhra pradesh/eluru/addateegala",
    status: "verified",
    created_at: "2026-09-01T11:00:00.000Z",
    reporter_name: "Sita Devi",
  },
];

const TENDER_ROWS = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    block_id: "andhra pradesh/eluru/addateegala",
    pothole_count: "22",          // COUNT(*)::bigint arrives as a string
    estimated_cost: "3300.00",    // Prisma Decimal arrives as a string
    status: "open",
    generated_at: "2026-09-02T09:00:00.000Z",
  },
];

/** Route by SQL text so the test does not depend on query ordering. */
function routeQuery(sql: string): any[] {
  if (sql.includes("FROM tender_sync_settings")) {
    return [
      {
        id: "default",
        target_url: "https://portal.example/api/sync",
        api_key: "contract-test-key",
        sync_interval_days: 15,
        is_enabled: true,
        last_sync_at: null,
        next_sync_at: null,
        last_sync_status: "idle",
        last_sync_message: null,
        updated_at: "2026-09-01T00:00:00.000Z",
      },
    ];
  }
  if (sql.includes("FROM tender_sync_logs")) return [];
  if (sql.includes("FROM potholes")) return POTHOLE_ROWS;
  if (sql.includes("FROM tenders")) return TENDER_ROWS;
  return [];
}

let capturedPayload: any;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  capturedPayload = undefined;
  mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) =>
    Promise.resolve(routeQuery(sql)),
  );
  mockPrisma.$executeRawUnsafe.mockResolvedValue(1);

  fetchMock = vi.fn(async (_url: string, init: any) => {
    capturedPayload = JSON.parse(init.body);
    return { ok: true, status: 200, text: async () => '{"success":true}' };
  });
  vi.stubGlobal("fetch", fetchMock);
});

async function buildPayload() {
  const result = await performTenderSync("scheduler");
  expect(result.success).toBe(true);
  expect(capturedPayload).toBeDefined();
  return capturedPayload;
}

describe("sync payload matches the shared contract fixture", () => {
  it("emits exactly the shape the portal's contract fixture describes", async () => {
    const payload = await buildPayload();
    const expected = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));

    // Normalise only the genuinely volatile fields.
    const normalise = (p: any) => ({ ...p, exported_at: "<volatile>" });
    expect(normalise(payload)).toEqual(normalise(expected));
  });

  it("satisfies the TenderItem-shaped schema", async () => {
    const payload = await buildPayload();
    const parsed = syncPayloadSchema.safeParse(payload);

    if (!parsed.success) {
      console.error(parsed.error.issues);
    }
    expect(parsed.success).toBe(true);
  });
});

describe("field types the portal depends on", () => {
  // Finding B2: Prisma Decimal and COUNT(*)::bigint both arrive as strings from
  // the driver. mapTenderRows coerces both, and the portal's TenderItem declares
  // them as numbers — if that Number() call is ever dropped, the portal's budget
  // arithmetic silently yields NaN instead of erroring.
  it("coerces estimated_cost to a number, not a string", async () => {
    const payload = await buildPayload();
    expect(typeof payload.tenders[0].estimated_cost).toBe("number");
    expect(payload.tenders[0].estimated_cost).toBe(3300);
  });

  it("coerces pothole_count to a number", async () => {
    const payload = await buildPayload();
    expect(typeof payload.tenders[0].pothole_count).toBe("number");
    expect(payload.tenders[0].pothole_count).toBe(22);
  });

  it("coerces pothole latitude/longitude to numbers", async () => {
    const payload = await buildPayload();
    for (const p of payload.potholes) {
      expect(typeof p.latitude).toBe("number");
      expect(typeof p.longitude).toBe("number");
    }
  });

  // Finding B13: every evidence URL depends on this succeeding. Three call
  // sites swallow the failure to null, so a broken AWS config makes the whole
  // evidence feature vanish with no error anywhere.
  it("attaches a presigned image_url to every pothole", async () => {
    const payload = await buildPayload();
    expect(payload.potholes.every((p: any) => typeof p.image_url === "string")).toBe(true);
  });

  it("sends address_notes as null rather than omitting the key", async () => {
    const payload = await buildPayload();
    const second = payload.potholes[1];
    expect(second).toHaveProperty("address_notes");
    expect(second.address_notes).toBeNull();
  });
});

describe("top-level envelope", () => {
  it("identifies itself and carries the trigger", async () => {
    const payload = await buildPayload();
    expect(payload.source).toBe("pothole-reporter");
    expect(payload.sync_type).toBe("scheduled");
    expect(payload.triggered_by).toBe("scheduler");
  });

  it("summary counts match the arrays actually sent", async () => {
    const payload = await buildPayload();
    expect(payload.summary.total_potholes).toBe(payload.potholes.length);
    expect(payload.summary.total_tenders).toBe(payload.tenders.length);
  });

  // Finding B1: sync_type, exported_at and summary are produced here but read by
  // nothing in the portal — ingestSyncPayload ignores all three and stamps its
  // own received_at. Pinned so a future removal is a deliberate decision.
  it.todo("the portal consumes sync_type, exported_at and summary");
});

describe("dispatch authentication", () => {
  it("sends the API key in both headers", async () => {
    await buildPayload();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers["X-API-Key"]).toBe("contract-test-key");
    expect(headers["Authorization"]).toBe("Bearer contract-test-key");
  });

  it("posts to the configured target url", async () => {
    await buildPayload();
    expect(fetchMock.mock.calls[0][0]).toBe("https://portal.example/api/sync");
  });
});