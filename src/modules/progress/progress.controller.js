import { Child } from "../../DB/Models/child.model.js";
import { Lesson } from "../../DB/Models/lesson.model.js";
import { Quiz } from "../../DB/Models/quiz.model.js";
import { QuizAttempt } from "../../DB/Models/quizAttempt.model.js";
import { PASS_THRESHOLD } from "../lessons/lessons.constants.js";
import { 
  toIdString, 
  ensureObjectId, 
  getActiveItems,
  isChildRequest,
  getChildLesson,
  getLessonQuizItemOrNull,
  isLessonCompletedForChild,
} from "../lessons/lessons.helpers.js";

// ✅ Save Video Progress
export const saveVideoProgress = async (req, res) => {
  try {
    const { lessonId, itemId } = req.params;
    const { percentage, isCompleted } = req.body;

    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const child = await Child.findById(req.user._id);
    if (!child) return res.status(404).json({ message: "Child not found" });

    // ✅ Update or create watched video entry
    const existingIndex = child.watchedVideos.findIndex(
      (vid) => toIdString(vid.lessonId) === toIdString(lessonId) && 
               toIdString(vid.itemId) === toIdString(itemId) // ✅ أضفي toIdString
    );

    if (existingIndex >= 0) {
      child.watchedVideos[existingIndex].percentage = Math.max(
        child.watchedVideos[existingIndex].percentage,
        percentage
      );
      child.watchedVideos[existingIndex].isCompleted = isCompleted || child.watchedVideos[existingIndex].isCompleted;
      child.watchedVideos[existingIndex].lastUpdatedAt = new Date();
    } else {
      child.watchedVideos.push({
        lessonId,
        itemId,
        percentage,
        isCompleted,
        watchedAt: new Date(),
        lastUpdatedAt: new Date(),
      });
    }

    // ✅ If video is completed, add to completedLessonItems
    if (isCompleted) {
      const alreadyCompleted = child.completedLessonItems.some(
        (item) => toIdString(item.lessonId) === lessonId && 
                  toIdString(item.itemId) === itemId &&
                  item.type === "video"
      );

      if (!alreadyCompleted) {
        child.completedLessonItems.push({
          lessonId,
          itemId,
          type: "video",
          completedAt: new Date(),
        });
      }
    }

    await child.save();

    return res.status(200).json({
      message: "Video progress saved successfully",
      progress: {
        percentage: child.watchedVideos[child.watchedVideos.length - 1].percentage,
        isCompleted,
      },
    });
  } catch (error) {
    console.error("❌ Error saving progress:", error);
    return res.status(500).json({
      message: "Failed to save video progress",
      error: error.message,
    });
  }
};

