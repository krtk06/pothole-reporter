import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

// apiAuth.ts captures CONFIGURED_API_KEY at module load. ESM evaluates all
// imports before the test module body, so the key must be set in a hoisted
// block or the module sees it as unset.
const API_KEY = "contract-test-tender-key";
vi.hoisted(() => {
  process.env.TENDER_API_KEY = "contract-test-tender-key";
});

import { GET, POST } from "@/app/api/bids/route";

/**
 * Regression tests for finding C-2: POST /api/bids accepted anything.
 *
 * The previous handler validated four fields by truthiness only, which meant
 * bid_amount accepted NaN, negatives and the string "0", every string field was
 * unbounded, no rate limit applied, and GET returned every contractor's email
 * and phone to anonymous callers.
 */

function makeRequest(
  method: "GET" | "POST",
  opts: {
    body?: unknown;
    apiKey?: string;
    ip?: string;
    query?: string;
  } = {},
): Request {
  const url = `http://localhost:3001/api/bids${opts.query ?? ""}`;
  const headers = new Headers();
  if (method === "POST") headers.set("content-type", "application/json");
  if (opts.apiKey) headers.set("x-api-key", opts.apiKey);
  if (opts.ip) headers.set("x-forwarded-for", opts.ip);
  return new Request(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
  }) as unknown as Request;
}

/** The route handlers take NextRequest; the Web Request is structurally enough. */
async function call(
  handler: typeof GET | typeof POST,
  req: Request,
): Promise<{ status: number; body: any }> {
  const res: any = await handler(req as any);
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const validBid = {
  tender_id: "t-1",
  contractor_name: "Ravi Kumar",
  company_name: "Kumar Road Works",
  license_number: "AP/MOW/2019/4412",
  email: "ravi@kumarroadworks.example",
  phone: "+91 98765 43210",
  bid_amount: 450000,
  estimated_days: 30,
  proposal_notes: "We can mobilise within two weeks.",
};

const TENDER = {
  id: "t-1",
  block_id: "andhra pradesh/eluru/addateegala",
  district: "Eluru",
  mandal: "Addateegala",
  title: "Addateegala Road Restoration Tender",
  pothole_count: 22,
  estimated_cost: 3300,
  status: "open" as const,
  generated_at: "2026-09-02T09:00:00.000Z",
  deadline: "2026-10-02T09:00:00.000Z",
  potholes: [],
};

async function seedStore() {
  const { ingestSyncPayload } = await import("@/lib/tenderStore");
  await ingestSyncPayload({
    source: "pothole-reporter",
    sync_type: "scheduled",
    exported_at: "2026-09-02T09:00:00.000Z",
    triggered_by: "test",
    summary: { total_potholes: 0, total_tenders: 1 },
    tenders: [
      {
        id: TENDER.id,
        block_id: TENDER.block_id,
        pothole_count: TENDER.pothole_count,
        estimated_cost: TENDER.estimated_cost,
        status: "open",
        generated_at: TENDER.generated_at,
      },
    ],
    potholes: [],
  });
}

let counter = 0;
function nextIp() {
  counter += 1;
  // Rate limiting is per-IP with a 10/hour budget; give each case a fresh IP
  // unless a test is specifically exercising the limiter.
  return `203.0.113.${counter % 250}`;
}

beforeEach(async () => {
  fs.rmSync(path.join(process.cwd(), "data"), { recursive: true, force: true });
  await seedStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/bids validation", () => {
  it("accepts a well-formed bid", async () => {
    const { status, body } = await call(POST, makeRequest("POST", { body: validBid, ip: nextIp() }));
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.bid.bid_amount).toBe(450000);
  });

  it("rejects a missing tender_id", async () => {
    const { status, body } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, tender_id: "" }, ip: nextIp() }),
    );
    expect(status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("rejects a bid for an unknown tender instead of storing it", async () => {
    const { status, body } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, tender_id: "does-not-exist" }, ip: nextIp() }),
    );
    expect(status).toBe(404);
    expect(body.error).toBe("Unknown tender");
  });

  it("rejects a malformed body rather than throwing", async () => {
    const req = new Request("http://localhost:3001/api/bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    }) as unknown as Request;
    const { status } = await call(POST, req);
    expect(status).toBe(400);
  });
});

