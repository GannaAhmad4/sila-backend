import { Types } from "mongoose";
import { Lesson } from "../../DB/Models/lesson.model.js";
import { QuizAttempt } from "../../DB/Models/quizAttempt.model.js";

export const normalizeId = (id) => {
  if (!id) return "";
  return typeof id === "string" ? id.toLowerCase().trim() : id.toString().toLowerCase().trim();
};

export const toIdString = (value) => value?.toString?.() || "";

export const isChildRequest = (req) => req.userType === "child" || Boolean(req.user?.parentId);

export const getChildMode = (status) => (status === "autistic" ? "autism" : "normal");

export const getAllowedLessonModes = (status) => ["all", getChildMode(status)];

export const getTrackKey = (lesson) => `${lesson.category}::${lesson.stage}::${lesson.mode}`;

export const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
};

export const normalizeLessonItemsOrder = (lesson) => {
  lesson.items.sort((a, b) => {
    const left = Number(a.itemOrder) || 0;
    const right = Number(b.itemOrder) || 0;
    return left - right;
  });

  lesson.items.forEach((item, index) => {
    item.itemOrder = index + 1;
  });
};

export const getActiveQuizItems = (lesson) =>
  (lesson.items || [])
    .filter((item) => item?.isActive !== false && item?.type === "quiz")
    .sort((a, b) => (a.itemOrder || 0) - (b.itemOrder || 0));

export const getActiveItems = (lesson) =>
  (lesson.items || [])
    .filter((item) => item?.isActive !== false)
    .sort((a, b) => (a.itemOrder || 0) - (b.itemOrder || 0));

export const makeLessonItemKey = (lessonId, itemId) => `${lessonId}_${itemId}`;

export const sanitizeQuizForChild = (quiz) => {
  if (!quiz) return null;

  // Convert to object إذا كان Mongoose document
  const quizObj = quiz.toObject?.() || quiz;

  return {
    _id: quizObj._id,
    title: quizObj.title,
    description: quizObj.description,
    category: quizObj.category,
    mode: quizObj.mode,
    stage: quizObj.stage,
    type: quizObj.type,
    skill: quizObj.skill,
    // ✅ البيانات الخاصة بكل نوع
    letters: quizObj.letters || [],
    numbers: quizObj.numbers || [],
    story: quizObj.story || null,
    strokeItems: quizObj.strokeItems || [],
    // ✅ الأهم - الأسئلة
    questions: (quizObj.questions || []).map((question) => ({
      question: question.question || "",
      options: question.options || [],
      correctAnswer: question.correctAnswer || "", // ✅ مهم جداً
      points: question.points ?? 1,
      feedback: question.feedback || { correct: "", incorrect: "" },
      imageUrl: question.imageUrl || "",
      items: question.items || [], // للـ matching و sorting
      categories: question.categories || [], // للـ sorting
      sequenceItems: question.sequenceItems || [], // للـ sequencing
    })),
    isActive: quizObj.isActive,
    createdAt: quizObj.createdAt,
    updatedAt: quizObj.updatedAt,
  };
};

export const getNextLessonOrder = async ({ category, stage, mode, excludeLessonId = null }) => {
  const filter = { category, stage, mode };
  if (excludeLessonId) {
    filter._id = { $ne: excludeLessonId };
  }

  const lastLesson = await Lesson.findOne(filter).sort({ order: -1 }).select("order").lean();
  return (lastLesson?.order || 0) + 1;
};

export const getPassedSetForLessons = async (childId, lessonIds) => {
  if (!lessonIds.length) return new Set();

  const passedAttempts = await QuizAttempt.find({
    childId,
    lessonId: { $in: lessonIds },
    passed: true,
  })
    .select("lessonId lessonItemId")
    .lean();

  return new Set(
    passedAttempts
      .filter((attempt) => attempt.lessonId && attempt.lessonItemId)
      .map((attempt) =>
        makeLessonItemKey(toIdString(attempt.lessonId), toIdString(attempt.lessonItemId))
      )
  );
};

export const isLessonCompletedUsingPassedSet = (lesson, passedSet) => {
  const quizItems = getActiveQuizItems(lesson);
  if (!quizItems.length) return true;

  const lessonId = toIdString(lesson._id);
  return quizItems.every((item) => passedSet.has(makeLessonItemKey(lessonId, toIdString(item._id))));
};