// ✅ Get Video Progress
export const getVideoProgress = async (req, res) => {
  try {
    const { lessonId, itemId } = req.params;

    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const child = await Child.findById(req.user._id).select("watchedVideos");
    if (!child) return res.status(404).json({ message: "Child not found" });

    const videoProgress = child.watchedVideos.find(
      (vid) => toIdString(vid.lessonId) === lessonId && toIdString(vid.itemId) === itemId
    );

    if (!videoProgress) {
      return res.status(200).json({
        message: "No progress found",
        progress: {
          percentage: 0,
          isCompleted: false,
        },
      });
    }

    return res.status(200).json({
      message: "Video progress retrieved successfully",
      progress: {
        percentage: videoProgress.percentage,
        isCompleted: videoProgress.isCompleted,
        lastUpdatedAt: videoProgress.lastUpdatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error getting progress:", error);
    return res.status(500).json({
      message: "Failed to get video progress",
      error: error.message,
    });
  }
};

// ✅ Get All Progress for Lesson
export const getLessonProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const child = await Child.findById(req.user._id).select("watchedVideos completedLessonItems");
    if (!child) return res.status(404).json({ message: "Child not found" });

    const lesson = await Lesson.findById(lessonId).select("items").lean();
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const items = getActiveItems(lesson);
    const progress = items.map((item) => {
      const itemId = toIdString(item._id);
      const videoProgress = child.watchedVideos.find(
        (vid) => toIdString(vid.lessonId) === lessonId && toIdString(vid.itemId) === itemId
      );

      const isCompleted = child.completedLessonItems.some(
        (completed) => toIdString(completed.lessonId) === lessonId && 
                       toIdString(completed.itemId) === itemId
      );

      return {
        itemId,
        type: item.type,
        percentage: videoProgress?.percentage || 0,
        isCompleted: isCompleted || videoProgress?.isCompleted || false,
        lastUpdatedAt: videoProgress?.lastUpdatedAt || null,
      };
    });

    return res.status(200).json({
      message: "Lesson progress retrieved successfully",
      progress,
    });
  } catch (error) {
    console.error("❌ Error getting lesson progress:", error);
    return res.status(500).json({
      message: "Failed to get lesson progress",
      error: error.message,
    });
  }
};

// ✅ Clear Video Progress
export const clearVideoProgress = async (req, res) => {
  try {
    const { lessonId, itemId } = req.params;

    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const child = await Child.findById(req.user._id);
    if (!child) return res.status(404).json({ message: "Child not found" });

    child.watchedVideos = child.watchedVideos.filter(
      (vid) => !(toIdString(vid.lessonId) === lessonId && toIdString(vid.itemId) === itemId)
    );

    child.completedLessonItems = child.completedLessonItems.filter(
      (item) => !(toIdString(item.lessonId) === lessonId && 
                  toIdString(item.itemId) === itemId &&
                  item.type === "video")
    );

    await child.save();

    return res.status(200).json({
      message: "Video progress cleared successfully",
    });
  } catch (error) {
    console.error("❌ Error clearing progress:", error);
    return res.status(500).json({
      message: "Failed to clear video progress",
      error: error.message,
    });
  }
};

// ✅ Get Child Progress Data
export const getChildProgressData = async (req, res) => {
  try {
    const child = await Child.findById(req.user._id).select(
      "watchedVideos completedLessonItems points"
    );

    if (!child) return res.status(404).json({ message: "Child not found" });

    return res.status(200).json({
      message: "Child progress data retrieved successfully",
      child: {
        watchedVideos: child.watchedVideos || [],
        completedLessonItems: child.completedLessonItems || [],
        points: child.points || 0,
      },
    });
  } catch (error) {
    console.error("❌ Error getting child progress data:", error);
    return res.status(500).json({
      message: "Failed to get child progress data",
      error: error.message,
    });
  }
};

// ✅ SUBMIT LESSON QUIZ ATTEMPT - COMPLETE FUNCTION WITH STROKES SUPPORT
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
    const questionsCount = isStrokesQuiz 
      ? (quiz.strokeItems?.length || 0)
      : (quiz.questions?.length || 0);

    console.log("📊 Quiz Submission Details:");
    console.log("   - Type:", quiz.type);
    console.log("   - Is Strokes:", isStrokesQuiz);
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
        
        // Extract accuracy percentage from selectedAnswer
        const accuracyMatch = selectedAnswer.match(/(\d+)%/);
        const accuracy = accuracyMatch ? parseInt(accuracyMatch[1]) : 0;
        
        // ✅ CORRECT if accuracy >= 50%
        isCorrect = accuracy >= 50;
        correctAnswer = "drawn_correctly"; // Placeholder for strokes
        maxPoints = 1;

        console.log(`   ✍️ Stroke ${i}: accuracy=${accuracy}%, isCorrect=${isCorrect}`);
      } else {
        // ✅ FOR OTHER QUIZ TYPES: existing logic
        const question = quiz.questions[i];
        selectedAnswer = submitted?.answer?.toString?.()?.trim?.() || "";
        correctAnswer = question.correctAnswer?.toString?.()?.trim?.() || "";
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
          console.log(`   ✅ Points awarded: +${pointsEarned} (Question ${i})`);
        } else {
          console.log(`   ⚠️ Points already awarded for Question ${i}`);
        }
      } else {
        wrongAnswers++;
        console.log(`   ❌ Wrong answer for Question ${i}`);
      }

      earnedPoints += pointsEarned;

      normalizedAnswers.push({
        questionIndex: i,
        question: isStrokesQuiz 
          ? `Write: ${quiz.strokeItems[i]?.character || 'character'}`
          : (quiz.questions[i]?.question || ""),
        selectedAnswer,
        correctAnswer,
        isCorrect,
        pointsEarned,
        maxPoints,
        feedback: isCorrect
          ? (isStrokesQuiz ? "✅ أحسنت! حطيت الحرف صح!" : "✅ إجابة صحيحة!")
          : (isStrokesQuiz ? "❌ حاول تاني، الحرف ما اتكتبش صح" : "❌ إجابة خاطئة"),
      });
    }

    const percentage =
      questionsCount > 0
        ? Number(((correctAnswers / questionsCount) * 100).toFixed(2))
        : 0;

    const passed = percentage >= PASS_THRESHOLD;

    console.log("📊 Final Attempt Summary:");
    console.log("   - Correct:", correctAnswers);
    console.log("   - Wrong:", wrongAnswers);
    console.log("   - Percentage:", percentage);
    console.log("   - Passed:", passed);
    console.log("   - Earned Points:", earnedPoints);
    console.log("   - Awarded Count:", awardedNow.length);

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
        console.log("✅ Quiz marked as completed in progress");
      }
    }
    
    await child.save();
    console.log("✅ Child progress saved to database");

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