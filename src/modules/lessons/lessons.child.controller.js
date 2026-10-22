import { Quiz } from "../../DB/Models/quiz.model.js";
import { QuizAttempt } from "../../DB/Models/quizAttempt.model.js";
import { Child } from "../../DB/Models/child.model.js";
import { Lesson } from "../../DB/Models/lesson.model.js";
import { PASS_THRESHOLD } from "./lessons.constants.js";
import {
  ensureObjectId,
  getActiveItems,
  getChildLesson,
  getLessonQuizItemOrNull,
  getLessonWithContent,
  getPassedSetForLessons,
  getTrackKey,
  getUnlockStateForLesson,
  isChildRequest,
  isLessonCompletedForChild,
  isLessonCompletedUsingPassedSet,
  mapLessonItemsForChild,
  toIdString,
} from "./lessons.helpers.js";

export const getMyLessons = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const child = req.user;
    const allowedModes = ["all", child.status === "autistic" ? "autism" : "normal"];

    const lessons = await Lesson.find({
      isActive: true,
      mode: { $in: allowedModes },
    })
      .sort({ category: 1, stage: 1, mode: 1, order: 1 })
      .lean();

    if (!lessons.length) {
      return res.status(200).json({
        message: "Lessons fetched successfully",
        tracks: [],
      });
    }

    const lessonIds = lessons.map((lesson) => lesson._id);
    const passedSet = await getPassedSetForLessons(child._id, lessonIds);

    const completionMap = new Map();
    lessons.forEach((lesson) => {
      completionMap.set(toIdString(lesson._id), isLessonCompletedUsingPassedSet(lesson, passedSet));
    });

    const tracksMap = new Map();
    for (const lesson of lessons) {
      const key = getTrackKey(lesson);
      if (!tracksMap.has(key)) {
        tracksMap.set(key, []);
      }
      tracksMap.get(key).push(lesson);
    }

    const tracks = Array.from(tracksMap.entries()).map(([, trackLessons]) => {
      trackLessons.sort((a, b) => (a.order || 0) - (b.order || 0));

      const lessonDtos = [];
      let previousLessonId = null;
      
      for (const lesson of trackLessons) {
        const lessonId = toIdString(lesson._id);
        const isCompleted = completionMap.get(lessonId) || false;
        const isLocked = previousLessonId
          ? !(completionMap.get(previousLessonId) || false)
          : false;
      
        const activeItems = getActiveItems(lesson);
        const quizItemsCount = activeItems.filter((item) => item.type === "quiz").length;
        const videoItemsCount = activeItems.filter((item) => item.type === "video").length;
      
        lessonDtos.push({
          _id: lessonId,
          title: lesson.title,
          description: lesson.description,
          category: lesson.category,
          stage: lesson.stage,
          mode: lesson.mode,
          order: lesson.order,
          isLocked,
          isCompleted,
          requiredPreviousLessonId: previousLessonId,
          itemsCount: activeItems.length,
          quizItemsCount,
          videoItemsCount,
          items: activeItems.map((item) => ({
            _id: toIdString(item._id),
            type: item.type,
            itemOrder: item.itemOrder,
            quizId: item.quizId ? toIdString(item.quizId) : null,
            videoId: item.videoId ? toIdString(item.videoId) : null,
          })),
        });
      
        previousLessonId = lessonId;
      }

      const firstLesson = trackLessons[0];
      
      return {
        category: firstLesson.category,
        stage: firstLesson.stage,
        mode: firstLesson.mode,
        lessons: lessonDtos,
      };
    });

    return res.status(200).json({
      message: "Lessons fetched successfully",
      tracks,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lessons",
      error: error.message,
    });
  }
};

