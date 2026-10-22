import { Types } from "mongoose";

export const toIdString = (value) => value?.toString?.() || "";
export const ensureObjectId = (id) => Types.ObjectId.isValid(id);

/**
 * حساب المستوى بناءً على البونص
 * كل 50 بونص = مستوى جديد
 */
export const calculateLevel = (completedCategories = []) => {
  const CATEGORY_LEVELS = ["حروف", "أرقام", "كلمات", "جمل"];

  let level = 1;
  for (const category of CATEGORY_LEVELS) {
    if (completedCategories.includes(category)) {
      level++;
    } else {
      break; // لازم يكمل بالترتيب
    }
  }
  return level;
};

/**
 * ✅ حساب الـ Streak الحقيقي
 * - أي نشاط (كويز أو فيديو أو daily report) = يوم نشيط
 * - لو يوم عدا من غير نشاط = يرجع 0
 */
export const calculateStreak = (child, dailyReports = [], quizAttempts = [], completedVideos = []) => {
  const activeDays = new Set();

  dailyReports.forEach((report) => {
    const d = new Date(report.date);
    d.setHours(0, 0, 0, 0);
    activeDays.add(d.toDateString());
  });

  quizAttempts.forEach((attempt) => {
    const d = new Date(attempt.submittedAt || attempt.createdAt);
    d.setHours(0, 0, 0, 0);
    activeDays.add(d.toDateString());
  });

  completedVideos.forEach((vid) => {
    if (vid.completedAt) {
      const d = new Date(vid.completedAt);
      d.setHours(0, 0, 0, 0);
      activeDays.add(d.toDateString());
    }
  });

  if (child.lastLoginDate) {
    const d = new Date(child.lastLoginDate);
    d.setHours(0, 0, 0, 0);
    activeDays.add(d.toDateString());
  }

  if (activeDays.size === 0) return 0;

  const sortedDays = Array.from(activeDays)
    .map((d) => new Date(d))
    .sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastDay = sortedDays[0];
  if (lastDay < yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = sortedDays[i - 1] - sortedDays[i];
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (Math.round(diff / oneDayMs) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

/**
 * ✅ حساب التركيز
 * = نسبة الكويزات الفريدة اللي الطفلة حلتها من إجمالي الكويزات المتاحة
 * مثال: نازل 4 كويزات، حلت 1 → 25%
 * totalQuizzes بييجي من الـ controller (Quiz.countDocuments)
 */
export const calculateFocusScore = (quizAttempts = [], totalQuizzes = 0) => {
  if (!totalQuizzes) return 0;

  // الكويزات الفريدة اللي الطفلة حلتها (مش نكرر نفس الكويز لو عملته أكتر من مرة)
  const solvedQuizIds = new Set(
    quizAttempts
      .map((a) => toIdString(a.quizId))
      .filter(Boolean)
  );

  return Math.round((solvedQuizIds.size / totalQuizzes) * 100);
};

/**
 * ✅ حساب المواظبة الأسبوعية — streak أسبوعي
 * الأسبوع = 7 أيام ثابتة (الأحد → السبت)
 * - كل يوم نشيط = 100/7 ≈ 14.3%
 * - لو يوم وقع في النص (من أول يوم نشيط لحد أمس) → ترجع 0% (زي الـ streak)
 *
 * مثال: الأحد ✅ الاثنين ✅ الثلاثاء ❌ الأربعاء ✅ → 0% (انكسر)
 * مثال: الأحد ✅ الاثنين ✅ الثلاثاء ✅ → 43% (3/7)
 */
export const calculateAttendanceScore = (dailyReports = [], quizAttempts = [], completedVideos = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay(); // 0 = الأحد
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);

  const activeDays = new Set();

  dailyReports.forEach((r) => {
    const d = new Date(r.date);
    d.setHours(0, 0, 0, 0);
    if (d >= startOfWeek) activeDays.add(d.toDateString());
  });

  quizAttempts.forEach((a) => {
    const d = new Date(a.submittedAt || a.createdAt);
    d.setHours(0, 0, 0, 0);
    if (d >= startOfWeek) activeDays.add(d.toDateString());
  });

  completedVideos.forEach((v) => {
    if (v.completedAt) {
      const d = new Date(v.completedAt);
      d.setHours(0, 0, 0, 0);
      if (d >= startOfWeek) activeDays.add(d.toDateString());
    }
  });

  if (activeDays.size === 0) return 0;

  // ✅ التحقق من الـ streak الأسبوعي
  // لو في فجوة بين أول يوم نشيط ولحد أمس → ترجع 0%
  const sortedActiveDays = Array.from(activeDays)
    .map((d) => new Date(d))
    .sort((a, b) => a - b); // تصاعدي

  const firstActiveDay = sortedActiveDays[0];
  const oneDayMs = 24 * 60 * 60 * 1000;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // نمشي من أول يوم نشيط لحد أمس ونتأكد مفيش يوم فات
  let checkDate = new Date(firstActiveDay);
  while (checkDate <= yesterday) {
    if (!activeDays.has(checkDate.toDateString())) {
      return 0; // فجوة → streak انكسر
    }
    checkDate = new Date(checkDate.getTime() + oneDayMs);
  }

  // مفيش فجوة → نسبة الأيام النشيطة من 7
  return Math.round((activeDays.size / 7) * 100);
};

/**
 * ✅ حساب مستوى لغة الإشارة
 * = نسبة الفيديوهات المكتملة من إجمالي الفيديوهات المتاحة
 * مثال: نازل فيديوهين، اتفرجت على 1 → 50%
 */
export const calculateSignLanguageScore = (watchedVideos = [], totalVideos = 0) => {
  if (!totalVideos) return 0;
  const completedCount = watchedVideos.filter((v) => v.isCompleted).length;
  return Math.round((completedCount / totalVideos) * 100);
};

/**
 * ✅ بناء آخر الأنشطة من QuizAttempts + completedLessonItems (فيديوهات)
 * بيرجع آخر 10 أنشطة مرتبة من الأحدث للأقدم
 */
export const buildRecentActivities = (quizAttempts = [], completedVideos = [], lessonMap = {}, videoMap = {}) => {
  const activities = [];

  quizAttempts.forEach((attempt) => {
    const lesson = lessonMap[toIdString(attempt.lessonId)] || {};
    activities.push({
      activityType: "quiz",
      title: attempt.quizTitle || "كويز",
      quizType: attempt.quizType || "default",
      lessonTitle: lesson.title || "",
      category: lesson.category || "", // ✅ من lesson بتاعة الـ attempt
      stage: lesson.stage || "", // ✅ من lesson
      passed: attempt.passed,
      percentage: attempt.percentage || 0,
      pointsEarned: attempt.earnedPoints || 0,
      timestamp: attempt.submittedAt || attempt.createdAt,
      timeAgo: getTimeAgo(attempt.submittedAt || attempt.createdAt),
    });
  });

  completedVideos.forEach((vid) => {
    const lesson = lessonMap[toIdString(vid.lessonId)] || {};
    const videoTitle = videoMap[toIdString(vid.videoId)]?.title || "فيديو تعليمي";
    activities.push({
      activityType: "video",
      title: videoTitle,
      lessonTitle: lesson.title || "",
      category: lesson.category || "", // ✅ من lesson
      stage: lesson.stage || "", // ✅ من lesson
      pointsEarned: 0,
      timestamp: vid.completedAt,
      timeAgo: getTimeAgo(vid.completedAt),
    });
  });

  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
};

/**
 * تحويل التاريخ لوقت نسبي (منذ ...)
 */
export const getTimeAgo = (date) => {
  if (!date) return "غير محدد";
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return "الآن";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days < 7) return `منذ ${days} أيام`;

  return new Date(date).toLocaleDateString("ar-EG");
};

/**
 * تنسيق الساعة بشكل واضح (الساعة 3:45 م)
 */
export const formatTime = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * اسم نوع الكويز بالعربي
 */
export const getQuizTypeName = (type) => {
  const types = {
    default: "اختيار من متعدد",
    emotions: "مشاعر",
    sequencing: "تسلسل",
    storytelling: "قصص",
    matching: "توصيل",
    receptive: "استقبالية",
    sorting: "تصنيف",
    strokes: "كتابة",
  };
  return types[type] || type || "كويز";
};

export const calculateLevelFromCategories = (completedCategories = []) => {
  const CATEGORY_LEVELS = ["حروف", "أرقام", "كلمات", "جمل"];
  
  // ✅ تحقق من الترتيب: لو فيه gap → احسب بناءً على اللي موجود
  let level = 1; // Default: Level 1
  
  for (const category of CATEGORY_LEVELS) {
    if (completedCategories.includes(category)) {
      level++;
    } else {
      break; // لو اتقطع الترتيب، مش كل الـ level
    }
  }
  
  return level;
};