import { Lesson } from "../../DB/Models/lesson.model.js";
import { Quiz } from "../../DB/Models/quiz.model.js";
import { Video } from "../../DB/Models/video.model.js";
import {
  ensureObjectId,
  extractInlineContent,
  getLessonWithContent,
  getNextLessonOrder,
  normalizeLessonItemsOrder,
  parsePositiveInteger,
  toIdString,
} from "./lessons.helpers.js";

export const createLesson = async (req, res) => {
  try {
    const { title, description = "", category, mode = "all" } = req.body;
    const stage = parsePositiveInteger(req.body.stage);

    if (!title || !category || !stage) {
      return res.status(400).json({
        message: "title, category and stage are required",
      });
    }

    const order = await getNextLessonOrder({ category, stage, mode });

    const lesson = await Lesson.create({
      title,
      description,
      category,
      stage,
      mode,
      order,
      isActive: req.body.isActive !== false,
      items: [],
    });

    return res.status(201).json({
      message: "Lesson created successfully",
      lesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to create lesson",
      error: error.message,
    });
  }
};

export const getAdminLessons = async (req, res) => {
  try {
    const { category, mode, isActive } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (mode) filter.mode = mode;
    filter.isActive = typeof isActive !== "undefined" ? isActive === "true" : true;

    if (typeof req.query.stage !== "undefined") {
      const parsedStage = parsePositiveInteger(req.query.stage);
      if (!parsedStage) {
        return res.status(400).json({ message: "stage must be a positive integer" });
      }
      filter.stage = parsedStage;
    }

    const lessons = await Lesson.find(filter)
      .sort({ category: 1, stage: 1, mode: 1, order: 1 })
      .populate("items.quizId")
      .populate("items.videoId");

    return res.status(200).json({
      message: "Lessons fetched successfully",
      count: lessons.length,
      lessons,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lessons",
      error: error.message,
    });
  }
};

export const getAdminLessonById = async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const lesson = await getLessonWithContent(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    return res.status(200).json({
      message: "Lesson fetched successfully",
      lesson,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lesson",
      error: error.message,
    });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const nextState = {
      title: req.body.title ?? lesson.title,
      description: req.body.description ?? lesson.description,
      category: req.body.category ?? lesson.category,
      mode: req.body.mode ?? lesson.mode,
      stage: lesson.stage,
      isActive: typeof req.body.isActive === "boolean" ? req.body.isActive : lesson.isActive,
    };

    if (typeof req.body.stage !== "undefined") {
      const parsedStage = parsePositiveInteger(req.body.stage);
      if (!parsedStage) {
        return res.status(400).json({ message: "stage must be a positive integer" });
      }
      nextState.stage = parsedStage;
    }

    const trackChanged =
      nextState.category !== lesson.category ||
      nextState.stage !== lesson.stage ||
      nextState.mode !== lesson.mode;

    if (trackChanged) {
      nextState.order = await getNextLessonOrder({
        category: nextState.category,
        stage: nextState.stage,
        mode: nextState.mode,
        excludeLessonId: lesson._id,
      });
    }

    lesson.title = nextState.title;
    lesson.description = nextState.description;
    lesson.category = nextState.category;
    lesson.stage = nextState.stage;
    lesson.mode = nextState.mode;
    lesson.isActive = nextState.isActive;
    if (trackChanged) {
      lesson.order = nextState.order;
    }

    await lesson.save();
    const updatedLesson = await getLessonWithContent(lesson._id);

    return res.status(200).json({
      message: "Lesson updated successfully",
      lesson: updatedLesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to update lesson",
      error: error.message,
    });
  }
};

export const deleteLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    lesson.isActive = false;
    await lesson.save();

    return res.status(200).json({
      message: "Lesson deactivated successfully",
      lesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to deactivate lesson",
      error: error.message,
    });
  }
};

