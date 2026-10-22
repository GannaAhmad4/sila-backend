import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { AutismScreening } from "../../DB/Models/Autismscreening.model.js";
import { Child } from "../../DB/Models/child.model.js";

// عنوان الـ FastAPI
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// ─── Helper: التحقق إن الطفل موجود ──────────────────────────────────────────
const assertChildExists = async (childId) => {
  const child = await Child.findById(childId);
  if (!child) {
    const err = new Error("Child not found");
    err.statusCode = 404;
    throw err;
  }
  return child;
};

// ─── 1. رفع الفيديو وبدء التحليل ────────────────────────────────────────────
/**
 * POST /api/autism-screenings/:childId/analyze
 * body: multipart/form-data  →  field: "video"
 */
const analyzeVideo = async (req, res) => {
  try {
    const { childId } = req.params;

    // تأكد إن الطفل موجود
    await assertChildExists(childId);

    // تأكد إن في فيديو اتبعت
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No video file uploaded" });
    }

    // أنشئ record بـ status = processing
    const screening = await AutismScreening.create({
      childId,
      videoOriginalName: req.file.originalname,
      status: "processing",
    });

    // ── أرسل الفيديو للـ FastAPI بشكل async (مش بننتظر) ──────────────────
    // بنرجع الـ id للـ frontend فوراً عشان يقدر يعمل polling
    sendToFastAPI(screening._id, req.file).catch(console.error);

    return res.status(202).json({
      success: true,
      message: "Video uploaded. Analysis started. Use the screeningId to check status.",
      data: {
        screeningId: screening._id,
        childId,
        status: "processing",
      },
    });
  } catch (err) {
    console.error("analyzeVideo error:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};

// ─── Helper: إرسال الفيديو للـ FastAPI وتحديث الـ DB ────────────────────────
const sendToFastAPI = async (screeningId, file) => {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await axios.post(`${FASTAPI_URL}/analyze-video`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 10 * 60 * 1000, // 10 دقايق timeout (الموديل بياخد وقت)
    });

    const result = response.data?.analysis;

    // حدّث الـ record بالنتيجة
    await AutismScreening.findByIdAndUpdate(screeningId, {
      status:            "completed",
      transcription:     result?.transcription     || "",
      framesProcessed:   result?.frames_processed  || 0,
      observedBehaviors: result?.observed_behaviors || {},
      screeningResult:   result?.screening_result  || {},
    });
  } catch (err) {
    console.error("FastAPI call failed:", err.message);
    await AutismScreening.findByIdAndUpdate(screeningId, {
      status:       "failed",
      errorMessage: err.message,
    });
  } finally {
    // امسح الفيديو من السيرفر بعد الإرسال
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

// ─── 2. الـ Polling: اتحقق من حالة التحليل ──────────────────────────────────
/**
 * GET /api/autism-screenings/:screeningId/status
 */
const getScreeningStatus = async (req, res) => {
  try {
    const screening = await AutismScreening.findById(req.params.screeningId).select(
      "status errorMessage childId createdAt"
    );

    if (!screening) {
      return res.status(404).json({ success: false, message: "Screening not found" });
    }

    return res.status(200).json({ success: true, data: screening });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 3. جيب نتيجة تحليل واحد كاملة ─────────────────────────────────────────
/**
 * GET /api/autism-screenings/:screeningId
 */
const getScreeningById = async (req, res) => {
  try {
    const screening = await AutismScreening.findById(req.params.screeningId)
      .populate("childId", "name dateOfBirth gender") // بيانات الطفل الأساسية
      .populate("createdBy", "name email");            // لو عندك auth

    if (!screening) {
      return res.status(404).json({ success: false, message: "Screening not found" });
    }

    return res.status(200).json({ success: true, data: screening });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── 4. جيب كل التحليلات بتاعت طفل معين ────────────────────────────────────
/**
 * GET /api/autism-screenings/child/:childId
 */
const getScreeningsByChild = async (req, res) => {
  try {
    const { childId } = req.params;
    await assertChildExists(childId);

    const screenings = await AutismScreening.find({ childId })
      .select("status severity confidence dsm5_criteria_met_count createdAt videoOriginalName")
      .sort({ createdAt: -1 }); // الأحدث أول

    return res.status(200).json({
      success: true,
      count: screenings.length,
      data: screenings,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── 5. احذف تحليل ───────────────────────────────────────────────────────────
/**
 * DELETE /api/autism-screenings/:screeningId
 */
const deleteScreening = async (req, res) => {
  try {
    const screening = await AutismScreening.findByIdAndDelete(req.params.screeningId);
    if (!screening) {
      return res.status(404).json({ success: false, message: "Screening not found" });
    }
    return res.status(200).json({ success: true, message: "Screening deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export {
  analyzeVideo,
  getScreeningStatus,
  getScreeningById,
  getScreeningsByChild,
  deleteScreening,
};