export const getLessonByIdForChild = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const { lessonId } = req.params;
    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const child = req.user;
    const lesson = await getChildLesson(child, lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const unlockState = await getUnlockStateForLesson(child._id, lesson.toObject());
    if (unlockState.isLocked) {
      return res.status(423).json({
        message: "Lesson is locked",
        requiredPreviousLessonId: unlockState.requiredPreviousLessonId,
      });
    }

    const hydratedLesson = await getLessonWithContent(lesson._id);
    const passedSet = await getPassedSetForLessons(child._id, [lesson._id]);
    const isCompleted = isLessonCompletedUsingPassedSet(hydratedLesson.toObject(), passedSet);

    return res.status(200).json({
      message: "Lesson fetched successfully",
      lesson: {
        _id: toIdString(hydratedLesson._id),
        title: hydratedLesson.title,
        description: hydratedLesson.description,
        category: hydratedLesson.category,
        stage: hydratedLesson.stage,
        mode: hydratedLesson.mode,
        order: hydratedLesson.order,
        items: mapLessonItemsForChild(hydratedLesson),
      },
      progress: {
        isLocked: false,
        isCompleted,
        requiredPreviousLessonId: unlockState.requiredPreviousLessonId,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lesson",
      error: error.message,
    });
  }
};

export const submitLessonQuizAttempt = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const { lessonId, itemId } = req.params;
    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const childSession = req.user;
    const lesson = await getChildLesson(childSession, lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const unlockState = await getUnlockStateForLesson(childSession._id, lesson.toObject());
    if (unlockState.isLocked) {
      return res.status(423).json({
        message: "Lesson is locked",
        requiredPreviousLessonId: unlockState.requiredPreviousLessonId,
      });
    }

    const lessonItem = getLessonQuizItemOrNull(lesson.toObject(), itemId);
    if (!lessonItem) {
      return res.status(404).json({ message: "Quiz item not found in lesson" });
    }

    const quiz = await Quiz.findById(lessonItem.quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const { answers = [], startedAt } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ message: "answers must be an array" });
    }

    const child = await Child.findById(childSession._id);
    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    // ✅ Initialize arrays
    if (!Array.isArray(child.awardedLessonQuestionKeys)) {
      child.awardedLessonQuestionKeys = [];
    }
    if (!Array.isArray(child.completedLessonItems)) {
      child.completedLessonItems = [];
    }

    const previousAttemptsCount = await QuizAttempt.countDocuments({
      childId: child._id,
      lessonId: lesson._id,
      lessonItemId: lessonItem._id,
      quizId: quiz._id,
    });
    const attemptNumber = previousAttemptsCount + 1;

    let correctAnswers = 0;
    let wrongAnswers = 0;
    let earnedPoints = 0;
    let totalPossiblePoints = 0;

    const awardedNow = [];
    const normalizedAnswers = [];

    // ✅ CHECK IF THIS IS A STROKES QUIZ
    const isStrokesQuiz = quiz.type === "strokes";
    // ✅ CHECK IF THIS IS A SORTING QUIZ
    const isSortingQuiz = quiz.type === "sorting";
    // ✅ CHECK IF THIS IS A MATCHING QUIZ
    const isMatchingQuiz = quiz.type === "matching";
    // ✅ CHECK IF THIS IS A SEQUENCING QUIZ
    const isSequencingQuiz = quiz.type === "sequencing";

    const questionsCount = isStrokesQuiz
      ? (quiz.strokeItems?.length || 0)
      : (quiz.questions?.length || 0);

    console.log("📊 Quiz Submission Details:");
    console.log("   - Type:", quiz.type);
    console.log("   - Is Strokes:", isStrokesQuiz);
    console.log("   - Is Sorting:", isSortingQuiz);
    console.log("   - Is Matching:", isMatchingQuiz);
    console.log("   - Questions Count:", questionsCount);
    console.log("   - Answers Count:", answers.length);

    // ✅ Process answers
    for (let i = 0; i < questionsCount; i++) {
      const submitted = answers.find((answer) => Number(answer.questionIndex) === i);

      let selectedAnswer = "";
      let correctAnswer = "";
      let isCorrect = false;
      let maxPoints = 1;

      if (isStrokesQuiz) {
        // ✅ FOR STROKES: answer contains "drawn_with_X%_accuracy"
        selectedAnswer = submitted?.answer?.toString?.()?.trim?.() || "";
        const accuracyMatch = selectedAnswer.match(/(\d+)%/);
        const accuracy = accuracyMatch ? parseInt(accuracyMatch[1]) : 0;
        isCorrect = accuracy >= 50;
        correctAnswer = "drawn_correctly";
        maxPoints = 1;

        console.log(`   ✍️ Stroke ${i}: accuracy=${accuracy}%, isCorrect=${isCorrect}`);
      } else {
        // ✅ FOR OTHER QUIZ TYPES
        const question = quiz.questions[i];
        selectedAnswer = submitted?.answer?.toString?.()?.trim?.() || "";

        // ✅ FIX: للـ sorting في items[0].category، للـ matching في items[0].text
        if (isSortingQuiz) {
          correctAnswer = question.items?.[0]?.category?.toString?.()?.trim?.() || "";
        } else if (isMatchingQuiz) {
          correctAnswer = question.items?.[0]?.text?.toString?.()?.trim?.() || "";
        } else if (isSequencingQuiz) {
          // الإجابة الصح = sequenceItems مرتبة حسب correctOrder مفصولة بـ " -> "
          correctAnswer = (question.sequenceItems || [])
            .slice()
            .sort((a, b) => (a.correctOrder || 0) - (b.correctOrder || 0))
            .map(item => item.text)
            .join(" -> ");
        } else {
          correctAnswer = question.correctAnswer?.toString?.()?.trim?.() || "";
        }

        isCorrect = selectedAnswer === correctAnswer;
        maxPoints = question.points || 1;

        console.log(`   📝 Question ${i}: selected="${selectedAnswer}", correct="${correctAnswer}", isCorrect=${isCorrect}`);
      }

      totalPossiblePoints += maxPoints;

      let pointsEarned = 0;

      if (isCorrect) {
        correctAnswers++;

        const questionKey = `${lesson._id}_${quiz._id}_${i}`;
        const alreadyAwarded = child.awardedLessonQuestionKeys.includes(questionKey);

        if (!alreadyAwarded) {
          pointsEarned = maxPoints;
          child.points += pointsEarned;
          child.awardedLessonQuestionKeys.push(questionKey);
          awardedNow.push(questionKey);
        }
      } else {
        wrongAnswers++;
      }

      earnedPoints += pointsEarned;

      normalizedAnswers.push({
        questionIndex: i,
        question: isStrokesQuiz
          ? `Write: ${quiz.strokeItems[i]?.character || "character"}`
          : (quiz.questions[i]?.question || ""),
        selectedAnswer,
        correctAnswer,
        isCorrect,
        pointsEarned,
        maxPoints,
        feedback: isCorrect
          ? (isStrokesQuiz ? "✅ أحسنت! حطيت الحرف صح!" : (quiz.questions[i]?.feedback?.correct || "Correct answer"))
          : (isStrokesQuiz ? "❌ حاول تاني، الحرف ما اتكتبش صح" : (quiz.questions[i]?.feedback?.incorrect || "Incorrect answer")),
      });
    }

    const percentage =
      questionsCount > 0
        ? Number(((correctAnswers / questionsCount) * 100).toFixed(2))
        : 0;

    const passed = percentage >= PASS_THRESHOLD;

    // ✅ Bonus points: 1 bonus if >= 75%, 2 bonus if 100%
    // يتدي البونص مرة واحدة بس في أول مرة يعدي العتبة دي
    const bonusKey75  = `bonus_75_${toIdString(lesson._id)}_${toIdString(lessonItem._id)}`;
    const bonusKey100 = `bonus_100_${toIdString(lesson._id)}_${toIdString(lessonItem._id)}`;

    let earnedBonus = 0;

    if (!Array.isArray(child.awardedLessonQuestionKeys)) {
      child.awardedLessonQuestionKeys = [];
    }

    if (percentage >= 86 && !child.awardedLessonQuestionKeys.includes(bonusKey100)) {
      // 86% → 100% → بونص 2
      earnedBonus = 2;
      child.bonus = (child.bonus || 0) + earnedBonus;
      child.awardedLessonQuestionKeys.push(bonusKey100);
      // سجّل الـ key بتاع 75 كمان عشان ما ياخدش بونص 1 فوق بونص 2
      if (!child.awardedLessonQuestionKeys.includes(bonusKey75)) {
        child.awardedLessonQuestionKeys.push(bonusKey75);
      }
    } else if (percentage >= 75 && !child.awardedLessonQuestionKeys.includes(bonusKey75)) {
      // 75% → 85% → بونص 1
      earnedBonus = 1;
      child.bonus = (child.bonus || 0) + earnedBonus;
      child.awardedLessonQuestionKeys.push(bonusKey75);
    }

    console.log("🏅 Bonus awarded:", { percentage, earnedBonus, totalBonus: child.bonus });

    console.log("📊 Quiz Submission:", {
      lessonId: toIdString(lesson._id),
      itemId: toIdString(lessonItem._id),
      percentage,
      passed,
    });

    console.log("📊 BEFORE Saving Quiz - completedLessonItems:");
    console.log("   Count:", child.completedLessonItems.length);
    console.log("   Items:", child.completedLessonItems.map(item => ({
      lessonId: toIdString(item.lessonId),
      itemId: toIdString(item.itemId),
      type: item.type
    })));

    // ✅ Create attempt record
    const attempt = await QuizAttempt.create({
      childId: child._id,
      quizId: quiz._id,
      lessonId: lesson._id,
      lessonItemId: lessonItem._id,
      attemptNumber,
      answers: normalizedAnswers,
      totalQuestions: questionsCount,
      correctAnswers,
      wrongAnswers,
      earnedPoints,
      totalPossiblePoints,
      percentage,
      passThreshold: PASS_THRESHOLD,
      passed,
      startedAt: startedAt || new Date(),
      submittedAt: new Date(),
    });

    console.log("✅ QuizAttempt created:", attempt._id);

    // ✅ If passed, mark as completed in progress
    if (passed) {
      const alreadyCompleted = child.completedLessonItems.some(
        (item) =>
          toIdString(item.lessonId) === toIdString(lesson._id) &&
          toIdString(item.itemId) === toIdString(lessonItem._id) &&
          item.type === "quiz"
      );
    
      if (!alreadyCompleted) {
        child.completedLessonItems.push({
          lessonId: lesson._id,
          itemId: lessonItem._id,
          type: "quiz",
          completedAt: new Date(),
        });
      }
    }
    
    await child.save(); // ✅ هنا بتتحفظ في الـ database
    console.log("✅ Child progress saved to database");

    // ✅ شيك هل الطفل خلّص كل كويزات الـ category دي → ارفع الـ Level
    if (passed) {
      const childMode = child.status === "autistic" ? "autism" : "normal";
      const categoryLessons = await Lesson.find({
        isActive: true,
        category: lesson.category,
        mode: { $in: ["all", childMode] },
      }).lean().select("_id items");
    
      const allCategoryPassed = categoryLessons.every(catLesson => {
        const quizItems = (catLesson.items || []).filter(
          item => item.isActive !== false && item.type === "quiz"
        );
        if (!quizItems.length) return true; // بدون كويزات = مكتمل
    
        return quizItems.every(item =>
          child.completedLessonItems.some(
            completed =>
              toIdString(completed.lessonId) === toIdString(catLesson._id) &&
              toIdString(completed.itemId) === toIdString(item._id) &&
              completed.type === "quiz"
          )
        );
      });
    
      // ✅ لو الكاتجوري كاملة، أضفها في completedCategories
      if (allCategoryPassed) {
        if (!Array.isArray(child.completedCategories)) {
          child.completedCategories = [];
        }
        if (!child.completedCategories.includes(lesson.category)) {
          child.completedCategories.push(lesson.category);
          await child.save();
          console.log("🏆 Category completed:", lesson.category);
        }
      }
    }
    
    await child.save(); 

    // ✅ Fetch updated lesson completion state
    const currentLessonCompleted = await isLessonCompletedForChild(child._id, lesson.toObject());
    const nextLesson = await Lesson.findOne({
      isActive: true,
      category: lesson.category,
      stage: lesson.stage,
      mode: lesson.mode,
      order: { $gt: lesson.order },
    })
      .sort({ order: 1 })
      .select("_id")
      .lean();

    return res.status(201).json({
      message: "Lesson quiz attempt submitted successfully",
      result: {
        attemptId: attempt._id,
        attemptNumber: attempt.attemptNumber,
        lessonId: lesson._id,
        lessonItemId: lessonItem._id,
        quizId: quiz._id,
        quizTitle: quiz.title,
        quizType: quiz.type,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        wrongAnswers: attempt.wrongAnswers,
        earnedPoints: attempt.earnedPoints,
        totalPossiblePoints: attempt.totalPossiblePoints,
        percentage: attempt.percentage,
        passThreshold: PASS_THRESHOLD,
        passed,
        totalChildPoints: child.points,
        earnedBonus,
        totalChildBonus: child.bonus || 0,
        awardedNowCount: awardedNow.length,
        isLessonCompleted: currentLessonCompleted,
        nextLessonId: nextLesson?._id || null,
        nextLessonUnlocked: nextLesson ? currentLessonCompleted : null,
      },
    });
  } catch (error) {
    console.error("❌ Error in submitLessonQuizAttempt:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Attempt numbering conflict detected, please retry",
      });
    }

    return res.status(500).json({
      message: "Failed to submit lesson quiz attempt",
      error: error.message,
      code: error.code,
    });
  }
};

