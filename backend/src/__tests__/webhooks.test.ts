import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import webhookRoutes from "../routes/webhooks";

const mockPrisma = vi.hoisted(() => ({ $queryRawUnsafe: vi.fn() }));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/roadIssueRegistry", () => ({
  recordAiRoadAnalysis: vi.fn(async () => ({ issueId: "issue-1", reused: false })),
  ensureRoadIssueForReport: vi.fn(async () => ({ issueId: "issue-1", reused: false })),
}));
vi.mock("../services/tenderService", () => ({
  checkAndGenerateTender: vi.fn(async () => true),
  hasOpenTender: vi.fn(async () => false),
}));
vi.mock("../services/tenderSyncService", () => ({
  pushBlockToTenderWebsite: vi.fn(async () => ({ success: true })),
}));

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/v1/webhooks", webhookRoutes);
  return instance;
}

describe("ML webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ML_WEBHOOK_SECRET = "test-webhook-secret";
  });

  it("rejects an invalid API key", async () => {
    const res = await request(app())
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "wrong")
      .send({ report_id: "11111111-1111-4111-8111-111111111111", is_valid: true, confidence_score: 0.9 });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a report that does not exist", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    const res = await request(app())
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "test-webhook-secret")
      .send({ report_id: "11111111-1111-4111-8111-111111111111", is_valid: true, confidence_score: 0.9 });
    expect(res.status).toBe(404);
  });

  it("records a structured AI analysis and returns the canonical issue", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]);
    const res = await request(app())
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "test-webhook-secret")
      .send({
        report_id: "11111111-1111-4111-8111-111111111111",
        is_valid: true,
        confidence_score: 0.9,
        condition: "pothole",
        severity_score: 40,
        estimated_pothole_count: 2,
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, canonical_issue_id: "issue-1", reused_existing_issue: false });
  });

  it("creates a road issue when a valid report is verified without an AI condition", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: "11111111-1111-4111-8111-111111111111" }])
      .mockResolvedValueOnce([{ block_id: "andhra pradesh/eluru/addateegala" }]);
    const res = await request(app())
      .post("/api/v1/webhooks/ml-validation")
      .set("X-API-Key", "test-webhook-secret")
      .send({
        report_id: "11111111-1111-4111-8111-111111111111",
        is_valid: true,
        confidence_score: 0.9,
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      road_issue_id: "issue-1",
      tender_generated: true,
      block_id: "andhra pradesh/eluru/addateegala",
    });
  });
});
