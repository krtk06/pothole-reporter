import { describe, expect, it } from "vitest";
import { classifyDatabaseUrl } from "../config/databaseTarget";

const RDS = "postgresql://postgres:secret@pot.civosqmca8h7.us-east-1.rds.amazonaws.com:5432/pothole_dev";

describe("AWS-only database target", () => {
  it("accepts an RDS endpoint", () => {
    expect(classifyDatabaseUrl(RDS, {})).toMatchObject({
      ok: true,
      kind: "aws-rds",
      host: "pot.civosqmca8h7.us-east-1.rds.amazonaws.com",
    });
  });

  it("rejects a non-RDS host", () => {
    expect(classifyDatabaseUrl("postgresql://u:p@db.example.com:5432/db", {})).toMatchObject({
      ok: false,
      kind: "other",
    });
  });

  it("does not accept an RDS-looking string in a query parameter", () => {
    const sneaky = "postgresql://u:p@evil.example.com:5432/db?host=pot.rds.amazonaws.com";
    expect(classifyDatabaseUrl(sneaky, {}).ok).toBe(false);
  });

  it("only allows localhost when explicitly enabled", () => {
    expect(classifyDatabaseUrl("postgresql://u:p@localhost:5432/db", {}).ok).toBe(false);
    expect(classifyDatabaseUrl("postgresql://u:p@localhost:5432/db", { DATABASE_ALLOW_LOCAL: "1" })).toMatchObject({
      ok: true,
      kind: "local",
    });
  });

  it("reports missing and malformed URLs", () => {
    expect(classifyDatabaseUrl(undefined, {}).kind).toBe("missing");
    expect(classifyDatabaseUrl("not-a-url", {}).kind).toBe("malformed");
  });
});
