/**
 * Vitest setup — runs before each test file.
 *
 * Silences pino (the app logs a WARN line on every deliberate fail-closed scope
 * test, which otherwise buries the reporter output) and pins the secrets so a
 * test never depends on a developer's local .env being present.
 */
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || "silent";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
process.env.JWT_RESET_SECRET = "test-reset-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.FRONTEND_URL = "http://localhost:3000";

// Never let a developer's real DATABASE_URL or AWS keys reach a test.
delete process.env.DATABASE_URL;
delete process.env.AWS_ACCESS_KEY_ID;
delete process.env.AWS_SECRET_ACCESS_KEY;