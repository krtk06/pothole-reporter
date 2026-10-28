import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { performTenderSync, validateTenderTargetUrl } from "../services/tenderSyncService";

const mockPrisma = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(async () => 1),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/s3Service", () => ({ generatePresignedDownloadUrl: vi.fn(async () => "https://s3.example/photo.jpg") }));

const settingsRow = {
  id: "default",
  target_url: "https://tender.example.com/api/sync",
  api_key: "test-api-key",
  sync_interval_days: 15,
  is_enabled: true,
  last_sync_at: null,
  next_sync_at: new Date().toISOString(),
  last_sync_status: "idle",
  last_sync_message: null,
  consecutive_failures: 0,
  updated_at: new Date().toISOString(),
};

describe("tender sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM tender_sync_settings")) return [settingsRow];
      if (sql.includes("FROM tender_sync_logs")) return [];
      if (sql.includes("UPDATE tender_sync_settings") && sql.includes("sync_lock_until")) return [{ id: "default" }];
      if (sql.includes("JOIN users")) {
        return [{
          id: "pothole-1",
          image_s3_key: "uploads/a.jpg",
          longitude: 80.4,
          latitude: 16.3,
          address_notes: "Near the junction",
          block_id: "andhra pradesh/eluru/addateegala",
          status: "verified",
          created_at: new Date("2026-10-01T00:00:00Z"),
          reporter_name: "Ravi",
        }];
      }
      if (sql.includes("FROM tenders")) {
        return [{
          id: "44444444-4444-4444-8444-444444444444",
          block_id: "andhra pradesh/eluru/addateegala",
          pothole_count: 22,
          estimated_cost: "330000.00",
          status: "open",
          generated_at: new Date("2026-10-02T00:00:00Z"),
        }];
      }
      return [];
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => "" })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits the shared payload shape and numeric money fields", async () => {
    const result = await performTenderSync("test");
    expect(result.success).toBe(true);
    expect(result.potholes_count).toBe(1);
    expect(result.tenders_count).toBe(1);

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({
      source: "pothole-reporter",
      sync_type: "scheduled",
      triggered_by: "test",
      summary: { total_potholes: 1, total_tenders: 1 },
    });
    expect(payload.tenders[0].estimated_cost).toBe(330000);
    expect(payload.potholes[0]).toMatchObject({
      id: "pothole-1",
      block_id: "andhra pradesh/eluru/addateegala",
      reporter_name: "Ravi",
    });
    expect(options.headers["X-API-Key"]).toBe("test-api-key");
  });

  it("rejects a private tender target in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PRIVATE_TENDER_URL;
    try {
      expect(validateTenderTargetUrl("http://127.0.0.1:3001/api/sync").ok).toBe(false);
      expect(validateTenderTargetUrl("http://10.0.0.5/api/sync").ok).toBe(false);
      expect(validateTenderTargetUrl("https://tender.example.com/api/sync").ok).toBe(true);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
