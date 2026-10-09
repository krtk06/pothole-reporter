import fs from "fs";
import os from "os";
import path from "path";
import { afterAll } from "vitest";

/**
 * Vitest setup — runs before each test file.
 *
 * tenderStore resolves DATA_DIR from process.cwd() at module load and enables S3
 * whenever TENDER_STORE_BUCKET is set (tenderStore.ts:64-73). Tests must never
 * touch the real tender-website/data directory or a live bucket, so both are
 * forced off here and the cwd is moved into a throwaway sandbox.
 */
delete process.env.TENDER_STORE_BUCKET;
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;
delete process.env.AWS_REGION;
delete process.env.BACKEND_URL;
delete process.env.NEXT_PUBLIC_BACKEND_URL;

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "tender-store-test-"));
const originalCwd = process.cwd();
process.chdir(SANDBOX);

export const sandboxDir = SANDBOX;

// One sandbox is created per test file, so clean it up rather than letting
// /tmp accumulate a directory per run.
afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(SANDBOX, { recursive: true, force: true });
});