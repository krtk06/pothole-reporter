import crypto from "crypto";
import bcrypt from "bcryptjs";
import express from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import request from "supertest";
import cookieParser from "cookie-parser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import authRoutes from "../routes/auth";
import reportRoutes from "../routes/reports";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userSession: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn((operation: Promise<unknown>[] | ((tx: any) => Promise<unknown>)) => {
    if (typeof operation === "function") return operation(mockPrisma);
    return Promise.all(operation);
  }),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/emailService", () => ({ sendPasswordResetEmail: vi.fn() }));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/reports", reportRoutes);
  return app;
}

function testUser(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test User",
    email: "test@example.com",
    phone: null,
    state: null,
    district: null,
    locality: null,
    admin_scope: null,
    password_hash: "hash",
    role: "public",
    theme_preference: "dark",
    refresh_token: null,
    session_version: 0,
    created_at: new Date(),
    ...overrides,
  };
}

function refreshTokenFor(userId: string, sid: string) {
  return jwt.sign(
    { userId, role: "public", sid },
    process.env.JWT_REFRESH_SECRET!,
    {
      expiresIn: "7d",
      algorithm: "HS256",
      issuer: "pothole-reporter",
      audience: "pothole-reporter-web",
      jwtid: "test-jti",
    } as SignOptions,
  );
}

describe("Auth and report routes", () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
    process.env.JWT_RESET_SECRET = "test-reset-secret";
    process.env.JWT_EXPIRES_IN = "1h";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    process.env.FRONTEND_URL = "http://localhost:3000";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe("POST /api/v1/auth/register", () => {
    it("rejects web registration", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ name: "Test User", email: "test@example.com", password: "password123" });
      expect(res.status).toBe(403);
    });

    it("registers a mobile citizen and returns a refresh token", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(testUser());
      mockPrisma.userSession.create.mockResolvedValue({ id: "session" });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Client-Platform", "mobile")
        .send({ name: "Test Citizen", phone: "9999999999", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
      expect(mockPrisma.userSession.create).toHaveBeenCalled();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("allows a mobile citizen to log in with a phone number", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser({
        phone: "9999999999",
        password_hash: await bcrypt.hash("password123", 4),
      }));
      mockPrisma.userSession.create.mockResolvedValue({ id: "session" });

      const res = await request(app)
        .post("/api/v1/auth/login")
        .set("X-Client-Platform", "mobile")
        .send({ identifier: "9999999999", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.refreshToken).toBeTruthy();
    });

    it("rejects a public account on the web admin login", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(testUser({
        password_hash: await bcrypt.hash("password123", 4),
      }));

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("rotates a valid session token atomically", async () => {
      const sid = "22222222-2222-4222-8222-222222222222";
      const token = refreshTokenFor("11111111-1111-4111-8111-111111111111", sid);
      const hash = crypto.createHash("sha256").update(token).digest("hex");

      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: sid,
        user_id: "11111111-1111-4111-8111-111111111111",
        refresh_token_hash: hash,
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(testUser());
      mockPrisma.userSession.updateMany.mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Client-Platform", "mobile")
        .send({ refreshToken: token });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: sid, revoked_at: null }),
        }),
      );
    });

    it("rejects a revoked session", async () => {
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        refresh_token_hash: "hash",
        revoked_at: new Date(),
        expires_at: new Date(Date.now() + 60_000),
      });

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: refreshTokenFor("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222") });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/v1/reports", () => {
    it("rejects placeholder zero coordinates", async () => {
      const token = jwt.sign(
        { userId: "11111111-1111-4111-8111-111111111111", role: "public", sid: "session" },
        process.env.JWT_SECRET!,
        {
          expiresIn: "1h",
          algorithm: "HS256",
          issuer: "pothole-reporter",
          audience: "pothole-reporter-web",
        } as SignOptions,
      );

      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: "session",
        user_id: "11111111-1111-4111-8111-111111111111",
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000),
        user: testUser(),
      });

      const res = await request(app)
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${token}`)
        .send({ s3_key: "uploads/photo.jpg", latitude: 0, longitude: 0 });

      expect(res.status).toBe(400);
    });
  });
});
