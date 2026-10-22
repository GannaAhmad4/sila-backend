import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    category: {
      type: String,
      enum: ["حروف", "أرقام", "كلمات", "جمل"],
      required: true,
    },

    mode: {
      type: String,
      enum: ["normal", "autism", "all"],
      default: "all",
    },

    stage: {
      type: Number,
      required: true,
      min: 1,
    },

    // الرابط الخارجي (اختياري)
    url: { type: String, default: "", trim: true },

    // معلومات الملف المرفوع
    filePath: { type: String, default: null },
    fileName: { type: String, default: "", trim: true },
    fileSize: { type: Number, default: 0 },
    fileType: { type: String, default: "video/mp4" },
    uploadedAt: { type: Date, default: null },

    // حقول قديمة (للتوافقية)
    letters: [{ type: String, trim: true }],
    numbers: [{ type: Number }],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);