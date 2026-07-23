import dotenv from "dotenv";
dotenv.config();

import logger from "./config/logger";

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_RESET_SECRET",
  "DATABASE_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET_NAME",
  "ML_WEBHOOK_SECRET",
] as const;
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
import path from "path";
import fs from "fs";
import prisma from "./config/database";
import { authenticate } from "./middleware/auth";
import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/uploads";
import localUploadRoutes from "./routes/localUploads";
import reportRoutes from "./routes/reports";
import webhookRoutes from "./routes/webhooks";
import adminRoutes from "./routes/admin";
import publicRoutes from "./routes/publicReports";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://*.tile.openstreetmap.org", "https://raw.githubusercontent.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", FRONTEND_URL],
    },
  },
}));

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Client-Platform"],
}));

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/api/v1/files", authenticate, express.static(uploadsDir));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

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

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", message: "Database connection failed" });
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err, "Unhandled error in request");
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Backend running on http://localhost:${PORT}`);
});

export default app;
