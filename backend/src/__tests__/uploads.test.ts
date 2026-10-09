import express from "express";
import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mintAccessToken, STATE_ADMIN } from "./helpers/auth";

// Neutralise the shared limiter singletons so these tests exercise the upload
// filter rather than tripping the 5-per-15-minutes bucket.
vi.mock("../middleware/rateLimiter", () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    uploadLimiter: passthrough,
    loginLimiter: passthrough,
    generalLimiter: passthrough,
    refreshLimiter: passthrough,
    forgotPasswordLimiter: passthrough,
  };
});

vi.mock("../config/database", () => ({
  default: { $queryRawUnsafe: vi.fn(), $queryRaw: vi.fn() },
}));

import localUploadRoutes from "../routes/localUploads";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/uploads", localUploadRoutes);
  return app;
}

// multer's diskStorage resolves relative to backend/uploads for both the `src/`
// (tsx) and `dist/` (node) layouts.
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

let app: express.Express;
/** Directory snapshot taken before each test, so any file written is removed. */
let baseline: Set<string>;

function filesInUploadDir(): Set<string> {
  try {
    return new Set(fs.readdirSync(UPLOAD_DIR));
  } catch {
    return new Set();
  }
}

afterEach(() => {
  for (const name of filesInUploadDir()) {
    if (baseline.has(name)) continue;
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, name));
    } catch {
      /* best effort */
    }
  }
});

beforeEach(() => {
  baseline = filesInUploadDir();
  app = createApp();
});

function auth() {
  return { Authorization: `Bearer ${mintAccessToken(STATE_ADMIN)}` };
}

describe("POST /uploads/local", () => {
  it("rejects an unauthenticated upload", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .attach("file", Buffer.from("data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(401);
  });

  it("rejects a request with no file", async () => {
    const res = await request(app).post("/api/v1/uploads/local").set(auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No file provided");
  });

  it("rejects a non-image content type", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from("id,name\n1,a"), {
        filename: "data.csv",
        contentType: "text/csv",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only image files/i);
  });

  it("rejects a declared non-image content type", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from("#!/bin/sh\nrm -rf /"), {
        filename: "payload.jpg",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only image files/i);
  });

  // Finding S-4: the fileFilter trusts the client-declared mimetype and never
  // inspects the bytes. A plain-text payload renamed `.txt` but declared as
  // image/png is accepted and written to disk with a .txt extension. There is
  // no magic-byte check and no extension allowlist. Not fixed per scope of
  // work. Tracked in AUDIT_REPORT.md.
  it("accepts a non-image payload that merely declares an image content type", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from("this is plain text, not an image"), {
        filename: "notes.txt",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/\.txt$/);

    const onDisk = path.join(UPLOAD_DIR, res.body.key.replace(/^uploads\//, ""));
    expect(fs.readFileSync(onDisk, "utf8")).toBe("this is plain text, not an image");
  });

  it("stores a JPEG and returns an uploads/ key", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: "road.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/^uploads\/[0-9a-f-]{36}\.jpg$/);
  });

  // Finding S-4: the only validation is a client-supplied `mimetype` prefix
  // check — no extension allowlist, no magic-byte inspection. The stored
  // extension is taken verbatim from the client filename. An SVG therefore
  // lands in the uploads directory and is then served by
  // `app.use("/api/v1/files", authenticate, express.static(uploadsDir))` from
  // the API origin, where SVG script executes against the auth cookies scoped
  // to `path: "/"`. Not fixed per scope of work. Tracked in AUDIT_REPORT.md.
  it("accepts an SVG because the mimetype prefix check passes", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/api/v1/auth/refresh")</script></svg>',
    );

    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", svg, {
        filename: "payload.svg",
        contentType: "image/svg+xml",
      });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/\.svg$/);

    // Confirms the file is really written to disk with the .svg extension, which
    // is what makes express.static serve it as image/svg+xml.
    const onDisk = path.join(UPLOAD_DIR, res.body.key.replace(/^uploads\//, ""));
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk, "utf8")).toContain("<script>");
  });

  it("accepts a double extension", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: "evil.jpg.svg",
        contentType: "image/svg+xml",
      });

    expect(res.status).toBe(200);
    expect(res.body.key).toMatch(/\.svg$/);
  });

  it("rejects a file over the 10MB limit", async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1024, 1);

    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", big, {
        filename: "big.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file too large/i);
  });

  it("stores the file under a uuid, never the client filename", async () => {
    const res = await request(app)
      .post("/api/v1/uploads/local")
      .set(auth())
      .attach("file", Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        filename: "../../etc/passwd.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    // uuid() prefix means traversal via the original name is not possible even
    // though extname() is trusted.
    expect(res.body.key).toMatch(/^uploads\/[0-9a-f-]{36}\.jpg$/);
    expect(res.body.key).not.toContain("..");
  });
});