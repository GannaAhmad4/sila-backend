import { Schema, model, Types } from "mongoose";

const dailyReportSchema = new Schema({
    childId: {
        type: Types.ObjectId,
        ref: 'Child',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        default: () => new Date().setHours(0,0,0,0), // تخزين التاريخ بدون وقت ليسهل البحث باليوم
        index: true
    },
    mood: {
        type: String,
        enum: ["سعيد", "حزين", "متوتر", "خائف", "هادئ"], // توحيد القيم مع موديل الطفل
        default: "هادئ"
    },
    totalTimeSpent: {
        type: Number, // بالدقائق
        default: 0 
    },
    // تجميع الإحصائيات اليومية لسرعة العرض في الـ Charts
    dailyMetrics: {
        focusScore: { type: Number, default: 0 },
        attendanceScore: { type: Number, default: 0 },
        pointsEarned: { type: Number, default: 0 }
    },
    completedActivities: [{
        activityType: { type: String, enum: ["video", "quiz", "game"] },
        activityId: { type: Types.ObjectId }, // ربط بالنشاط الفعلي
        title: String,
        pointsEarned: Number,
        timestamp: { type: Date, default: Date.now },
        _id: false 
    }]
}, { timestamps: true });


dailyReportSchema.index({ childId: 1, date: 1 }, { unique: true });

export const DailyReport = model("DailyReport", dailyReportSchema);