export const addLessonItem = async (req, res) => {
  try {
    const { lessonId } = req.params;
    if (!ensureObjectId(lessonId)) {
      return res.status(400).json({ message: "Invalid lessonId" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const { type } = req.body;
    if (!["quiz", "video"].includes(type)) {
      return res.status(400).json({ message: "type must be quiz or video" });
    }

    const inlineContent = extractInlineContent(req.body, type);
    const requestedItemOrder = parsePositiveInteger(req.body.itemOrder);
    const maxExistingOrder = lesson.items.reduce(
      (max, item) => Math.max(max, Number(item.itemOrder) || 0),
      0
    );

    const itemData = {
      type,
      itemOrder: requestedItemOrder || maxExistingOrder + 1,
      isActive: req.body.isActive !== false,
      quizId: null,
      videoId: null,
    };

    if (type === "quiz") {
      let quiz = null;
      if (req.body.quizId) {
        if (!ensureObjectId(req.body.quizId)) {
          return res.status(400).json({ message: "Invalid quizId" });
        }
        quiz = await Quiz.findById(req.body.quizId);
        if (!quiz) {
          return res.status(404).json({ message: "Quiz not found" });
        }
      } else {
        const quizPayload = {
          ...inlineContent,
          category: inlineContent.category ?? lesson.category,
          stage: inlineContent.stage ?? lesson.stage,
          mode: inlineContent.mode ?? lesson.mode,
        };
        quiz = await Quiz.create(quizPayload);
      }
      itemData.quizId = quiz._id;
    }

    if (type === "video") {
      let video = null;
      if (req.body.videoId) {
        if (!ensureObjectId(req.body.videoId)) {
          return res.status(400).json({ message: "Invalid videoId" });
        }
        video = await Video.findById(req.body.videoId);
        if (!video) {
          return res.status(404).json({ message: "Video not found" });
        }
      } else {
        const videoPayload = {
          ...inlineContent,
          category: inlineContent.category ?? lesson.category,
          stage: inlineContent.stage ?? lesson.stage,
          mode: inlineContent.mode ?? lesson.mode,
        };
        video = await Video.create(videoPayload);
      }
      itemData.videoId = video._id;
    }

    lesson.items.push(itemData);
    const createdItemId = toIdString(lesson.items[lesson.items.length - 1]._id);
    normalizeLessonItemsOrder(lesson);
    await lesson.save();

    const hydratedLesson = await getLessonWithContent(lesson._id);
    const createdItem = hydratedLesson.items.id(createdItemId);

    return res.status(201).json({
      message: "Lesson item added successfully",
      item: createdItem,
      lesson: hydratedLesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to add lesson item",
      error: error.message,
    });
  }
};

export const updateLessonItem = async (req, res) => {
  try {
    const { lessonId, itemId } = req.params;
    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const item = lesson.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Lesson item not found" });
    }

    if (req.body.type && req.body.type !== item.type) {
      return res.status(400).json({
        message: "Changing item type is not supported. Delete and recreate the item.",
      });
    }

    if (typeof req.body.isActive === "boolean") {
      item.isActive = req.body.isActive;
    }

    const requestedItemOrder = parsePositiveInteger(req.body.itemOrder);
    if (requestedItemOrder) {
      item.itemOrder = requestedItemOrder;
    }

    const inlineContent = extractInlineContent(req.body, item.type);
    const hasContentUpdate = Object.keys(inlineContent).length > 0;

    if (item.type === "quiz") {
      if (req.body.quizId) {
        if (!ensureObjectId(req.body.quizId)) {
          return res.status(400).json({ message: "Invalid quizId" });
        }
        const existingQuiz = await Quiz.findById(req.body.quizId);
        if (!existingQuiz) {
          return res.status(404).json({ message: "Quiz not found" });
        }
        item.quizId = existingQuiz._id;
      }

      if (hasContentUpdate) {
        const updatedQuiz = await Quiz.findByIdAndUpdate(item.quizId, inlineContent, { returnDocument: "after", runValidators: true });
        if (!updatedQuiz) {
          return res.status(404).json({ message: "Quiz not found for update" });
        }
      }
    }

    if (item.type === "video") {
      if (req.body.videoId) {
        if (!ensureObjectId(req.body.videoId)) {
          return res.status(400).json({ message: "Invalid videoId" });
        }
        const existingVideo = await Video.findById(req.body.videoId);
        if (!existingVideo) {
          return res.status(404).json({ message: "Video not found" });
        }
        item.videoId = existingVideo._id;
      }

      if (hasContentUpdate) {
        const updatedVideo = await Video.findByIdAndUpdate(item.videoId, inlineContent, { returnDocument: "after", runValidators: true });
        if (!updatedVideo) {
          return res.status(404).json({ message: "Video not found for update" });
        }
      }
    }

    normalizeLessonItemsOrder(lesson);
    await lesson.save();

    const hydratedLesson = await getLessonWithContent(lesson._id);
    const updatedItem = hydratedLesson.items.id(itemId);

    return res.status(200).json({
      message: "Lesson item updated successfully",
      item: updatedItem,
      lesson: hydratedLesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to update lesson item",
      error: error.message,
    });
  }
};

export const deleteLessonItem = async (req, res) => {
  try {
    const { lessonId, itemId } = req.params;
    if (!ensureObjectId(lessonId) || !ensureObjectId(itemId)) {
      return res.status(400).json({ message: "Invalid lessonId or itemId" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const item = lesson.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Lesson item not found" });
    }

    item.deleteOne();
    normalizeLessonItemsOrder(lesson);
    await lesson.save();

    const hydratedLesson = await getLessonWithContent(lesson._id);

    return res.status(200).json({
      message: "Lesson item deleted successfully",
      lesson: hydratedLesson,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to delete lesson item",
      error: error.message,
    });
  }
};

export const reorderLessons = async (req, res) => {
  try {
    const { category, mode, orderedLessonIds } = req.body;
    const stage = parsePositiveInteger(req.body.stage);

    if (!category || !mode || !stage || !Array.isArray(orderedLessonIds)) {
      return res.status(400).json({
        message: "category, stage, mode and orderedLessonIds are required",
      });
    }

    const trackLessons = await Lesson.find({
      category,
      stage,
      mode,
      isActive: true,
    })
      .sort({ order: 1 })
      .select("_id");

    if (!trackLessons.length) {
      return res.status(404).json({ message: "No active lessons found for this track" });
    }

    const existingIds = trackLessons.map((lesson) => toIdString(lesson._id));
    const uniqueProvidedIds = new Set(orderedLessonIds);

    if (uniqueProvidedIds.size !== orderedLessonIds.length) {
      return res.status(400).json({ message: "orderedLessonIds contains duplicate values" });
    }

    if (orderedLessonIds.length !== existingIds.length) {
      return res.status(400).json({
        message: "orderedLessonIds must include all active lessons in this track",
        expectedCount: existingIds.length,
      });
    }

    const missingIds = existingIds.filter((id) => !uniqueProvidedIds.has(id));
    const invalidIds = orderedLessonIds.filter((id) => !existingIds.includes(id));

    if (missingIds.length || invalidIds.length) {
      return res.status(400).json({
        message: "orderedLessonIds does not match lessons in this track",
        missingIds,
        invalidIds,
      });
    }

    const operations = orderedLessonIds.map((lessonId, index) => ({
      updateOne: {
        filter: { _id: lessonId },
        update: { order: index + 1 },
      },
    }));

    await Lesson.bulkWrite(operations);

    const reorderedLessons = await Lesson.find({ category, stage, mode })
      .sort({ order: 1 })
      .populate("items.quizId")
      .populate("items.videoId");

    return res.status(200).json({
      message: "Lessons reordered successfully",
      lessons: reorderedLessons,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to reorder lessons",
      error: error.message,
    });
  }
};