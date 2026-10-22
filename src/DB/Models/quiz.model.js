import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    // مشترك في كل الأنواع
    question: { type: String, default: "", trim: true },
    options: [{ type: String, trim: true }],
    correctAnswer: { type: String, default: "", trim: true },
    points: { type: Number, default: 1, min: 0 },
    feedback: {
      correct: { type: String, trim: true },
      incorrect: { type: String, trim: true },
    },

    // صورة السؤال (للاستقبالية والمشاعر والـ default)
    imageUrl: { type: String, trim: true, default: "" },

    // للتوصيل (matching) والتصنيف (sorting)
    // كل item فيه text واختياري imageUrl وللتصنيف category
    items: [
      {
        text: { type: String, trim: true, default: "" },
        imageUrl: { type: String, trim: true, default: "" },
        category: { type: String, trim: true, default: "" }, // للتصنيف بس
        _id: false,
      }
    ],

    // للتصنيف (sorting) — الفئات المتاحة
    categories: [{ type: String, trim: true }],

    // للتسلسل (sequencing) — جمل/أحداث يرتبها الطفل
    sequenceItems: [
      {
        text: { type: String, trim: true, default: "" },
        imageUrl: { type: String, trim: true, default: "" },
        correctOrder: { type: Number, default: 0 },
        _id: false,
      }
    ],
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    category: {
      type: String,
      enum: ["حروف", "أرقام", "كلمات", "جمل", "ABA", "قصص"],
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

    type: {
      type: String,
      enum: [
        "default",      // اختيارات عادية
        "emotions",     // مشاعر — صورة + خيارات
        "sequencing",   // تسلسل — رتّب الأحداث
        "storytelling", // قصص — نص قصة + أسئلة
        "matching",     // توصيل — اسم + صورة
        "receptive",    // استقبالية — صورة + خيارات نصية
        "sorting",      // تصنيف — صور + فئات
        "strokes",      // كتابة الحروف والأرقام
      ],
      default: "default",
    },

    // للـ strokes — قائمة الحروف/الأرقام مع مساراتها
    strokeItems: [
      {
        character: { type: String, trim: true, required: true },
        strokes: [
          {
            id: { type: Number },
            path: { type: String, trim: true, default: "" },
            label: { type: String, trim: true, default: "" },
            _id: false,
          }
        ],
        _id: false,
      }
    ],

    skill: { type: String, trim: true },

    letters: [{ type: String, trim: true }],
    numbers: [{ type: Number }],

    story: {
      title: { type: String, trim: true },
      paragraphs: [{ type: String, trim: true }],
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model("Quiz", quizSchema);