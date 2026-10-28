import dotenv from "dotenv";
dotenv.config();

import logger from "./config/logger";

const REQUIRED_ENV_VARS = ["JWT_SECRET", "JWT_REFRESH_SECRET", "JWT_RESET_SECRET", "DATABASE_URL"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    logger.fatal(`Environment variable ${key} is not set.`);
    process.exit(1);
  }
}

process.on("uncaughtException", (err) => {
  logger.fatal(err, "Uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.fatal(reason, "Unhandled promise rejection");
  process.exit(1);
});

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import fs from "fs";
import prisma from "./config/database";
import { UPLOADS_DIR } from "./config/paths";
import { authenticate } from "./middleware/auth";
import uploadRoutes from "./routes/uploads";
import localUploadRoutes from "./routes/localUploads";
import authRoutes from "./routes/auth";
import reportRoutes from "./routes/reports";
import webhookRoutes from "./routes/webhooks";
import adminRoutes from "./routes/admin";
import publicRoutes from "./routes/publicReports";
import mapRoutes from "./routes/map";
import { startTenderScheduler, stopTenderScheduler } from "./services/tenderScheduler";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProduction = (process.env.NODE_ENV || "development") === "production";

function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

const configuredOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  ...(process.env.CORS_ORIGINS || "").split(","),
]
  .map(normalizeOrigin)
  .filter((origin): origin is string => Boolean(origin));

const devOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];
const allowedOrigins = new Set(isProduction ? configuredOrigins : [...configuredOrigins, ...devOrigins]);

function originAllowed(origin?: string): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (normalized && allowedOrigins.has(normalized)) return true;
  if (!isProduction) {
    try {
      const { protocol, hostname } = new URL(origin);
      return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
    } catch {
      return false;
    }
  }
  return false;
}

const TRUST_PROXY = (() => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return false;
  if (raw === "true") return 1;
  if (raw === "false") return false;
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) return asNumber;
  return raw;
})();
app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "https://*.tile.openstreetmap.org",
        "https://*.basemaps.cartocdn.com",
        "https://*.s3.amazonaws.com",
        "https://*.s3.*.amazonaws.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", ...allowedOrigins],
    },
  },
}));

app.use(cors({
  origin: (origin, callback) => {
    if (originAllowed(origin)) return callback(null, true);
    logger.warn({ origin }, "Blocked by CORS");
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Client-Platform"],
}));

// Reject cross-origin state-changing requests even if a cookie was sent.
// CORS is a browser read guard, not a CSRF defence.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.header("origin");
  if (origin && !originAllowed(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
});

// cookieParser must come before any route that reads cookies (including the
// authenticated /uploads static handler).
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, url: req.url }, "incoming request");
  next();
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/uploads", localUploadRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/map", mapRoutes);

// Evidence is private. The web app reaches it through its same-origin proxy,
// so the httpOnly session cookie is forwarded. The previous handoff served
// /uploads publicly with Access-Control-Allow-Origin: *.
const staticOptions = { dotfiles: "deny" as const, fallthrough: true, maxAge: "1h" };
app.use("/api/v1/files", authenticate, express.static(UPLOADS_DIR, staticOptions));
app.use("/uploads", authenticate, express.static(UPLOADS_DIR, staticOptions));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", message: "Database connection failed" });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});


async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  stopTenderScheduler();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled error in request");
  if (res.headersSent) return;
  const isJsonError = err instanceof SyntaxError;
  res.status(isJsonError ? 400 : 500).json({ error: isJsonError ? "Invalid JSON body" : "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Backend running on http://localhost:${PORT}`);
  startTenderScheduler();
});

export default app;
