import { Schema, model } from "mongoose";

const activityGameSchema = new Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    iframeSrc: {
      type: String,
      required: true,
      trim: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    mode: {
      type: String,
      enum: ["all", "normal", "autism"],
      default: "all",
    },
    // ✅ تغيير: الرينج الجديد
    ageRange: {
      type: String,
      enum: ["5-7", "8+"],  // ✅ جديد
      required: true,
    },
    emoji: {
      type: String,
      default: "🎮",
    },
    color: {
      type: String,
      default: "#B5EAD7",
    },
  },
  { timestamps: true }
);

activityGameSchema.index({ available: 1, gameId: 1, mode: 1, ageRange: 1 });
activityGameSchema.index({ mode: 1, ageRange: 1, available: 1 });

export const ActivityGame = model("ActivityGame", activityGameSchema);