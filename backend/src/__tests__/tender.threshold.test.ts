import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// POTHOLE_TENDER_THRESHOLD is read exactly once, at tenderService module load
// (tenderService.ts:4). Setting it here — before the dynamic import below — is
// the only way to exercise a non-default threshold. The default of 5 is what
// production gets when the var is unset, so both are covered below.
vi.hoisted(() => {
  process.env.POTHOLE_TENDER_THRESHOLD = "20";
});

const mockPrisma = vi.hoisted(() => ({
  tender: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
}));

vi.mock("../config/database", () => ({ default: mockPrisma }));

const pushBlockToTenderWebsite = vi.hoisted(() =>
  vi.fn(async () => undefined as void),
);

vi.mock("../services/tenderSyncService", () => ({ pushBlockToTenderWebsite }));

type TenderService = typeof import("../services/tenderService");

let svc: TenderService;

/** prisma's COUNT(*)::bigint comes back as a string over the wire. */
function countOf(n: number) {
  return [{ count: String(n) }];
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  svc = await import("../services/tenderService");
});

describe("checkAndGenerateTender threshold gate", () => {
  it("does not create a tender below the threshold", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(19));

    const generated = await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    expect(generated).toBe(false);
    expect(mockPrisma.tender.create).not.toHaveBeenCalled();
    expect(pushBlockToTenderWebsite).not.toHaveBeenCalled();
  });

  it("creates a tender exactly at the threshold", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    const generated = await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    expect(generated).toBe(true);
    expect(mockPrisma.tender.create).toHaveBeenCalledWith({
      data: {
        block_id: "andhra pradesh/eluru/x",
        pothole_count: 20,
        estimated_cost: 3000,
      },
    });
  });

  it("creates a tender above the threshold using the real count", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(37));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    expect(mockPrisma.tender.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pothole_count: 37, estimated_cost: 5550 }),
    });
  });

  it("only counts verified potholes in that exact block", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(0));

    await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    const { sql, params } = (() => {
      const call = mockPrisma.$queryRawUnsafe.mock.calls[0];
      return { sql: call[0] as string, params: call.slice(1) as unknown[] };
    })();

    expect(sql).toContain("status = 'verified'");
    expect(sql).toContain("block_id = $1");
    // Exact match, never a prefix match — a mandal admin must not inflate a
    // block's count with a sibling block's potholes.
    expect(sql).not.toContain("LIKE");
    expect(params).toEqual(["andhra pradesh/eluru/x"]);
  });
});

describe("checkAndGenerateTender idempotency", () => {
  it("does not create a second tender when one is already open", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(25));
    mockPrisma.tender.findFirst.mockResolvedValue({ id: "t1", status: "open" });

    const generated = await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    expect(generated).toBe(false);
    expect(mockPrisma.tender.create).not.toHaveBeenCalled();
    expect(pushBlockToTenderWebsite).not.toHaveBeenCalled();
  });

  it("treats an assigned tender as already tendered", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(25));
    mockPrisma.tender.findFirst.mockResolvedValue({ id: "t1", status: "assigned" });

    expect(await svc.checkAndGenerateTender("b")).toBe(false);
    expect(mockPrisma.tender.create).not.toHaveBeenCalled();
  });

  it("checks only for open/assigned tenders so a withdrawn one can be re-tendered", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(25));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    await svc.checkAndGenerateTender("b");

    expect(mockPrisma.tender.findFirst).toHaveBeenCalledWith({
      where: { block_id: "b", status: { in: ["open", "assigned"] } },
    });
  });

  it("counts reported potholes as 0 when the query returns nothing", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    expect(await svc.checkAndGenerateTender("b")).toBe(false);
    expect(mockPrisma.tender.create).not.toHaveBeenCalled();
  });
});

describe("threshold dispatch to the tender website", () => {
  it("pushes the block immediately with the threshold trigger", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    await svc.checkAndGenerateTender("andhra pradesh/eluru/x");

    expect(pushBlockToTenderWebsite).toHaveBeenCalledWith(
      "andhra pradesh/eluru/x",
      "threshold",
    );
  });

  // Finding: the push is fire-and-forget (`.catch(() => {})` at
  // tenderService.ts:31) and is NOT awaited, so a rejection escapes this test
  // as an unhandled rejection rather than surfacing to the caller. The tender
  // row is already committed by then. Tracked in AUDIT_REPORT.md (P-2).
  it("swallows a failed push rather than failing the request", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});
    pushBlockToTenderWebsite.mockRejectedValueOnce(new Error("portal unreachable"));

    await expect(svc.checkAndGenerateTender("b")).resolves.toBe(true);
    // The tender row exists regardless — the portal only learns on the next
    // scheduled sync, and the periodic sync excludes tendered blocks.
    expect(mockPrisma.tender.create).toHaveBeenCalled();
  });

  it("resolves before the push completes", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    let settled = false;
    pushBlockToTenderWebsite.mockImplementationOnce(
      async () => new Promise<void>((r) => setTimeout(r, 50)),
    );

    await svc.checkAndGenerateTender("b");
    settled = true;
    expect(settled).toBe(true);
    expect(pushBlockToTenderWebsite).toHaveBeenCalled();
  });
});

