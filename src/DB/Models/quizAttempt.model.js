import { Schema, Types, model } from "mongoose";

const attemptAnswerSchema = new Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    question: {
      type: String,
      trim: true,
    },
    selectedAnswer: {
      type: String,
      default: "",
      trim: true,
    },
    correctAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    pointsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxPoints: {
      type: Number,
      default: 1,
      min: 0,
    },
    feedback: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const quizAttemptSchema = new Schema(
  {
    childId: {
      type: Types.ObjectId,
      ref: "Child",
      required: true,
      index: true,
    },
    quizId: {
      type: Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    lessonId: {
      type: Types.ObjectId,
      ref: "Lesson",
      default: null,
      index: true,
    },
    lessonItemId: {
      type: Types.ObjectId,
      default: null,
      index: true,
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    answers: {
      type: [attemptAnswerSchema],
      default: [],
    },

    totalQuestions: {
      type: Number,
      required: true,
      min: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },
    wrongAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },

    earnedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPossiblePoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    passThreshold: {
      type: Number,
      default: 60,
      min: 0,
      max: 100,
    },
    passed: {
      type: Boolean,
      default: false,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

quizAttemptSchema.index(
  { childId: 1, lessonId: 1, lessonItemId: 1, quizId: 1, attemptNumber: 1 },
  { unique: true }
);
quizAttemptSchema.index({ childId: 1, quizId: 1, createdAt: -1 });
quizAttemptSchema.index({ childId: 1, lessonId: 1, lessonItemId: 1, createdAt: -1 });

export const QuizAttempt = model("QuizAttempt", quizAttemptSchema);
