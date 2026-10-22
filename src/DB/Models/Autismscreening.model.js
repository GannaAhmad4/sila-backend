import mongoose from "mongoose";

// ─── Sub-schema: الـ behaviors اللي Qwen بيرجعها ────────────────────────────
const ObservedBehaviorsSchema = new mongoose.Schema(
  {
    eye_contact:                  { type: String, default: "" },
    social_interaction:           { type: String, default: "" },
    response_to_name_or_speech:   { type: String, default: "" },
    repetitive_behaviors:         { type: String, default: "" },
    facial_expressions:           { type: String, default: "" },
    body_language_and_gestures:   { type: String, default: "" },
    play_behavior:                { type: String, default: "" },
    language_and_communication:   { type: String, default: "" },
    sensory_reactions:            { type: String, default: "" },
    overall_autism_indicators:    { type: String, default: "" },
  },
  { _id: false }
);

// ─── Sub-schema: نتيجة DSM-5 ─────────────────────────────────────────────────
const DSM5CriteriaSchema = new mongoose.Schema(
  {
    A1_social_emotional_reciprocity: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    A2_nonverbal_communication: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    A3_relationships: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    B1_stereotyped_repetitive_motor: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    B2_insistence_on_sameness: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    B3_restricted_interests: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
    B4_sensory_reactivity: {
      type: String,
      enum: ["Met", "Partially Met", "Not Observed"],
      default: "Not Observed",
    },
  },
  { _id: false }
);

// ─── Sub-schema: نتيجة الـ Screening كاملة ───────────────────────────────────
const ScreeningResultSchema = new mongoose.Schema(
  {
    criteria_match:           { type: DSM5CriteriaSchema, default: () => ({}) },
    matched_symptoms:         { type: [String], default: [] },
    unmatched_or_unclear:     { type: [String], default: [] },
    dsm5_criteria_met_count:  { type: Number, default: 0 },
    overall_assessment:       { type: String, default: "" },
    severity: {
      type: String,
      enum: ["Mild", "Moderate", "Severe", "Inconclusive"],
      default: "Inconclusive",
    },
    confidence: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    recommendation: { type: String, default: "" },
    disclaimer: {
      type: String,
      default: "This is NOT a medical diagnosis. For informational purposes only.",
    },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const AutismScreeningSchema = new mongoose.Schema(
  {
    childId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: [true, "childId is required"],
      index: true,
    },

    // معلومات الفيديو
    videoOriginalName:  { type: String, default: "" },
    framesProcessed:    { type: Number, default: 0 },

    // نص الكلام المستخرج من الفيديو
    transcription: { type: String, default: "" },

    // تحليل السلوك من Qwen
    observedBehaviors: { type: ObservedBehaviorsSchema, default: () => ({}) },

    // نتيجة DSM-5
    screeningResult: { type: ScreeningResultSchema, default: () => ({}) },

    // حالة التحليل
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    // لو فشل التحليل نحتفظ بسبب الفشل
    errorMessage: { type: String, default: null },

    // اللي أنشأ التحليل (اختياري — لو عندك auth)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt تلقائياً
    versionKey: false,
  }
);

export const AutismScreening = mongoose.model("AutismScreening", AutismScreeningSchema);
export default AutismScreening;