import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import authRoutes from "../routes/auth";

// Build a minimal test app with just the auth routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/auth", authRoutes);
  return app;
}

describe("Auth Routes", () => {
  let app: express.Express;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
    process.env.JWT_EXPIRES_IN = "1h";
    process.env.JWT_REFRESH_EXPIRES_IN = "7d";
    process.env.FRONTEND_URL = "http://localhost:3000";
    process.env.DATABASE_URL = "postgresql://localhost:5432/test"; // won't actually connect
  });

  beforeEach(() => {
    app = createTestApp();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should validate request body", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "not-an-email", password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("should require name", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ email: "test@test.com", password: "password123" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject passwords shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ name: "Test", email: "test@test.com", password: "1234567" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should validate request body", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "not-email", password: "" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("should reject passwords shorter than 8 characters", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test@test.com", password: "1234567" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    it("should validate email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "not-email" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });

    it("should return success even for non-existent email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: "nonexistent@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("If that email is registered, a reset link has been sent.");
    });
  });

  describe("POST /api/v1/auth/reset-password", () => {
    it("should validate token and password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/reset-password")
        .send({ token: "", password: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
    });
  });
});
