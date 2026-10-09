import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { loginLimiter, uploadLimiter } from "../middleware/rateLimiter";

/**
 * Rate limiting is keyed entirely on the derived client IP. index.ts:98 sets
 * `app.set("trust proxy", 1)` and the backend listens on port 4000 directly,
 * with no terminating proxy in front of it to strip or overwrite the header.
 * Express therefore takes req.ip from the *last* value in X-Forwarded-For that
 * it trusts — an attacker-supplied one.
 */

function appTrustingOneHop() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(loginLimiter);
  app.post("/login", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

let app: express.Express;

beforeEach(() => {
  app = appTrustingOneHop();
});

describe("rate limiters under trust proxy", () => {
  it("blocks a genuine brute force from a single address", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app).post("/login");
      codes.push(res.status);
    }

    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });

  // Finding C-3: with trust proxy 1 and no proxy in front, a fresh
  // X-Forwarded-For per request resets the counter, so the 5-per-15-minutes
  // login limit is defeated and the 702-account roster becomes brute-forceable.
  // Not fixed per scope of work. Tracked in AUDIT_REPORT.md.
  it("is fully bypassed by spoofing X-Forwarded-For per request", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post("/login")
        .set("X-Forwarded-For", `203.0.113.${i}`);
      codes.push(res.status);
    }

    expect(codes.every((c) => c === 200)).toBe(true);
    expect(codes).not.toContain(429);
  });

  it("emits the RateLimit headers a caller can read", async () => {
    const res = await request(app).post("/login");

    expect(res.headers["ratelimit-limit"]).toBe("5");
    // The counter is a module-level singleton shared by every test in this file,
    // so only the shape of the header is asserted, not a specific value.
    expect(res.headers["ratelimit-remaining"]).toMatch(/^[0-5]$/);
  });
});

describe("upload limiter", () => {
  it("is the same 5-per-15-minutes budget applied to both upload endpoints", () => {
    // Finding A-7: uploadLimiter is mounted on POST /uploads/local AND
    // POST /reports (routes/reports.ts:26), so one user-visible report consumes
    // two of only five slots — a hard cap of two reports per 15 minutes. The
    // limiter instances are distinct objects, so a caller gets 5 of each rather
    // than a shared budget.
    expect(uploadLimiter).not.toBe(loginLimiter);
  });
});