describe("duplicate-tender race", () => {
  // Findings H-1/B-1. checkAndGenerateTender is check-then-act: it reads for an
  // existing open/assigned tender and then inserts, non-atomically. Wiring
  // PATCH /admin/reports/:id through this function (Phase 3) made it reachable
  // from the admin UI, so the race became live rather than theoretical.
  //
  // The fix is the partial unique index
  // "tenders_block_id_open_assigned_key" (migration
  // 20261008000000_add_tenders_block_unique_open) plus a P2002 catch below.
  // These tests describe both halves: what the code does without a database
  // enforcing the index, and what it does once the index rejects the loser.
  it("issues two unguarded inserts when no unique index is enforced", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    mockPrisma.tender.create.mockResolvedValue({});

    const [a, b] = await Promise.all([
      svc.checkAndGenerateTender("same/block"),
      svc.checkAndGenerateTender("same/block"),
    ]);

    expect([a, b]).toEqual([true, true]);
    expect(mockPrisma.tender.create).toHaveBeenCalledTimes(2);
  });

  it("lets exactly one of two racing verifies win once the index exists", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);

    // Stand in for the partial unique index: the first insert commits, the
    // second is rejected with Prisma's unique-constraint error.
    let inserts = 0;
    mockPrisma.tender.create.mockImplementation(async () => {
      inserts += 1;
      if (inserts === 1) return {};
      const err: any = new Error("Unique constraint failed on the fields: (`block_id`)");
      err.code = "P2002";
      throw err;
    });

    const [a, b] = await Promise.all([
      svc.checkAndGenerateTender("same/block"),
      svc.checkAndGenerateTender("same/block"),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(mockPrisma.tender.create).toHaveBeenCalledTimes(2);
  });

  it("treats a P2002 as 'a tender already exists' rather than an error", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    const err: any = new Error("Unique constraint failed");
    err.code = "P2002";
    mockPrisma.tender.create.mockRejectedValue(err);

    await expect(svc.checkAndGenerateTender("b")).resolves.toBe(false);
  });

  it("does not push to the tender website for the loser of the race", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    const err: any = new Error("Unique constraint failed");
    err.code = "P2002";
    mockPrisma.tender.create.mockRejectedValue(err);

    await svc.checkAndGenerateTender("b");

    // The winner already dispatched; a second push would double the payload the
    // portal receives.
    expect(pushBlockToTenderWebsite).not.toHaveBeenCalled();
  });

  it("rethrows a non-unique-constraint database failure", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(countOf(20));
    mockPrisma.tender.findFirst.mockResolvedValue(null);
    const err: any = new Error("connection terminated unexpectedly");
    err.code = "P1001";
    mockPrisma.tender.create.mockRejectedValue(err);

    // Only P2002 means "someone else won"; anything else is a real fault and
    // must not be silently swallowed into a false "no tender generated".
    await expect(svc.checkAndGenerateTender("b")).rejects.toThrow(
      "connection terminated unexpectedly",
    );
  });
});

describe("the partial unique index migration", () => {
  // backend/src/__tests__ -> backend/
  const BACKEND_ROOT = resolve(__dirname, "../..");
  const MIGRATION =
    "prisma/migrations/20261008000000_add_tenders_block_unique_open/migration.sql";

  function migrationSql() {
    return readFileSync(resolve(BACKEND_ROOT, MIGRATION), "utf-8");
  }

  it("uses a PARTIAL index so a withdrawn tender stays re-tenderable", () => {
    const sql = migrationSql();

    // A plain UNIQUE index on block_id would make withdrawal permanent: the
    // rejected row still occupies the block, and checkAndGenerateTender only
    // looks for open/assigned tenders, so it would insert a row that the index
    // then rejects forever.
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
    expect(sql).toMatch(/WHERE\s+"status"\s+IN\s*\('open',\s*'assigned'\)/i);
    expect(sql).not.toMatch(/ON\s+"tenders"\s*\(\s*"block_id"\s*\)\s*;/);
  });

  it("excludes rejected tenders from the constraint", () => {
    const predicate = migrationSql().slice(
      migrationSql().indexOf("CREATE UNIQUE INDEX"),
    );
    expect(predicate).not.toMatch(/'rejected'/i);
  });

  it("is idempotent and does not delete tender rows", () => {
    const sql = migrationSql();
    expect(sql).toMatch(/IF NOT EXISTS/);
    // Silently deleting duplicate tenders in a migration would destroy budget
    // records; the migration only raises a notice and lets a real conflict fail.
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("getTenders", () => {
  it("returns tenders newest first", async () => {
    mockPrisma.tender.findMany.mockResolvedValue([{ id: "t2" }, { id: "t1" }]);

    await expect(svc.getTenders()).resolves.toEqual([{ id: "t2" }, { id: "t1" }]);
    expect(mockPrisma.tender.findMany).toHaveBeenCalledWith({
      orderBy: { generated_at: "desc" },
    });
  });
});