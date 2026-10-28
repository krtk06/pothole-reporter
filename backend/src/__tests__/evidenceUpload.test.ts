import fs from "fs";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import uploadRoutes from "../routes/localUploads";

const mockPrisma = vi.hoisted(() => ({
  userSession: {
    findUnique: vi.fn(async () => ({
      id: "session",
      user_id: "11111111-1111-4111-8111-111111111111",
      revoked_at: null,
      expires_at: new Date(Date.now() + 60_000),
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        role: "public",
        state: null,
        district: null,
        locality: null,
        admin_scope: null,
      },
    })),
  },
  $queryRawUnsafe: vi.fn(async (sql: string) => {
    if (sql.includes("INSERT INTO potholes")) {
      return [{ id: "33333333-3333-4333-8333-333333333333", status: "pending" }];
    }
    return [];
  }),
  $executeRawUnsafe: vi.fn(async () => 1),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));
vi.mock("../services/privateAiService", () => ({
  analyzeEvidenceWithPrivateAi: vi.fn(async () => undefined),
}));

const createdFiles: string[] = [];
const uploadsDirectory = path.resolve(__dirname, "../../uploads");

function makeApp() {
  const app = express();
  app.use("/api/v1/uploads", uploadRoutes);
  return app;
}

function accessToken() {
  return jwt.sign(
    { userId: "11111111-1111-4111-8111-111111111111", role: "public", sid: "session" },
    process.env.JWT_SECRET!,
    { algorithm: "HS256", expiresIn: "1h", issuer: "pothole-reporter", audience: "pothole-reporter-web" },
  );
}

function roadMetadata() {
  const startedAt = Date.now();
  return {
    schemaVersion: 1,
    captureId: `capture-${startedAt}-test`,
    mode: "road",
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(startedAt + 1000).toISOString(),
    durationMs: 1000,
    locationTrack: [
      {
        elapsedMs: 0,
        capturedAt: new Date(startedAt).toISOString(),
        latitude: 16.3067,
        longitude: 80.4365,
        accuracy: 5,
        altitude: null,
        heading: 90,
        speed: 1.2,
      },
      {
        elapsedMs: 1000,
        capturedAt: new Date(startedAt + 1000).toISOString(),
        latitude: 16.3068,
        longitude: 80.4366,
        accuracy: 5,
        altitude: null,
        heading: 90,
        speed: 1.2,
      },
    ],
    motionTrack: [],
  };
}

const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  0x00, 0x00, 0x00, 0x00,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe("raw evidence upload", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    fs.mkdirSync(uploadsDirectory, { recursive: true });
  });

  afterEach(async () => {
    await Promise.all(createdFiles.splice(0).map((file) => fs.promises.unlink(file).catch(() => undefined)));
  });

  it("stores a road video with its synchronized metadata sidecar", async () => {
    const response = await request(makeApp())
      .post("/api/v1/uploads/evidence")
      .set("Authorization", `Bearer ${accessToken()}`)
      .field("metadata", JSON.stringify(roadMetadata()))
      .attach("media", MP4_BYTES, { filename: "road.mp4", contentType: "video/mp4" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("pending");
    expect(response.body.report_id).toBe("33333333-3333-4333-8333-333333333333");
    expect(response.body.media_key).toMatch(/^uploads\/.+\.mp4$/);
    expect(response.body.metadata_key).toMatch(/^uploads\/\.metadata\/.+\.json$/);

    const mediaPath = path.join(uploadsDirectory, path.basename(response.body.media_key));
    const metadataPath = path.join(uploadsDirectory, ".metadata", path.basename(response.body.metadata_key));
    createdFiles.push(mediaPath, metadataPath);
    expect(fs.existsSync(mediaPath)).toBe(true);
    const sidecar = JSON.parse(await fs.promises.readFile(metadataPath, "utf8"));
    expect(sidecar.reporterId).toBe("11111111-1111-4111-8111-111111111111");
    expect(sidecar.capture.locationTrack).toHaveLength(2);
  });

  it("rejects a photo when the metadata says it is a road video", async () => {
    const before = new Set(await fs.promises.readdir(uploadsDirectory));
    const response = await request(makeApp())
      .post("/api/v1/uploads/evidence")
      .set("Authorization", `Bearer ${accessToken()}`)
      .field("metadata", JSON.stringify(roadMetadata()))
      .attach("media", JPEG_BYTES, { filename: "pothole.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
    const after = await fs.promises.readdir(uploadsDirectory);
    expect(after.filter((name) => !before.has(name))).toEqual([]);
  });

  it("rejects a file whose bytes are not the declared media type", async () => {
    const response = await request(makeApp())
      .post("/api/v1/uploads/local")
      .set("Authorization", `Bearer ${accessToken()}`)
      .attach("file", Buffer.from("not an image"), { filename: "fake.jpg", contentType: "image/jpeg" });

    expect(response.status).toBe(400);
  });
});