describe("POST /api/bids rejects implausible amounts", () => {
  // The old truthiness check (`!body.bid_amount`) accepted every one of these.
  it.each([
    ["a negative amount", -1],
    ["zero", 0],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a non-numeric string", "abc"],
    ["an absurd amount", 1e12],
  ])("rejects %s", async (_label, amount) => {
    const { status } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, bid_amount: amount }, ip: nextIp() }),
    );
    expect(status).toBe(400);
  });

  it("rejects a negative estimated_days", async () => {
    const { status } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, estimated_days: -5 }, ip: nextIp() }),
    );
    expect(status).toBe(400);
  });

  it("rejects a malformed email", async () => {
    const { status } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, email: "not-an-email" }, ip: nextIp() }),
    );
    expect(status).toBe(400);
  });

  it("rejects a phone containing markup", async () => {
    const { status } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, phone: "<script>alert(1)</script>" }, ip: nextIp() }),
    );
    expect(status).toBe(400);
  });

  it("rejects an over-long proposal", async () => {
    const { status } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, proposal_notes: "x".repeat(5000) }, ip: nextIp() }),
    );
    expect(status).toBe(400);
  });
});

/** BEL, NUL and TAB, built programmatically so this file stays plain text. */
const controlChars = `Ku${String.fromCharCode(7)}mar${String.fromCharCode(0)}	Works`;

describe("POST /api/bids strips control characters", () => {
  it("removes control characters from free text", async () => {
    const { status, body } = await call(
      POST,
      makeRequest("POST", {
        body: { ...validBid, company_name: controlChars },
        ip: nextIp(),
      }),
    );
    expect(status).toBe(201);
    expect(body.bid.company_name).toBe("Ku mar Works");
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u001f]/.test(body.bid.company_name)).toBe(false);
  });

  it("lowercases the email", async () => {
    const { body } = await call(
      POST,
      makeRequest("POST", { body: { ...validBid, email: "RAVI@Example.COM" }, ip: nextIp() }),
    );
    expect(body.bid.email).toBe("ravi@example.com");
  });
});

describe("POST /api/bids rejects bids on non-open tenders", () => {
  it("refuses a bid on a completed tender", async () => {
    const { getTenderData } = await import("@/lib/tenderStore");
    const store = await getTenderData();
    store.tenders[0].status = "completed";

    // Persist the change through the store's own writer.
    const fsmod = await import("fs");
    fsmod.writeFileSync(
      path.join(process.cwd(), "data/tenders.json"),
      JSON.stringify(store, null, 2),
      "utf-8",
    );

    const { status, body } = await call(
      POST,
      makeRequest("POST", { body: validBid, ip: nextIp() }),
    );
    expect(status).toBe(409);
    expect(body.error).toMatch(/not accepting bids/);
  });
});

describe("POST /api/bids rate limiting", () => {
  it("returns 429 after the per-IP budget is spent", async () => {
    const ip = "198.51.100.77";
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const { status } = await call(POST, makeRequest("POST", { body: validBid, ip }));
      codes.push(status);
    }
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
    expect(codes[codes.length - 1]).toBe(429);
  });

  it("gives a different client its own budget", async () => {
    const a = "198.51.100.10";
    const b = "198.51.100.11";
    for (let i = 0; i < 11; i++) {
      await call(POST, makeRequest("POST", { body: validBid, ip: a }));
    }
    const { status } = await call(POST, makeRequest("POST", { body: validBid, ip: b }));
    expect(status).not.toBe(429);
  });
});

describe("GET /api/bids redacts contact details", () => {
  it("omits email and phone from anonymous responses", async () => {
    await call(POST, makeRequest("POST", { body: validBid, ip: nextIp() }));

    const { status, body } = await call(GET, makeRequest("GET", { ip: nextIp() }));
    expect(status).toBe(200);
    expect(body.bids.length).toBe(1);
    expect(body.bids[0].email).toBeUndefined();
    expect(body.bids[0].phone).toBeUndefined();
    // The fields the public dossier renders are still present.
    expect(body.bids[0].company_name).toBe("Kumar Road Works");
    expect(body.bids[0].contractor_name).toBe("Ravi Kumar");
    expect(body.bids[0].license_number).toBe("AP/MOW/2019/4412");
    expect(body.bids[0].bid_amount).toBe(450000);
  });

  it("returns the full record when the tender API key is presented", async () => {
    await call(POST, makeRequest("POST", { body: validBid, ip: nextIp() }));

    const { body } = await call(GET, makeRequest("GET", { apiKey: API_KEY, ip: nextIp() }));
    expect(body.bids[0].email).toBe("ravi@kumarroadworks.example");
    expect(body.bids[0].phone).toBe("+91 98765 43210");
  });

  it("can filter by tender id", async () => {
    await call(POST, makeRequest("POST", { body: validBid, ip: nextIp() }));

    const hit = await call(GET, makeRequest("GET", { query: "?tender_id=t-1", ip: nextIp() }));
    const miss = await call(GET, makeRequest("GET", { query: "?tender_id=nope", ip: nextIp() }));
    expect(hit.body.bids.length).toBe(1);
    expect(miss.body.bids.length).toBe(0);
  });
});