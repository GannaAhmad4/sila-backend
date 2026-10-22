import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../../uploads/videos");

console.log("📁 Upload Directory:", uploadDir);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("✅ تم إنشاء مجلد uploads/videos");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `video-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log("📝 Filename:", filename);
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = ["video/mp4", "video/webm", "video/ogg"];
  const allowedExtensions = [".mp4", ".webm", ".ogg"];

  const ext = path.extname(file.originalname).toLowerCase();
  console.log("🎬 File received:", file.originalname, "- Type:", file.mimetype);

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `صيغة الملف غير مدعومة. الصيغ المدعومة: MP4, WebM, Ogg`
      ),
      false
    );
  }
};

export const uploadVideo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({
        message: "حجم الملف أكبر من 100MB",
        error: "FILE_TOO_LARGE",
      });
    }
    return res.status(400).json({
      message: "خطأ في رفع الملف",
      error: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      message: err.message,
      error: "UPLOAD_ERROR",
    });
  }
  next();
};
