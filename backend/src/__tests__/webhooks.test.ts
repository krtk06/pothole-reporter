import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));

const checkAndGenerateTender = vi.hoisted(() => vi.fn(async () => false));
vi.mock("../services/tenderService", () => ({ checkAndGenerateTender }));

import webhookRoutes from "../routes/webhooks";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/webhooks", webhookRoutes);
  return app;
}

const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const SECRET = "ml-secret-for-tests";
const VALID = { report_id: REPORT_ID, is_valid: true, confidence_score: 0.92 };

let app: express.Express;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ML_WEBHOOK_SECRET = SECRET;
  app = createApp();
  checkAndGenerateTender.mockResolvedValue(false);
});

describe("ML webhook authentication", () => {
  it("rejects a request with no API key", async () => {
    const res = await request(app).post("/api/v1/webhooks/ml-validation").send(VALID);
    expect(res.status).toBe(401);
  });

  it("rejects a wrong API key", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "wrong")
      .send(VALID);
    expect(res.status).toBe(401);
  });

  it("returns 500 when no webhook secret is configured server-side", async () => {
    delete process.env.ML_WEBHOOK_SECRET;
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "anything")
      .send(VALID);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it("authenticates before validating the body", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ nonsense: true });
    expect(res.status).toBe(400);
  });

  // Finding S-3: webhooks.ts:23 uses `apiKey !== webhookSecret`, a plain string
  // comparison that short-circuits on the first differing byte — a timing oracle
  // on the only credential guarding arbitrary report-status writes. Not fixed
  // per scope of work. Tracked in AUDIT_REPORT.md.
  it.todo("compares the API key in constant time");
});

describe("ML webhook validation", () => {
  it("requires a uuid report_id", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ report_id: "nope", is_valid: true, confidence_score: 1 });
    expect(res.status).toBe(400);
  });

  it("requires confidence_score to be within 0..1", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ ...VALID, confidence_score: 1.7 });
    expect(res.status).toBe(400);
  });

  it("requires confidence_score to be present at all", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ report_id: REPORT_ID, is_valid: true });
    expect(res.status).toBe(400);
  });

  // Finding D-8: `confidence_score` is required by the schema, then discarded —
  // webhooks.ts:36 destructures only report_id and is_valid. A prediction with
  // confidence 0.01 is accepted as authoritative. Tracked in AUDIT_REPORT.md.
  it("accepts a 0.01-confidence prediction as verified (confidence is ignored)", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ ...VALID, confidence_score: 0.01 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("ML webhook status transitions", () => {
  it("sets status to verified for a valid pothole", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0];
    expect(call[0]).toContain("SET status = $1");
    expect(call[1]).toBe("verified");
    expect(call[2]).toBe(REPORT_ID);
  });

  it("sets status to rejected for an invalid pothole", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ ...VALID, is_valid: false });

    expect(mockPrisma.$queryRawUnsafe.mock.calls[0][1]).toBe("rejected");
  });

  it("does not consult the tender service for an invalid pothole", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send({ ...VALID, is_valid: false });

    expect(checkAndGenerateTender).not.toHaveBeenCalled();
  });

  // Finding P-7: the UPDATE has no status guard, so the webhook can move a
  // report backwards (fixed -> pending) or resurrect a rejected one.
  // Tracked in AUDIT_REPORT.md.
  it("allows an arbitrary status transition with no guard on the prior status", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    const sql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain("WHERE id = $2::uuid");
    expect(sql).not.toContain("status !=");
    expect(sql).not.toContain("AND status");
  });

  // Finding P-7: an unknown report_id updates zero rows, yet the handler answers
  // 200 {"success": true}. Tracked in AUDIT_REPORT.md.
  it("reports success for a report_id that does not exist", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, tender_generated: false });
  });
});

describe("ML webhook triggers tender generation", () => {
  it("asks for a tender when a verified report has a block_id", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "andhra pradesh/eluru/x" }]);
    checkAndGenerateTender.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    expect(checkAndGenerateTender).toHaveBeenCalledWith("andhra pradesh/eluru/x");
    expect(res.body.tender_generated).toBe(true);
  });

  it("propagates a false result when no tender was created", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "andhra pradesh/eluru/x" }]);

    const res = await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    expect(res.body.tender_generated).toBe(false);
  });

  it("skips tender generation when block_id is null", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: null }]);

    await request(app)
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", SECRET)
      .send(VALID);

    expect(checkAndGenerateTender).not.toHaveBeenCalled();
  });
});

describe("ML webhook has no replay protection", () => {
  // Finding P-6: no nonce, no idempotency key, no dedupe — the same report_id
  // can be POSTed repeatedly, re-running the status update and the tender
  // check each time. This is one of the two paths into the duplicate-tender
  // race characterised in tender.threshold.test.ts. Tracked in AUDIT_REPORT.md.
  it("processes the same report_id twice with no idempotency guard", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ block_id: "a/b/c" }]);

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/v1/webhooks/ml-validation")
        .set("X-API-Key", SECRET)
        .send(VALID);
    }

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(checkAndGenerateTender).toHaveBeenCalledTimes(3);
  });
});