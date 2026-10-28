import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import mapRoutes from "../routes/map";

const mockPrisma = vi.hoisted(() => ({ $queryRawUnsafe: vi.fn() }));

vi.mock("../config/database", () => ({ default: mockPrisma }));

function app() {
  const instance = express();
  instance.use("/api/v1/map", mapRoutes);
  return instance;
}

describe("public map API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one deduplicated marker per road issue plus pending reports", async () => {
    mockPrisma.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM road_issues ri")) {
        return [
          {
            id: "issue-1",
            latitude: 16.3,
            longitude: 80.4,
            status: "active",
            condition: "pothole",
            severity_score: "42.5",
            pothole_count: 2,
            evidence_count: 3,
            block_id: "andhra pradesh/eluru/addateegala",
            created_at: new Date(),
            last_detected_at: new Date(),
            image_s3_key: "uploads/a.jpg",
          },
        ];
      }
      if (sql.includes("FROM potholes p")) {
        return [
          {
            id: "pending-1",
            latitude: 16.31,
            longitude: 80.41,
            block_id: "andhra pradesh/eluru/addateegala",
            created_at: new Date(),
            last_detected_at: new Date(),
            image_s3_key: "uploads/b.jpg",
          },
        ];
      }
      return [];
    });

    const res = await request(app()).get("/api/v1/map/potholes?bbox=80.3,16.2,80.5,16.4");
    expect(res.status).toBe(200);
    expect(res.body.potholes).toHaveLength(2);
    expect(res.body.potholes[0]).toMatchObject({
      id: "issue-1",
      status: "verified",
      evidence_count: 3,
      severity_score: 42.5,
    });
    expect(res.body.potholes[1]).toMatchObject({ id: "pending-1", status: "pending", evidence_count: 1 });
  });

  it("rejects an invalid bbox", async () => {
    const res = await request(app()).get("/api/v1/map/potholes?bbox=bad");
    expect(res.status).toBe(400);
  });

  it("returns the area shape the main website selector expects", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: "lgd:district:745",
        name: "Eluru",
        level: "district",
        state_code: "28",
        state_name: "Andhra Pradesh",
        district_code: "745",
        district_name: "Eluru",
        subdistrict_code: null,
        subdistrict_name: null,
        latitude: 16.7,
        longitude: 81.1,
        bbox: { south: 16.4, west: 80.8, north: 17.0, east: 81.4 },
      },
    ]);

    const res = await request(app()).get("/api/v1/map/areas/options?level=district&state=Andhra%20Pradesh&q=El");
    expect(res.status).toBe(200);
    expect(res.body.options).toEqual(res.body.areas);
    expect(res.body.options[0]).toMatchObject({
      name: "Eluru",
      districtCode: "745",
      stateName: "Andhra Pradesh",
      latitude: 16.7,
      longitude: 81.1,
    });
    expect(res.body.options[0].bbox).toBeTruthy();
  });
});
