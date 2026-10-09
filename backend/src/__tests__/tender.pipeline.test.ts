import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STATE_ADMIN, mintAccessToken } from "./helpers/auth";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  tender: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));

vi.mock("../services/s3Service", () => ({
  generatePresignedDownloadUrl: vi.fn(async () => "https://s3.test/presigned.jpg"),
  generatePresignedUploadUrl: vi.fn(async () => ({ uploadUrl: "u", key: "uploads/x.jpg" })),
}));

vi.mock("../services/tenderSyncService", () => ({
  getTenderSyncConfig: vi.fn(async () => ({ settings: {}, logs: [] })),
  updateTenderSyncConfig: vi.fn(async (s: unknown) => s),
  performTenderSync: vi.fn(async () => ({ success: true })),
}));

const checkAndGenerateTender = vi.hoisted(() => vi.fn(async () => false));
vi.mock("../services/tenderService", () => ({ checkAndGenerateTender }));

import adminRoutes from "../routes/admin";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/admin", adminRoutes);
  return app;
}

const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "andhra pradesh/eluru/addateegala";

let app: express.Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
  checkAndGenerateTender.mockResolvedValue(false);
  mockPrisma.$executeRawUnsafe.mockResolvedValue(1);
  mockPrisma.tender.findMany.mockResolvedValue([]);
  mockPrisma.tender.findFirst.mockResolvedValue(null);
  mockPrisma.tender.updateMany.mockResolvedValue({ count: 1 });
});

/** Simulates the UPDATE ... RETURNING row for a report in `block`. */
function updatedRow(block: string | null) {
  mockPrisma.$queryRawUnsafe.mockResolvedValue([
    { id: REPORT_ID, status: "verified", block_id: block },
  ]);
}

function verify(status = "verified") {
  return request(app)
    .patch(`/api/v1/admin/reports/${REPORT_ID}`)
    .set("Authorization", `Bearer ${mintAccessToken(STATE_ADMIN)}`)
    .send({ status });
}

describe("verifying a report through the admin UI reaches tender generation", () => {
  // This is the regression test for the dead pipeline. Before the Phase 3 fix
  // this fails, because routes/admin.ts:159-175 updated the status and returned
  // without ever calling checkAndGenerateTender — the only caller of which was
  // the ML webhook, which nothing in this repository invokes. The README
  // promises that reaching the threshold creates and pushes a tender.
  it("calls checkAndGenerateTender when a report is verified", async () => {
    updatedRow(BLOCK_ID);
    checkAndGenerateTender.mockResolvedValue(true);

    const res = await verify("verified");

    expect(res.status).toBe(200);
    expect(checkAndGenerateTender).toHaveBeenCalledWith(BLOCK_ID);
  });

  it("surfaces whether a tender was created in the response", async () => {
    updatedRow(BLOCK_ID);
    checkAndGenerateTender.mockResolvedValue(true);

    const res = await verify("verified");

    expect(res.body.tender_generated).toBe(true);
  });

  it("returns tender_generated false when the block is below threshold", async () => {
    updatedRow(BLOCK_ID);
    checkAndGenerateTender.mockResolvedValue(false);

    const res = await verify("verified");

    expect(res.body.tender_generated).toBe(false);
    expect(checkAndGenerateTender).toHaveBeenCalled();
  });

  it("needs block_id in the RETURNING clause to know which block to check", async () => {
    updatedRow(BLOCK_ID);
    await verify("verified");

    const sql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/RETURNING[\s\S]*block_id/);
  });

  it("verifying again for the same block still asks for a tender", async () => {
    // Re-verifying a report must not short-circuit: the threshold count is
    // recomputed inside checkAndGenerateTender, and that function is the only
    // thing that knows whether the block has moved above the threshold.
    updatedRow(BLOCK_ID);
    await verify("verified");
    await verify("verified");

    expect(checkAndGenerateTender).toHaveBeenCalledTimes(2);
  });
});

describe("non-verifying transitions must not generate tenders", () => {
  for (const status of ["pending", "rejected", "fixed"]) {
    it(`does not call checkAndGenerateTender for status "${status}"`, async () => {
      updatedRow(BLOCK_ID);

      const res = await verify(status);

      expect(res.status).toBe(200);
      expect(checkAndGenerateTender).not.toHaveBeenCalled();
      expect(res.body.tender_generated).toBe(false);
    });
  }
});

describe("reports with no block location", () => {
  // Findings M-3/A5: block_id is optional on POST /reports, and the mobile app
  // never sends one. A NULL block_id can never match `WHERE block_id = $1` in
  // tenderService, so such reports are permanently ineligible for a tender.
  it("still updates the status but cannot trigger tender generation", async () => {
    updatedRow(null);

    const res = await verify("verified");

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe("verified");
    expect(checkAndGenerateTender).not.toHaveBeenCalled();
    expect(res.body.tender_generated).toBe(false);
  });
});

describe("tender generation must not roll back the status change", () => {
  it("keeps the 200 when tender generation throws", async () => {
    updatedRow(BLOCK_ID);
    checkAndGenerateTender.mockRejectedValue(new Error("portal unreachable"));

    const res = await verify("verified");

    // The status UPDATE is already committed at this point; failing the request
    // would make the admin UI show an error for a change that did happen.
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe("verified");
  });
});

describe("out-of-scope reports never reach tender generation", () => {
  it("does not call checkAndGenerateTender when the scope predicate matches nothing", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]); // 0 rows updated

    const res = await verify("verified");

    expect(res.status).toBe(404);
    expect(checkAndGenerateTender).not.toHaveBeenCalled();
  });
});