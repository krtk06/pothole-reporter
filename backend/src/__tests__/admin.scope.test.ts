import express from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import adminRoutes from "../routes/admin";

const mockPrisma = vi.hoisted(() => ({
  userSession: { findUnique: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  tender: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/s3Service", () => ({ generatePresignedDownloadUrl: vi.fn(async () => null) }));

let currentUser: any;

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/v1/admin", adminRoutes);
  return instance;
}

function token() {
  return jwt.sign(
    { userId: currentUser.id, role: "admin", sid: "session" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h", algorithm: "HS256", issuer: "pothole-reporter", audience: "pothole-reporter-web" } as SignOptions,
  );
}

function user(overrides: any = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    role: "admin",
    state: "Andhra Pradesh",
    district: null,
    locality: null,
    admin_scope: "state",
    ...overrides,
  };
}

async function call(path: string, method: "get" | "patch" = "get") {
  return request(app())[method](`/api/v1/admin${path}`)
    .set("Authorization", `Bearer ${token()}`)
    .send(method === "patch" ? { status: "verified" } : undefined);
}

describe("admin jurisdiction scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.userSession.findUnique.mockImplementation(async () => ({
      id: "session",
      user_id: currentUser.id,
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
      user: currentUser,
    }));
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.tender.findMany.mockResolvedValue([]);
  });

  it("scopes a state admin to the state prefix", async () => {
    currentUser = user();
    const res = await call("/reports");
    expect(res.status).toBe(200);
    const callArgs = mockPrisma.$queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes("JOIN users"));
    expect(callArgs?.[1]).toBe("andhra pradesh");
  });

  it("scopes a district admin to the district prefix", async () => {
    currentUser = user({ admin_scope: "district", district: "Eluru" });
    const res = await call("/reports");
    expect(res.status).toBe(200);
    const callArgs = mockPrisma.$queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes("JOIN users"));
    expect(callArgs?.[1]).toBe("andhra pradesh/eluru");
  });

  it("scopes a mandal admin to the mandal prefix", async () => {
    currentUser = user({ admin_scope: "mandal", district: "Eluru", locality: "Addateegala" });
    const res = await call("/reports");
    expect(res.status).toBe(200);
    const callArgs = mockPrisma.$queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes("JOIN users"));
    expect(callArgs?.[1]).toBe("andhra pradesh/eluru/addateegala");
  });

  it("fails closed when an admin has no resolvable scope", async () => {
    currentUser = user({ admin_scope: null, district: null, locality: "Addateegala" });
    const res = await call("/reports");
    expect(res.status).toBe(403);
  });

  it("does not update a report outside the admin scope", async () => {
    currentUser = user({ admin_scope: "mandal", district: "Eluru", locality: "Addateegala" });
    const res = await call("/reports/22222222-2222-4222-8222-222222222222", "patch");
    expect(res.status).toBe(404);
    const update = mockPrisma.$queryRawUnsafe.mock.calls.find(([sql]) => String(sql).includes("UPDATE potholes"));
    expect(String(update?.[0])).toContain("block_id");
  });

  it("limits tender sync configuration to state admins", async () => {
    currentUser = user({ admin_scope: "district", district: "Eluru" });
    const res = await call("/tender-sync");
    expect(res.status).toBe(403);
  });

  it("scopes the tender list with a block prefix", async () => {
    currentUser = user({ admin_scope: "mandal", district: "Eluru", locality: "Addateegala" });
    const res = await call("/tenders");
    expect(res.status).toBe(200);
    expect(mockPrisma.tender.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { block_id: "andhra pradesh/eluru/addateegala" },
            { block_id: { startsWith: "andhra pradesh/eluru/addateegala/" } },
          ]),
        }),
      }),
    );
  });

  it("returns the resolved jurisdiction", async () => {
    currentUser = user({ admin_scope: "mandal", district: "Eluru", locality: "Addateegala" });
    const res = await call("/jurisdiction");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      level: "mandal",
      district: "Eluru",
      mandal: "Addateegala",
      canDispatchTender: true,
    });
  });
});
