import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/uploads";
import localUploadRoutes from "./routes/localUploads";
import reportRoutes from "./routes/reports";
import webhookRoutes from "./routes/webhooks";
import adminRoutes from "./routes/admin";

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Security middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
}));

import path from "path";
import fs from "fs";

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/api/v1/files", express.static(uploadsDir));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/uploads", uploadRoutes);
app.use("/api/v1/uploads", localUploadRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/webhooks", webhookRoutes);
app.use("/api/v1/admin", adminRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