export const findPreviousActiveLesson = async (lesson) =>
  Lesson.findOne({
    isActive: true,
    category: lesson.category,
    stage: lesson.stage,
    mode: lesson.mode,
    order: { $lt: lesson.order },
  })
    .sort({ order: -1 })
    .lean();

export const isLessonCompletedForChild = async (childId, lesson) => {
  const quizItems = getActiveQuizItems(lesson);
  if (!quizItems.length) return true;

  const itemIds = quizItems.map((item) => item._id);

  const attempts = await QuizAttempt.find({
    childId,
    lessonId: lesson._id,
    lessonItemId: { $in: itemIds },
    passed: true,
  })
    .select("lessonItemId")
    .lean();

  const passedIds = new Set(attempts.map((attempt) => toIdString(attempt.lessonItemId)));
  return itemIds.every((itemId) => passedIds.has(toIdString(itemId)));
};

export const getUnlockStateForLesson = async (childId, lesson) => {
  const previousLesson = await findPreviousActiveLesson(lesson);
  if (!previousLesson) {
    return {
      isLocked: false,
      requiredPreviousLessonId: null,
      previousLessonCompleted: true,
    };
  }

  const previousLessonCompleted = await isLessonCompletedForChild(childId, previousLesson);

  return {
    isLocked: !previousLessonCompleted,
    requiredPreviousLessonId: toIdString(previousLesson._id),
    previousLessonCompleted,
  };
};

export const extractInlineContent = (body = {}, type) => {
  if (body.content && typeof body.content === "object") return body.content;
  if (type === "quiz" && body.quiz && typeof body.quiz === "object") return body.quiz;
  if (type === "video" && body.video && typeof body.video === "object") return body.video;
  return {};
};

export const ensureObjectId = (id) => Types.ObjectId.isValid(id);

export const getLessonWithContent = async (lessonId) =>
  Lesson.findById(lessonId).populate("items.quizId").populate("items.videoId");

export const mapLessonItemsForChild = (lesson) => {
  const activeItems = getActiveItems(lesson);

  return activeItems
    .map((item) => {
      const itemId = toIdString(item._id);
      
      if (item.type === "quiz") {
        if (!item.quizId) return null;
        return {
          _id: itemId,
          type: "quiz",
          itemOrder: item.itemOrder,
          isActive: item.isActive,
          quizId: toIdString(item.quizId._id || item.quizId),
          content: sanitizeQuizForChild(item.quizId),
        };
      }

      if (item.type === "video") {
        if (!item.videoId) return null;
        const video = item.videoId;
        return {
          _id: itemId,
          type: "video",
          itemOrder: item.itemOrder,
          isActive: item.isActive,
          videoId: toIdString(video._id || video),
          content: typeof video.toObject === "function" ? video.toObject() : video,
        };
      }

      return null;
    })
    .filter(Boolean);
};

export const getChildLesson = async (child, lessonId) => {
  if (!ensureObjectId(lessonId)) return null;

  const allowedModes = getAllowedLessonModes(child.status);
  return Lesson.findOne({
    _id: lessonId,
    isActive: true,
    mode: { $in: allowedModes },
  });
};

export const getLessonQuizItemOrNull = (lesson, itemId) => {
  if (!ensureObjectId(itemId)) return null;

  return getActiveQuizItems(lesson).find((item) => toIdString(item._id) === itemId) || null;
};

// ✅ ADD these functions at the end

