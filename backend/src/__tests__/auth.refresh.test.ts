import crypto from "crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ID, JWT_REFRESH_SECRET, mintRefreshToken } from "./helpers/auth";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn((operation: Promise<unknown>[] | ((tx: any) => Promise<unknown>)) => {
    if (typeof operation === "function") return operation(mockPrisma);
    return Promise.all(operation);
  }),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/emailService", () => ({ sendPasswordResetEmail: vi.fn() }));

import authRoutes from "../routes/auth";
import { refreshAccessToken } from "../services/authService";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/auth", authRoutes);
  return app;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function userWithRefresh(refreshToken: string | null) {
  return {
    id: ADMIN_ID,
    name: "Test User",
    email: "test@example.com",
    phone: null,
    password_hash: "hash",
    role: "admin",
    admin_scope: "district",
    state: "Andhra Pradesh",
    district: "Eluru",
    mandal: null,
    theme_preference: "dark",
    refresh_token: refreshToken === null ? null : sha256(refreshToken),
    created_at: new Date(),
  };
}

let app: express.Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
  mockPrisma.user.update.mockResolvedValue(userWithRefresh(null));
});

describe("refresh token rotation is single-use", () => {
  it("rejects a token whose hash is not the stored hash", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh("a-different-token"));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: mintRefreshToken() });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it("rejects a refresh token for a user that no longer exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: mintRefreshToken() });

    expect(res.status).toBe(401);
  });

  it("rejects a refresh token signed with the wrong secret", async () => {
    const foreign = crypto
      .createHmac("sha256", "some-other-secret")
      .update(ADMIN_ID)
      .digest("hex");

    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(foreign));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: mintRefreshToken() });

    expect(res.status).toBe(401);
  });

  it("stores only the hash of the new refresh token", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token });

    const stored = mockPrisma.user.update.mock.calls[0][0].data.refresh_token as string;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toBe(token);
    expect(stored).not.toContain(token);
  });

  it("returns 401 when the token is used a second time after rotation", async () => {
    const token = mintRefreshToken();
    const user = userWithRefresh(token);
    // First use rotates the stored hash; the DB now holds the *new* token's hash.
    mockPrisma.user.findUnique.mockResolvedValueOnce(user);
    mockPrisma.user.update.mockImplementation(async ({ data }: any) => ({
      ...user,
      refresh_token: data.refresh_token,
    }));

    const first = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token });
    expect(first.status).toBe(200);
    const rotatedTo = mockPrisma.user.update.mock.calls[0][0].data.refresh_token as string;

    // Second use of the original token must now fail.
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...user, refresh_token: rotatedTo });
    const second = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token });
    expect(second.status).toBe(401);
  });

  it("carries the admin jurisdiction claims into the new access token", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Client-Platform", "mobile")
      .send({ refreshToken: token });

    const decoded = JSON.parse(
      Buffer.from(String(res.body.accessToken).split(".")[1], "base64url").toString(),
    );
    expect(decoded).toMatchObject({
      userId: ADMIN_ID,
      role: "admin",
      admin_scope: "district",
      admin_state: "Andhra Pradesh",
      admin_district: "Eluru",
    });
    // mandal is null on this user, so the claim must be omitted entirely rather
    // than serialised as null.
    expect(decoded).not.toHaveProperty("admin_mandal");
  });
});

describe("refresh token double-rotation race", () => {
  // Finding M-7: authService.ts:151-163 is read-then-write with no
  // conditional updateMany guard. Two concurrent refreshes carrying the same
  // token both pass the hash check and both mint a valid pair; the second write
  // silently invalidates the pair the first caller just received. Both clients
  // auto-retry on 401 and fire 3-4 requests in parallel, so this is reachable
  // in normal use. Not fixed per scope of work. Tracked in AUDIT_REPORT.md.
  it("lets two concurrent refreshes with the same token both succeed", async () => {
    const token = mintRefreshToken();
    // The DB keeps returning the OLD hash to both callers — exactly the
    // interleaving that a real concurrent pair produces before either write lands.
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const [a, b] = await Promise.all([
      refreshAccessToken(token),
      refreshAccessToken(token),
    ]);

    expect(a.accessToken).toBeTruthy();
    expect(b.accessToken).toBeTruthy();
    // Both callers were issued a token pair the server will accept.
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
  });
});

describe("refresh tokens are not unique", () => {
  // Finding (new, surfaced by this suite): generateRefreshToken signs
  // { userId, role } with no `jti` and no nonce. jsonwebtoken stamps `iat` with
  // whole-second resolution, so two rotations for the same user inside one
  // second produce byte-identical tokens. "Rotation" is therefore a no-op
  // within a second, and the old token is never actually invalidated. Not fixed
  // per scope of work. Tracked in AUDIT_REPORT.md.
  it("issues byte-identical tokens for two rotations in the same second", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const [a, b] = await Promise.all([
      refreshAccessToken(token),
      refreshAccessToken(token),
    ]);

    expect(a.refreshToken).toBe(b.refreshToken);
  });

  it("carries no jti or nonce claim", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const { refreshToken } = await refreshAccessToken(token);
    const decoded = JSON.parse(
      Buffer.from(String(refreshToken).split(".")[1], "base64url").toString(),
    );

    // Nothing in the payload varies between two rotations, which is what makes
    // the tokens collide inside one second.
    expect(decoded).not.toHaveProperty("jti");
    expect(decoded).not.toHaveProperty("nonce");
    expect(decoded).not.toHaveProperty("random");
  });
});

describe("refresh endpoint input handling", () => {
  it("returns 400 with no token in body or cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refresh token required/i);
  });

  it("accepts the token from a cookie as well as the body", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", [`refreshToken=${token}`]);

    expect(res.status).toBe(200);
  });

  // Finding M-9: index.ts registers express.json() but never express.urlencoded(),
  // so an application/x-www-form-urlencoded POST has no req.body at all.
  // Tracked in AUDIT_REPORT.md.
  it("cannot read a urlencoded form body", async () => {
    const token = mintRefreshToken();
    mockPrisma.user.findUnique.mockResolvedValue(userWithRefresh(token));

    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .type("form")
      .send({ refreshToken: token });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refresh token required/i);
  });
});