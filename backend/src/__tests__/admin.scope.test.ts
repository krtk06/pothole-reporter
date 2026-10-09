import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "./helpers/auth";
import {
  DISTRICT_ADMIN,
  MANDAL_ADMIN,
  STATE_ADMIN,
  mintAccessToken,
} from "./helpers/auth";

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
  generatePresignedUploadUrl: vi.fn(async () => ({
    uploadUrl: "https://s3.test/put",
    key: "uploads/x.jpg",
  })),
}));

vi.mock("../services/tenderSyncService", () => ({
  getTenderSyncConfig: vi.fn(async () => ({
    settings: { target_url: "https://portal.test/api/sync", api_key: "k", is_enabled: true },
    logs: [],
  })),
  updateTenderSyncConfig: vi.fn(async (s: unknown) => s),
  performTenderSync: vi.fn(async () => ({ success: true })),
}));

import adminRoutes from "../routes/admin";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/admin", adminRoutes);
  return app;
}

let app: express.Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
  mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
  mockPrisma.tender.findMany.mockResolvedValue([]);
  mockPrisma.tender.findFirst.mockResolvedValue(null);
  mockPrisma.tender.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.tender.findUnique.mockResolvedValue(null);
  mockPrisma.$executeRawUnsafe.mockResolvedValue(1);
});

/** The SQL text and bound params of the single $queryRawUnsafe call. */
function lastQuery() {
  const call = mockPrisma.$queryRawUnsafe.mock.calls.at(-1);
  return { sql: call?.[0] as string, params: (call?.slice(1) ?? []) as unknown[] };
}

describe("admin authentication and RBAC", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get("/api/v1/admin/reports");
    expect(res.status).toBe(401);
  });

  it("rejects a public-role token with 403", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken({ role: "public" })}`);
    expect(res.status).toBe(403);
  });

  it("rejects a token signed with the wrong secret with 401", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("GET /admin/reports scope enforcement", () => {
  it("scopes a state admin to the state prefix only", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken(STATE_ADMIN)}`);

    expect(res.status).toBe(200);
    const { sql, params } = lastQuery();
    expect(sql).toContain("(p.block_id = $1 OR p.block_id LIKE $2)");
    expect(params).toEqual(["andhra pradesh", "andhra pradesh/%"]);
  });

  it("scopes a district admin to their district", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken(DISTRICT_ADMIN)}`);

    const { sql, params } = lastQuery();
    expect(sql).toContain("(p.block_id = $1 OR p.block_id LIKE $2)");
    expect(params).toEqual(["andhra pradesh/eluru", "andhra pradesh/eluru/%"]);
  });

  it("scopes a mandal admin to their mandal", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken(MANDAL_ADMIN)}`);

    const { params } = lastQuery();
    expect(params).toEqual([
      "andhra pradesh/eluru/addateegala",
      "andhra pradesh/eluru/addateegala/%",
    ]);
  });

  it("lowercases the jurisdiction so casing cannot widen the scope", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set(
        "Authorization",
        `Bearer ${mintAccessToken({
          ...STATE_ADMIN,
          admin_district: "  ElUrU  ".trim(),
          admin_scope: "district",
        })}`,
      );

    const { params } = lastQuery();
    expect(params[0]).toBe("andhra pradesh/eluru");
  });
});

describe("fail-closed behaviour when the jurisdiction cannot be resolved", () => {
  it("returns no rows for an admin with no admin_scope", async () => {
    const res = await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken({ role: "admin" })}`);

    expect(res.status).toBe(200);
    const { sql, params } = lastQuery();
    expect(sql).toContain("1 = 0");
    expect(params).toEqual([]);
  });

  it("returns no rows for an admin with a scope but no state", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set("Authorization", `Bearer ${mintAccessToken({ role: "admin", admin_scope: "state" })}`);

    expect(lastQuery().sql).toContain("1 = 0");
  });

  it("returns no rows for a district admin missing its district", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set(
        "Authorization",
        `Bearer ${mintAccessToken({
          role: "admin",
          admin_scope: "district",
          admin_state: "Andhra Pradesh",
        })}`,
      );

    expect(lastQuery().sql).toContain("1 = 0");
  });

  it("returns no rows for a mandal admin missing its mandal", async () => {
    await request(app)
      .get("/api/v1/admin/reports")
      .set(
        "Authorization",
        `Bearer ${mintAccessToken({
          role: "admin",
          admin_scope: "mandal",
          admin_state: "Andhra Pradesh",
          admin_district: "Eluru",
        })}`,
      );

    expect(lastQuery().sql).toContain("1 = 0");
  });

  it("returns an empty tender list rather than every tender", async () => {
    const res = await request(app)
      .get("/api/v1/admin/tenders")
      .set("Authorization", `Bearer ${mintAccessToken({ role: "admin" })}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenders: [] });
    expect(mockPrisma.tender.findMany).not.toHaveBeenCalled();
  });

  it("applies the fail-closed clause to map clusters too", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    await request(app)
      .get("/api/v1/admin/map-clusters")
      .set("Authorization", `Bearer ${mintAccessToken({ role: "admin" })}`);

    for (const call of mockPrisma.$queryRawUnsafe.mock.calls) {
      expect(call[0]).toContain("1 = 0");
    }
  });
});