export const calculateLessonProgressForChild = (lesson, progressData) => {
  if (!lesson.items || lesson.items.length === 0) {
    return 0;
  }

  if (!progressData) {
    return 0;
  }

  let completedItems = 0;
  let totalItems = lesson.items.length;

  lesson.items.forEach(item => {
    const itemIdStr = item._id?.toString?.() || item._id;
    const lessonIdStr = lesson._id?.toString?.() || lesson._id;

    if (item.type === "video") {
      const videoCompleted = progressData.watchedVideos?.some(vid => {
        const vidLessonId = vid.lessonId?.toString?.() || vid.lessonId;
        const vidItemId = vid.itemId?.toString?.() || vid.itemId;
        return (
          vidLessonId === lessonIdStr &&
          vidItemId === itemIdStr &&
          vid.percentage === 100 &&
          vid.isCompleted === true
        );
      });

      if (videoCompleted) {
        completedItems++;
      }
    } else if (item.type === "quiz") {
      const quizCompleted = progressData.completedLessonItems?.some(completed => {
        const completedLessonId = completed.lessonId?.toString?.() || completed.lessonId;
        const completedItemId = completed.itemId?.toString?.() || completed.itemId;
        return (
          completedLessonId === lessonIdStr &&
          completedItemId === itemIdStr &&
          completed.type === "quiz"
        );
      });

      if (quizCompleted) {
        completedItems++;
      }
    }
  });

  const progressPercent = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;

  return progressPercent;
};

export const calculateStageCompletedLessons = (stage, progressData) => {
  if (!stage.lessons || stage.lessons.length === 0) {
    return { completedCount: 0, totalCount: 0 };
  }

  const lessonsWithContent = stage.lessons.filter(
    l => l.items && l.items.length > 0
  );

  if (lessonsWithContent.length === 0) {
    return { completedCount: 0, totalCount: 0 };
  }

  const completedCount = lessonsWithContent.filter(lesson => {
    const progress = calculateLessonProgressForChild(lesson, progressData);
    return progress === 100;
  }).length;

  return {
    completedCount,
    totalCount: lessonsWithContent.length,
  };
};

// ✅ حساب تمام الكويز (passed = 100%)
export const calculateQuizCompletion = (quiz, lessonId, progressData) => {
  if (!progressData) return false;

  const quizId = normalizeId(quiz._id);
  const lessonIdStr = normalizeId(lessonId);

  // ابحث عن محاولة ناجحة للكويز دا
  return progressData.completedLessonItems?.some(completed => {
    const completedLessonId = normalizeId(completed.lessonId);
    const completedItemId = normalizeId(completed.itemId);
    return (
      completedLessonId === lessonIdStr &&
      completedItemId === quizId &&
      completed.type === "quiz"
    );
  }) || false;
};

// ✅ حساب عدد الكويزات المكتملة في مرحلة
export const calculateStageQuizzesCompleted = (stage, progressData) => {
  if (!stage.lessons || stage.lessons.length === 0) {
    return { completedCount: 0, totalCount: 0 };
  }

  let totalQuizzes = 0;
  let completedQuizzes = 0;

  stage.lessons.forEach(lesson => {
    const items = lesson.items || [];
    const quizzes = items.filter(item => item.type === "quiz");

    totalQuizzes += quizzes.length;

    quizzes.forEach(quiz => {
      if (calculateQuizCompletion(quiz, lesson._id, progressData)) {
        completedQuizzes++;
      }
    });
  });

  return {
    completedCount: completedQuizzes,
    totalCount: totalQuizzes,
  };
};

export const updateCompletedCategoriesIfNeeded = async (childId, categoryJustCompleted) => {
  const child = await Child.findById(childId).select("completedCategories");
  if (!child) return;

  const childMode = child.status === "autistic" ? "autism" : "normal";
  const CATEGORY_LEVELS = ["حروف", "أرقام", "كلمات", "جمل"];
  
  // Check: هل هذه الكاتجوري جديدة مكتملة؟
  if (child.completedCategories.includes(categoryJustCompleted)) {
    return; // بالفعل مكتملة
  }

  // تشيك الترتيب: لو عايز تضيف "أرقام"، لازم "حروف" تكون مكتملة
  const categoryIndex = CATEGORY_LEVELS.indexOf(categoryJustCompleted);
  if (categoryIndex === 0 || child.completedCategories.length === categoryIndex) {
    // ✅ الترتيب صحيح، أضفها
    child.completedCategories.push(categoryJustCompleted);
    await child.save();
    
    console.log("🏆 Category completed:", categoryJustCompleted);
    console.log("   Current level:", CATEGORY_LEVELS.indexOf(categoryJustCompleted) + 2);
  }
};

export const calculateLevelFromCategories = (completedCategories = []) => {
  const CATEGORY_LEVELS = ["حروف", "أرقام", "كلمات", "جمل"];
  return completedCategories.length + 1; // Level 1 + عدد الكاتجوريز المكتملة
};