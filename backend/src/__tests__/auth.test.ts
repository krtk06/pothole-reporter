import crypto from "crypto";
import express from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import request from "supertest";
import cookieParser from "cookie-parser";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import authRoutes from "../routes/auth";
import reportRoutes from "../routes/reports";
import { resetPassword } from "../services/authService";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn((operation: Promise<unknown>[] | ((tx: any) => Promise<unknown>)) => {
    if (typeof operation === "function") {
      return operation(mockPrisma);
    }
    return Promise.all(operation);
  }),
}));

vi.mock("../config/database", () => ({
  default: mockPrisma,
}));

vi.mock("../services/emailService", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

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
    password_hash: "hash",
    role: "public",
    theme_preference: "dark",
    refresh_token: null,
    created_at: new Date(),
    ...overrides,
  };
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(`${token}.${process.env.JWT_RESET_SECRET}`).digest("hex");
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
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe("POST /api/v1/auth/register", () => {
    it("validates request body", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "not-an-email", password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("does not expose refreshToken to web clients", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(testUser());
      mockPrisma.user.update.mockResolvedValue(testUser());

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ name: "Test User", email: "test@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeUndefined();
    });

    it("returns refreshToken to mobile clients", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(testUser());
      mockPrisma.user.update.mockResolvedValue(testUser());

      const res = await request(app)
        .post("/api/v1/auth/register")
        .set("X-Client-Platform", "mobile")
        .send({ name: "Test User", email: "test@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("validates request body", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "not-email", password: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns rotated refreshToken to mobile clients", async () => {
      const refreshToken = jwt.sign(
        { userId: "11111111-1111-4111-8111-111111111111", role: "public" },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d", algorithm: "HS256" } as SignOptions
      );
      const refreshHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      mockPrisma.user.findUnique.mockResolvedValue(testUser({ refresh_token: refreshHash }));
      mockPrisma.user.update.mockResolvedValue(testUser());

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("X-Client-Platform", "mobile")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    it("validates email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "not-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("returns success even for non-existent email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nonexistent@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("If that email is registered, a reset link has been sent.");
    });
  });

  describe("resetPassword", () => {
    it("accepts an unused, unexpired reset token once", async () => {
      const token = "plain-reset-token";
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        token_hash: hashResetToken(token),
        expires_at: new Date(Date.now() + 60_000),
        used_at: null,
      });
      mockPrisma.user.update.mockResolvedValue(testUser());
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });

      await expect(resetPassword(token, "password123")).resolves.toBeUndefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ refresh_token: null }),
      }));
      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ used_at: null }),
      }));
    });

    it("rejects a used reset token", async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        token_hash: hashResetToken("used-token"),
        expires_at: new Date(Date.now() + 60_000),
        used_at: new Date(),
      });

      await expect(resetPassword("used-token", "password123")).rejects.toThrow("Invalid or expired reset token");
    });

    it("rejects an expired reset token", async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        token_hash: hashResetToken("expired-token"),
        expires_at: new Date(Date.now() - 60_000),
        used_at: null,
      });

      await expect(resetPassword("expired-token", "password123")).rejects.toThrow("Invalid or expired reset token");
    });
  });

  describe("POST /api/v1/reports", () => {
    it("rejects placeholder zero coordinates", async () => {
      const accessToken = jwt.sign(
        { userId: "11111111-1111-4111-8111-111111111111", role: "public" },
        process.env.JWT_SECRET!,
        { expiresIn: "1h", algorithm: "HS256" } as SignOptions
      );

      const res = await request(app)
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ s3_key: "uploads/photo.jpg", latitude: 0, longitude: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });
});
