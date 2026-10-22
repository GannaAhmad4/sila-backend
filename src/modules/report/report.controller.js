import { DailyReport } from "../../DB/Models/report.model.js";
import { Child } from "../../DB/Models/child.model.js";
import { Lesson } from "../../DB/Models/lesson.model.js";
import { Quiz } from "../../DB/Models/quiz.model.js";
import { QuizAttempt } from "../../DB/Models/quizAttempt.model.js";
import { Video } from "../../DB/Models/video.model.js";
import * as Helper from "./report.helpers.js";
const { calculateLevel } = Helper;

export const getDashboardAnalytics = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user._id;

    if (!Helper.ensureObjectId(childId)) {
      return res.status(400).json({ message: "Invalid childId format" });
    }

    // ─── جلب بيانات الطفل ───────────────────────────────────
    const child = await Child.findById(childId)
      .lean()
      .select(
        "name points bonus streakCount mentalStatus lastLoginDate status watchedVideos purchasedActivityGameIds parentId completedLessonItems"
      );

    if (!child) return res.status(404).json({ message: "Child not found" });

    if (child.parentId.toString() !== parentId.toString()) {
      return res.status(403).json({
        message: "You don't have permission to view this child's data",
      });
    }

    const childMode = child.status === "autistic" ? "autism" : "normal";

    // ─── جلب آخر 30 تقرير يومي ───────────────────────────────────
    const dailyReports = await DailyReport.find({ childId })
      .sort({ date: -1 })
      .limit(30)
      .lean()
      .select("date mood dailyMetrics completedActivities");

    const lastSevenReports = dailyReports.slice(0, 7);

    // ─── آخر محاولات الكويز (30 يوم) ───────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentQuizAttempts = await QuizAttempt.find({
      childId,
      createdAt: { $gte: thirtyDaysAgo },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .select(
        "lessonId quizId lessonItemId percentage passed earnedPoints submittedAt createdAt quizType"
      );

    // ─── جمع كل الـ IDs المحتاجينها ───────────────────────────────────
    const uniqueLessonIds = [
      ...new Set(
        recentQuizAttempts.map((a) => Helper.toIdString(a.lessonId)).filter(Boolean)
      ),
    ];

    const uniqueQuizIds = [
      ...new Set(
        recentQuizAttempts.map((a) => Helper.toIdString(a.quizId)).filter(Boolean)
      ),
    ];

    const completedVideoItems = (child.completedLessonItems || []).filter(
      (item) => item.type === "video"
    );

    const videoLessonIds = completedVideoItems
      .map((v) => Helper.toIdString(v.lessonId))
      .filter(Boolean);

    const allUniqueLessonIds = [...new Set([...uniqueLessonIds, ...videoLessonIds])];

    // ─── جلب Lessons + Quizzes + إجماليات بشكل موازي ───────────────────────────────────
    const [lessons, quizzes, totalVideosCount, totalLessons, totalQuizzes] =
      await Promise.all([
        Lesson.find({ _id: { $in: allUniqueLessonIds } })
          .lean()
          .select("title category stage items"),
        Quiz.find({ _id: { $in: uniqueQuizIds } })
          .lean()
          .select("title type"),
        // إجمالي الفيديوهات المتاحة للطفل
        Video.countDocuments({
          isActive: true,
          mode: { $in: [childMode, "all"] },
        }),
        // إجمالي الدروس المتاحة
        Lesson.countDocuments({
          isActive: true,
          mode: { $in: ["all", childMode] },
        }),
        // ✅ إجمالي الكويزات المتاحة للطفل (للـ focus score)
        Quiz.countDocuments({
          isActive: true,
          mode: { $in: [childMode, "all"] },
        }),
      ]);

    // ─── بناء الـ maps ───────────────────────────────────
    const lessonMap = {};
    lessons.forEach((l) => {
      lessonMap[Helper.toIdString(l._id)] = l;
    });

    const quizMap = {};
    quizzes.forEach((q) => {
      quizMap[Helper.toIdString(q._id)] = q;
    });

    // ─── إضافة quiz title و type لكل attempt ───────────────────────────────────
    const enrichedAttempts = recentQuizAttempts.map((attempt) => ({
      ...attempt,
      quizTitle: quizMap[Helper.toIdString(attempt.quizId)]?.title || "كويز",
      quizType: quizMap[Helper.toIdString(attempt.quizId)]?.type || "default",
    }));

    // ─── ربط completedVideoItems بالـ videoId الحقيقي ───────────────────────────────────
    // completedLessonItems.itemId = lessonItem._id (embedded في الـ Lesson)
    // نجيب منه videoId عن طريق lesson.items
    const enrichedCompletedVideos = completedVideoItems.map((vid) => {
      const lesson = lessonMap[Helper.toIdString(vid.lessonId)] || {};
      const lessonItems = lesson.items || [];

      const matchedItem = lessonItems.find(
        (item) =>
          Helper.toIdString(item._id) === Helper.toIdString(vid.itemId) &&
          item.type === "video"
      );

      return {
        ...vid,
        videoId: matchedItem?.videoId || null,
        lessonTitle: lesson.title || "",
        category: lesson.category || "",
        stage: lesson.stage || "",
      };
    });

    // ─── جلب عناوين الفيديوهات ───────────────────────────────────
    const uniqueVideoIds = [
      ...new Set(
        enrichedCompletedVideos
          .map((v) => Helper.toIdString(v.videoId))
          .filter(Boolean)
      ),
    ];

    const videos = await Video.find({ _id: { $in: uniqueVideoIds } })
      .lean()
      .select("title category stage");

    const videoMap = {};
    videos.forEach((v) => {
      videoMap[Helper.toIdString(v._id)] = v;
    });

    // ─── حساب كل الـ metrics ───────────────────────────────────

    // ✅ Streak — يشمل كويزات + فيديوهات + daily reports
    const streak = Helper.calculateStreak(
      child,
      dailyReports,
      enrichedAttempts,
      enrichedCompletedVideos
    );

    // ✅ التركيز — نسبة الكويزات الفريدة اللي اتحلت من إجمالي الكويزات المتاحة
    const focusScore = Helper.calculateFocusScore(enrichedAttempts, totalQuizzes);

    // ✅ المواظبة — streak أسبوعي (الأحد → السبت)، لو يوم وقع ترجع 0%
    const attendanceScore = Helper.calculateAttendanceScore(
      dailyReports,
      enrichedAttempts,
      enrichedCompletedVideos
    );

    // ✅ لغة الإشارة — نسبة الفيديوهات المكتملة من إجمالي الفيديوهات المتاحة
    const signLanguageScore = Helper.calculateSignLanguageScore(
      child.watchedVideos || [],
      totalVideosCount
    );

    // ✅ آخر الأنشطة مع العناوين الحقيقية
    const recentActivities = Helper.buildRecentActivities(
      enrichedAttempts,
      enrichedCompletedVideos,
      lessonMap,
      videoMap
    );

    // ─── التقدم العام ───────────────────────────────────
    const passedLessonIds = [
      ...new Set(
        recentQuizAttempts
          .filter((a) => a.passed)
          .map((a) => Helper.toIdString(a.lessonId))
      ),
    ];

    const generalProgress =
      Math.round((passedLessonIds.length / (totalLessons || 1)) * 100) || 0;

    // ─── Level ───────────────────────────────────
