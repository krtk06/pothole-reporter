import { beforeEach, describe, expect, it, vi } from "vitest";

import "./helpers/auth";
import { mintAccessToken, STATE_ADMIN } from "./helpers/auth";

const mockPrisma = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));

import {
  resolveBlockIdFromCoordinates,
  resolveBlockIdIfMissing,
} from "../services/geoService";
import reportRoutes from "../routes/reports";

/**
 * Finding M-8: the mobile client sends only GPS, and POST /reports stored
 * `block_id || null`. A NULL block_id matches no admin scope predicate
 * (`block_id = $n OR block_id LIKE $n/%` is never true for NULL) and can never
 * reach the tender threshold, so mobile reports were invisible to admins and
 * could never generate a tender.
 *
 * These tests cover the nearest-neighbour resolution added alongside report
 * insertion.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBlockIdFromCoordinates", () => {
  it("prefers the nearest subdistrict and returns state/district/mandal", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        level: "subdistrict",
        state_name: "Andhra Pradesh",
        district_name: "Eluru",
        subdistrict_name: "Addateegala",
        meters: "4210.55",
      },
    ]);

    const result = await resolveBlockIdFromCoordinates(17.385, 78.4867);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("subdistrict");
    expect(result!.blockId).toBe("andhra pradesh/eluru/addateegala");
    expect(result!.meters).toBeCloseTo(4210.55, 1);
  });

  it("passes (longitude, latitude) in the order ST_MakePoint expects", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await resolveBlockIdFromCoordinates(17.385, 78.4867);

    const call = mockPrisma.$queryRawUnsafe.mock.calls[0];
    // ST_MakePoint(x=longitude, y=latitude); swapping these silently resolves
    // to the wrong hemisphere.
    expect(call[1]).toBe(78.4867);
    expect(call[2]).toBe(17.385);
  });

  it("uses a geography cast so distance is measured in metres", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    await resolveBlockIdFromCoordinates(17.385, 78.4867);
    expect(mockPrisma.$queryRawUnsafe.mock.calls[0][0]).toContain("::geography");
  });

  it("ignores rows whose distance exceeds the cap", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    await resolveBlockIdFromCoordinates(17.385, 78.4867);
    expect(mockPrisma.$queryRawUnsafe.mock.calls[0][3]).toBe(75_000);
  });

  it("only considers areas that have been backfilled with coordinates", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    await resolveBlockIdFromCoordinates(17.385, 78.4867);
    const sql = mockPrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain("latitude IS NOT NULL");
    expect(sql).toContain("longitude IS NOT NULL");
  });

  it("falls back to district when no subdistrict matches", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { level: "district", state_name: "Andhra Pradesh", district_name: "Kakinada", subdistrict_name: null, meters: "9000" },
    ]);

    const result = await resolveBlockIdFromCoordinates(17.0, 82.0);
    expect(result!.blockId).toBe("andhra pradesh/kakinada");
  });

  it("falls back to state when nothing more specific matches", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { level: "state", state_name: "Andhra Pradesh", district_name: null, subdistrict_name: null, meters: "50000" },
    ]);

    const result = await resolveBlockIdFromCoordinates(17.0, 82.0);
    expect(result!.blockId).toBe("andhra pradesh");
  });

  it("returns null when nothing is within range", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    expect(await resolveBlockIdFromCoordinates(17.385, 78.4867)).toBeNull();
  });

  it("skips rows that cannot form a usable block_id", async () => {
    // A subdistrict row with a blank district_name cannot produce a 3-part id.
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { level: "subdistrict", state_name: "", district_name: "", subdistrict_name: "", meters: "100" },
      { level: "state", state_name: "Andhra Pradesh", district_name: null, subdistrict_name: null, meters: "90000" },
    ]);

    const result = await resolveBlockIdFromCoordinates(17.385, 78.4867);
    expect(result!.level).toBe("state");
  });

  it("normalises casing and spacing to match admin scope prefixes", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        level: "subdistrict",
        state_name: "  ANDHRA   PRADESH ",
        district_name: "Eluru",
        subdistrict_name: "Addateegala",
        meters: "100",
      },
    ]);

    const result = await resolveBlockIdFromCoordinates(17.385, 78.4867);
    expect(result!.blockId).toBe("andhra pradesh/eluru/addateegala");
  });
});

describe("resolveBlockIdIfMissing", () => {
  it("never overrides a block_id the client supplied", async () => {
    const resolved = await resolveBlockIdIfMissing(
      "telangana/hyderabad/amberpet",
      17.385,
      78.4867,
    );

    expect(resolved).toBe("telangana/hyderabad/amberpet");
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("resolves when the client sent nothing", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { level: "subdistrict", state_name: "Andhra Pradesh", district_name: "Eluru", subdistrict_name: "Addateegala", meters: "10" },
    ]);

    expect(await resolveBlockIdIfMissing(null, 17.385, 78.4867)).toBe(
      "andhra pradesh/eluru/addateegala",
    );
  });

  it("returns null rather than throwing when the lookup fails", async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("DB down"));

    // A report must still be accepted if geocoding is unavailable.
    await expect(resolveBlockIdIfMissing(undefined, 17.385, 78.4867)).resolves.toBeNull();
  });

  it("returns null when nothing is backfilled yet", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    expect(await resolveBlockIdIfMissing(undefined, 17.385, 78.4867)).toBeNull();
  });
});

describe("POST /reports assigns block_id", () => {
  function app() {
    const express = require("express");
    const cookieParser = require("cookie-parser");
    const a = express();
    a.use(express.json());
    a.use(cookieParser());
    a.use("/api/v1/reports", reportRoutes);
    return a;
  }

  const auth = { Authorization: `Bearer ${mintAccessToken(STATE_ADMIN)}` };
  const body = { s3_key: "uploads/x.jpg", latitude: 17.385, longitude: 78.4867 };

  it("stores a resolved block_id when the client sends none", async () => {
    // first call = the resolution query, second = the INSERT
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        { level: "subdistrict", state_name: "Andhra Pradesh", district_name: "Eluru", subdistrict_name: "Addateegala", meters: "500" },
      ])
      .mockResolvedValueOnce([
        { id: "44444444-4444-4444-8444-444444444444", status: "pending", block_id: "andhra pradesh/eluru/addateegala" },
      ]);

    const request = require("supertest");
    const res = await request(app()).post("/api/v1/reports").set(auth).send(body);

    expect(res.status).toBe(201);
    expect(res.body.block_id).toBe("andhra pradesh/eluru/addateegala");
    expect(res.body.block_resolved).toBe(true);

    const insert = mockPrisma.$queryRawUnsafe.mock.calls[1];
    expect(insert[0]).toContain("INSERT INTO potholes");
    expect(insert[6]).toBe("andhra pradesh/eluru/addateegala");
  });

  it("still accepts a report when nothing can be resolved", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([])                        // resolution finds nothing
      .mockResolvedValueOnce([
        { id: "44444444-4444-4444-8444-444444444444", status: "pending", block_id: null },
      ]);

    const request = require("supertest");
    const res = await request(app()).post("/api/v1/reports").set(auth).send(body);

    expect(res.status).toBe(201);
    expect(res.body.block_id).toBeNull();
    expect(res.body.block_resolved).toBe(false);
    expect(mockPrisma.$queryRawUnsafe.mock.calls[1][6]).toBeNull();
  });

  it("uses a client-supplied block_id verbatim and does no lookup", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
      { id: "44444444-4444-4444-8444-444444444444", status: "pending", block_id: "telangana/hyderabad/amberpet" },
    ]);

    const request = require("supertest");
    const res = await request(app())
      .post("/api/v1/reports")
      .set(auth)
      .send({ ...body, block_id: "telangana/hyderabad/amberpet" });

    expect(res.status).toBe(201);
    expect(res.body.block_resolved).toBe(false);
    // Exactly one query — the INSERT. No resolution query at all.
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it("returns block_id in the INSERT ... RETURNING clause", async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "44444444-4444-4444-8444-444444444444", status: "pending", block_id: null },
      ]);

    const request = require("supertest");
    await request(app()).post("/api/v1/reports").set(auth).send(body);

    expect(mockPrisma.$queryRawUnsafe.mock.calls[1][0]).toMatch(/RETURNING[\s\S]*block_id/);
  });
});