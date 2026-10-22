import { Schema, Types, model } from "mongoose";

const lessonItemSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["quiz", "video"],
      required: true,
    },
    quizId: {
      type: Types.ObjectId,
      ref: "Quiz",
      default: null,
      required: function requiredQuizId() {
        return this.type === "quiz";
      },
    },
    videoId: {
      type: Types.ObjectId,
      ref: "Video",
      default: null,
      required: function requiredVideoId() {
        return this.type === "video";
      },
    },
    itemOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const lessonSchema = new Schema(
  {
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
    category: {
      type: String,
      required: true,
      trim: true,
    },
    stage: {
      type: Number,
      required: true,
      min: 1,
    },
    mode: {
      type: String,
      enum: ["normal", "autism", "all"],
      default: "all",
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    items: {
      type: [lessonItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

lessonSchema.index({ category: 1, stage: 1, mode: 1, order: 1 });
lessonSchema.index({ isActive: 1, category: 1, stage: 1, mode: 1, order: 1 });

export const Lesson = model("Lesson", lessonSchema);
