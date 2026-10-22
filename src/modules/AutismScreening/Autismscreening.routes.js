import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  analyzeVideo,
  getScreeningStatus,
  getScreeningById,
  getScreeningsByChild,
  deleteScreening,
} from "./Autismscreening.controller.js";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Multer Config: حفظ الفيديو مؤقتاً قبل إرساله للـ FastAPI ───────────────
const UPLOAD_DIR = path.join(__dirname, "../uploads/videos");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only video files are allowed (mp4, mov, avi, webm)"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// رفع فيديو وبدء التحليل لطفل معين
// POST /api/autism-screenings/:childId/analyze
router.post("/:childId/analyze", upload.single("video"), analyzeVideo);

// تتبع حالة التحليل (للـ polling من الـ frontend)
// GET /api/autism-screenings/:screeningId/status
router.get("/:screeningId/status", getScreeningStatus);

// جيب نتيجة تحليل كاملة
// GET /api/autism-screenings/:screeningId
router.get("/:screeningId", getScreeningById);

// جيب كل التحليلات بتاعت طفل معين
// GET /api/autism-screenings/child/:childId
router.get("/child/:childId", getScreeningsByChild);

// احذف تحليل
// DELETE /api/autism-screenings/:screeningId
router.delete("/:screeningId", deleteScreening);

export default router;