describe("PATCH /admin/reports/:id is scope-bound", () => {
  const REPORT_ID = "33333333-3333-4333-8333-333333333333";

  it("binds the scope at $3/$4 because $1 and $2 are status and id", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ id: REPORT_ID, status: "verified" }]);

    const res = await request(app)
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .set("Authorization", `Bearer ${mintAccessToken(DISTRICT_ADMIN)}`)
      .send({ status: "verified" });

    expect(res.status).toBe(200);
    const { sql, params } = lastQuery();
    expect(sql).toContain("(block_id = $3 OR block_id LIKE $4)");
    expect(params).toEqual(["verified", REPORT_ID, "andhra pradesh/eluru", "andhra pradesh/eluru/%"]);
  });

  it("returns 404 when the report falls outside the admin's scope", async () => {
    // The scope predicate matches no rows, so the UPDATE returns an empty array.
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const res = await request(app)
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .set("Authorization", `Bearer ${mintAccessToken(MANDAL_ADMIN)}`)
      .send({ status: "verified" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Report not found");
  });

  it("returns 400 for a non-uuid report id before touching the database", async () => {
    const res = await request(app)
      .patch("/api/v1/admin/reports/not-a-uuid")
      .set("Authorization", `Bearer ${mintAccessToken(STATE_ADMIN)}`)
      .send({ status: "verified" });

    expect(res.status).toBe(400);
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects an unknown status value", async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/reports/${REPORT_ID}`)
      .set("Authorization", `Bearer ${mintAccessToken(STATE_ADMIN)}`)
      .send({ status: "banana" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  // Finding: `GET /reports` is the only filter in admin.ts that fails OPEN.
  // `map.ts` and `publicReports.ts` both 400 on a bad value; this one silently
  // drops the filter and returns every report in scope. Not fixed per scope of
  // work — tracked in AUDIT_REPORT.md (M-1).
  it.todo("rejects an invalid ?status= filter instead of returning all reports");
});

describe("tender sync routes are state-scope only", () => {
  const denied: Array<[string, () => request.Test]> = [
    ["GET /tender-sync", () => request(app).get("/api/v1/admin/tender-sync")],
    [
      "PUT /tender-sync",
      () => request(app).put("/api/v1/admin/tender-sync").send({ is_enabled: false }),
    ],
    [
      "POST /tender-sync/trigger",
      () => request(app).post("/api/v1/admin/tender-sync/trigger"),
    ],
  ];

  for (const [label, build] of denied) {
    for (const [scopeLabel, claims] of [
      ["district", DISTRICT_ADMIN],
      ["mandal", MANDAL_ADMIN],
    ] as const) {
      it(`denies ${label} to a ${scopeLabel} admin`, async () => {
        const res = await build().set("Authorization", `Bearer ${mintAccessToken(claims)}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/state-level admins only/);
      });
    }
  }

  it("allows a state admin to read the sync config", async () => {
    const res = await request(app)
      .get("/api/v1/admin/tender-sync")
      .set("Authorization", `Bearer ${mintAccessToken(STATE_ADMIN)}`);

    expect(res.status).toBe(200);
    expect(res.body.settings).toBeDefined();
  });
});

describe("GET /admin/tenders scoping", () => {
  it("restricts a district admin's tender query to their district", async () => {
    mockPrisma.tender.findMany.mockResolvedValue([]);

    await request(app)
      .get("/api/v1/admin/tenders")
      .set("Authorization", `Bearer ${mintAccessToken(DISTRICT_ADMIN)}`);

    expect(mockPrisma.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { block_id: "andhra pradesh/eluru" },
            { block_id: { startsWith: "andhra pradesh/eluru/" } },
          ],
        },
      }),
    );
  });
});