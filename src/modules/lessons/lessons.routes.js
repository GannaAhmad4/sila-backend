import { Router } from "express";
import { auth } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import {
  // Admin
  createLesson,
  getAdminLessons,
  getAdminLessonById,
  updateLesson,
  deleteLesson,
  addLessonItem,
  updateLessonItem,
  deleteLessonItem,
  reorderLessons,
  // Child
  getLessonByIdForChild,
  getLessonQuizAttempts,
  getLessonQuizSummary,
  getMyLessons,
  submitLessonQuizAttempt,
} from "./lessons.controller.js";

// ✅ Import progress controller
import {
  saveVideoProgress,
  getVideoProgress,
  getLessonProgress,
  clearVideoProgress,
  getChildProgressData,
} from "../progress/progress.controller.js";

const router = Router();

// ─── Admin Routes ──────────────────────────────────────────────
router.get("/admin",                           auth, isAuthorized(["Admin", "superAdmin"]), getAdminLessons);
router.post("/admin",                          auth, isAuthorized(["Admin", "superAdmin"]), createLesson);
router.post("/admin/reorder",                  auth, isAuthorized(["Admin", "superAdmin"]), reorderLessons);
router.get("/admin/:lessonId",                 auth, isAuthorized(["Admin", "superAdmin"]), getAdminLessonById);
router.put("/admin/:lessonId",                 auth, isAuthorized(["Admin", "superAdmin"]), updateLesson);
router.delete("/admin/:lessonId",              auth, isAuthorized(["Admin", "superAdmin"]), deleteLesson);
router.post("/admin/:lessonId/items",          auth, isAuthorized(["Admin", "superAdmin"]), addLessonItem);
router.put("/admin/:lessonId/items/:itemId",   auth, isAuthorized(["Admin", "superAdmin"]), updateLessonItem);
router.delete("/admin/:lessonId/items/:itemId",auth, isAuthorized(["Admin", "superAdmin"]), deleteLessonItem);

// ─── Child Routes ──────────────────────────────────────────────
router.get("/me", auth, getMyLessons);
router.get("/:lessonId", auth, getLessonByIdForChild);
router.get("/:lessonId/quizzes/:itemId/attempts", auth, getLessonQuizAttempts);
router.get("/:lessonId/quizzes/:itemId/summary", auth, getLessonQuizSummary);
router.post("/:lessonId/quizzes/:itemId/attempts", auth, submitLessonQuizAttempt);

// ─── Progress Routes ──────────────────────────────────────────────
router.post("/:lessonId/items/:itemId/progress", auth, saveVideoProgress);
router.get("/:lessonId/items/:itemId/progress", auth, getVideoProgress);
router.get("/:lessonId/progress", auth, getLessonProgress);
router.delete("/:lessonId/items/:itemId/progress", auth, clearVideoProgress);
router.get("/progress/child/data", auth, getChildProgressData);

export default router;