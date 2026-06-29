import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { authenticate } from "../middleware/auth";
import { uploadLimiter } from "../middleware/rateLimiter";
import logger from "../config/logger";

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/local",
  authenticate,
  uploadLimiter,
  (req: Request, res: Response) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        logger.error({ err }, "Local upload error");
        res.status(400).json({ error: err.message || "Upload failed" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      const key = `uploads/${req.file.filename}`;
      res.json({ uploadUrl: "", key });
    });
  }
);

export default router;