// ─── حساب الكاتجوريز المكتملة ───────────────────────────────────
const MAIN_CATEGORIES = ["حروف", "أرقام", "كلمات", "جمل"];

// جمع كل الدروس المتاحة لكل كاتجوري
const [lessonsByCategory] = await Promise.all([
  Lesson.find({
    isActive: true,
    category: { $in: MAIN_CATEGORIES },
    mode: { $in: ["all", childMode] },
  })
    .lean()
    .select("_id category items"),
]);

// لكل كاتجوري، شيك لو كل الكويزات اتعملت بـ passed
const completedCategories = [];

for (const category of MAIN_CATEGORIES) {
  const categoryLessons = lessonsByCategory.filter(l => l.category === category);
  if (!categoryLessons.length) continue;

  const allPassed = categoryLessons.every(lesson => {
    const quizItems = (lesson.items || []).filter(
      item => item.isActive !== false && item.type === "quiz"
    );
    if (!quizItems.length) return true; // درس من غير كويز = مكتمل تلقائي

    return quizItems.every(item => {
      const key = `${lesson._id}_${item._id}`;
      // نشيك على الـ passedSet اللي عندنا
      return recentQuizAttempts.some(
        a =>
          Helper.toIdString(a.lessonId) === Helper.toIdString(lesson._id) &&
          Helper.toIdString(a.lessonItemId) === Helper.toIdString(item._id) &&
          a.passed
      );
    });
  });

  if (allPassed) completedCategories.push(category);
}

    const currentLevel = Helper.calculateLevelFromCategories(child.completedCategories || []);

    // ─── الحالة المزاجية ───────────────────────────────────
    const currentMood =
      lastSevenReports[0]?.mood || child.mentalStatus || "هادئ";

    // ─── التقدم الأسبوعي ───────────────────────────────────
    const weeklyActivity = buildWeeklyActivity(
      enrichedAttempts,
      lastSevenReports,
      enrichedCompletedVideos
    );

    return res.status(200).json({
      status: "success",
      data: {
        header: {
          name: child.name,
          points: child.points || 0,
          bonus: child.bonus || 0,
          streak,
          level: currentLevel, // ✅ من child.completedCategories الحقيقية
          mentalStatus: currentMood,
          lastActive: Helper.getTimeAgo(child.lastLoginDate),
          completedCategories: child.completedCategories || [], // ✅ أضفها
        },
        charts: {
          mainProgress: generalProgress,
          focus: focusScore,
          attendance: attendanceScore,
          signLanguage: signLanguageScore,
          weeklyActivity,
        },
        recentActivities,
        counters: {
          openedGames: child.purchasedActivityGameIds?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in getDashboardAnalytics:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * ✅ بناء التقدم الأسبوعي — لكل يوم من آخر 7 أيام
 * - score: متوسط نسب درجات الكويزات في اليوم ده (average of quiz attempt percentages)
 *   مثال: عملت كويزين، جابت 100% و75% → score = 87%
 * - quizzes: عدد محاولات الكويز
 * - videos: عدد الفيديوهات المكتملة
 * - games: عدد الأنشطة من الـ daily report
 */
function buildWeeklyActivity(quizAttempts, dailyReports, completedVideos = []) {
  const days = [];
  const dayNames = [
    "الأحد",
    "الاثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dateStr = date.toDateString();

    // محاولات الكويز في اليوم ده
    const dayAttempts = quizAttempts.filter((a) => {
      const aDate = new Date(a.submittedAt || a.createdAt);
      aDate.setHours(0, 0, 0, 0);
      return aDate.toDateString() === dateStr;
    });

    // ✅ الفيديوهات المكتملة في اليوم ده
    const dayVideos = completedVideos.filter((v) => {
      if (!v.completedAt) return false;
      const vDate = new Date(v.completedAt);
      vDate.setHours(0, 0, 0, 0);
      return vDate.toDateString() === dateStr;
    });

    // ✅ score = متوسط درجات الـ quiz attempts في اليوم ده
    // مثال: كويزين → 100% و75% → average = 87%
    const dayScore =
      dayAttempts.length > 0
        ? Math.round(
            dayAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) /
              dayAttempts.length
          )
        : 0;

    // عدد الأنشطة من التقرير اليومي
    const dayReport = dailyReports.find((r) => {
      const rDate = new Date(r.date);
      rDate.setHours(0, 0, 0, 0);
      return rDate.toDateString() === dateStr;
    });

    days.push({
      day: dayNames[date.getDay()],
      date: date.toISOString(),
      score: dayScore,
      games: dayReport?.completedActivities?.length || 0,
      quizzes: dayAttempts.length,
      videos: dayVideos.length,
    });
  }

  return days;
}

export const updateMentalStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const childId = req.user._id;

    const validMoods = ["سعيد", "حزين", "متوتر", "خائف", "هادئ"];
    if (!validMoods.includes(status)) {
      return res.status(400).json({ message: "Mood غير صحيح" });
    }

    await Child.findByIdAndUpdate(childId, { mentalStatus: status });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await DailyReport.findOneAndUpdate(
      { childId, date: today },
      { mood: status },
      { upsert: true, new: true }
    );

    res
      .status(200)
      .json({ status: "success", message: "Mental status updated" });
  } catch (error) {
    console.error("❌ Error in updateMentalStatus:", error);
    res.status(500).json({ message: error.message });
  }
};