export const getLessonQuizAttempts = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const { lessonId, itemId } = req.params;
    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const child = req.user;
    const lesson = await getChildLesson(child, lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const lessonItem = getLessonQuizItemOrNull(lesson.toObject(), itemId);
    if (!lessonItem) {
      return res.status(404).json({ message: "Quiz item not found in lesson" });
    }

    const attempts = await QuizAttempt.find({
      childId: child._id,
      lessonId: lesson._id,
      lessonItemId: lessonItem._id,
      quizId: lessonItem.quizId,
    })
      .sort({ attemptNumber: -1 })
      .populate("quizId", "title category stage type mode");

    return res.status(200).json({
      message: "Lesson quiz attempts fetched successfully",
      count: attempts.length,
      attempts,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lesson quiz attempts",
      error: error.message,
    });
  }
};

export const getLessonQuizSummary = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const { lessonId, itemId } = req.params;
    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const child = req.user;
    const lesson = await getChildLesson(child, lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const lessonItem = getLessonQuizItemOrNull(lesson.toObject(), itemId);
    if (!lessonItem) {
      return res.status(404).json({ message: "Quiz item not found in lesson" });
    }

    const attempts = await QuizAttempt.find({
      childId: child._id,
      lessonId: lesson._id,
      lessonItemId: lessonItem._id,
      quizId: lessonItem.quizId,
    }).sort({ attemptNumber: 1 });

    if (!attempts.length) {
      return res.status(404).json({
        message: "No attempts found for this lesson quiz",
      });
    }

    const bestAttempt = attempts.reduce((best, current) =>
      current.percentage > best.percentage ? current : best
    );
    const lastAttempt = attempts[attempts.length - 1];
    const passedAttemptsCount = attempts.filter((attempt) => attempt.passed).length;

    return res.status(200).json({
      message: "Lesson quiz summary fetched successfully",
      summary: {
        lessonId: lesson._id,
        lessonItemId: lessonItem._id,
        quizId: lessonItem.quizId,
        attemptsCount: attempts.length,
        passedAttemptsCount,
        passThreshold: PASS_THRESHOLD,
        bestScore: {
          attemptNumber: bestAttempt.attemptNumber,
          percentage: bestAttempt.percentage,
          earnedPoints: bestAttempt.earnedPoints,
          totalPossiblePoints: bestAttempt.totalPossiblePoints,
          passed: bestAttempt.passed,
        },
        lastScore: {
          attemptNumber: lastAttempt.attemptNumber,
          percentage: lastAttempt.percentage,
          earnedPoints: lastAttempt.earnedPoints,
          totalPossiblePoints: lastAttempt.totalPossiblePoints,
          passed: lastAttempt.passed,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lesson quiz summary",
      error: error.message,
    });
  }
};