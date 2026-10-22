import { Router } from "express";
import { auth } from "../../middleware/authentication.js";
import {
  saveVideoProgress,
  getVideoProgress,
  getLessonProgress,
  clearVideoProgress,
  getChildProgressData,
} from "./progress.controller.js";

const router = Router();

// ✅ Save video progress
router.post("/video/:lessonId/:itemId", auth, saveVideoProgress);

// ✅ Get video progress
router.get("/video/:lessonId/:itemId", auth, getVideoProgress);

// ✅ Get all child progress
router.get("/child", auth, getChildProgressData);

// ✅ Get lesson progress
router.get("/:lessonId", auth, getLessonProgress);

// ✅ Clear progress
router.delete("/:lessonId/:itemId", auth, clearVideoProgress);

export default router;