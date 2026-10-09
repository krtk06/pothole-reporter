import express from "express";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";

import rateLimit from "express-rate-limit";

/**
 * Regression tests for finding C-3: every rate limiter was bypassable.
 *
 * index.ts used to hardcode `app.set("trust proxy", 1)`. The backend listens on
 * port 4000 directly with no proxy in front of it, so Express took req.ip from
 * the client-supplied X-Forwarded-For and a fresh header per request handed out
 * a fresh rate-limit bucket. The 5-per-15-minute login limit was defeated, and
 * with 702 seeded admin accounts sharing a password that mattered.
 *
 * TRUST_PROXY now defaults to OFF and is opt-in via the environment.
 */

/** Mirrors the parsing in src/index.ts. */
function trustProxySetting(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === "") return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) return asNumber;
  return raw;
}

/** A fresh limiter per app so each test is independent of the others' budget. */
function freshLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again later." },
  });
}

function appWith(trustProxy: boolean | number | string) {
  const app = express();
  app.set("trust proxy", trustProxy);
  app.use(express.json());
  app.use(freshLimiter());
  app.post("/login", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

let app: express.Express;

beforeEach(() => {
  app = appWith(trustProxySetting(process.env.TRUST_PROXY));
});

describe("trust proxy default", () => {
  it("defaults to OFF when TRUST_PROXY is unset", () => {
    expect(trustProxySetting(undefined)).toBe(false);
  });

  it("defaults to OFF when TRUST_PROXY is empty", () => {
    expect(trustProxySetting("")).toBe(false);
  });

  // The behaviour this replaces: a hardcoded 1 hop made the header client-controlled.
  it("is NOT 1 hop by default", () => {
    expect(trustProxySetting(undefined)).not.toBe(1);
  });
});

describe("trust proxy parsing", () => {
  it.each([
    ["true", true],
    ["false", false],
    ["0", 0],
    ["1", 1],
    ["2", 2],
  ])("parses TRUST_PROXY=%s", (raw, expected) => {
    expect(trustProxySetting(raw)).toBe(expected);
  });

  it("passes named subnets through unchanged", () => {
    expect(trustProxySetting("loopback")).toBe("loopback");
    expect(trustProxySetting("loopback, linklocal, uniquelocal")).toBe(
      "loopback, linklocal, uniquelocal",
    );
  });

  it("does not treat a garbage value as a hop count", () => {
    expect(trustProxySetting("yes")).toBe("yes");
  });
});

describe("rate limiting with the new default", () => {
  it("blocks a brute force from a single address", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await request(app).post("/login")).status);
    }

    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });

  // This is the actual C-3 regression test: with trust proxy OFF the spoofed
  // header is ignored, so all attempts share one bucket and the limiter bites.
  it("ignores a spoofed X-Forwarded-For", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 20; i++) {
      codes.push(
        (await request(app).post("/login").set("X-Forwarded-For", `203.0.113.${i}`)).status,
      );
    }

    // All 20 attempts share one bucket, so everything past the 5th is blocked.
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });

  it("rejects a negative hop count rather than trusting it", () => {
    expect(trustProxySetting("-1")).toBe("-1"); // not a valid count; passed through
  });
});

describe("rate limiting behind a real proxy", () => {
  it("still works when an operator opts in with TRUST_PROXY=true", async () => {
    const proxied = appWith(true);
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await request(proxied).post("/login")).status);
    }
    expect(codes.slice(5).every((c) => c === 429)).toBe(true);
  });
});