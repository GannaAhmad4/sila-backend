import { Router } from "express";
import * as adminController from "./admin.controller.js";
import { auth } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { Role } from "../../DB/Models/user.model.js";
import * as lessonsController from "../lessons/lessons.controller.js";
import * as activitiesController from "../activities/activities.controller.js";
import { uploadVideo, handleUploadError } from "../../middleware/uploadVideo.middleware.js";

const router = Router();

// ===== Me =====
router.get(
  "/me",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.getMe
);

// ===== Get All Admins =====
router.get(
  "/admins",
  auth,
  isAuthorized([Role.SUPERADMIN]),
  adminController.getAllAdmins
);

// ===== Activate/Deactivate Admin =====
router.patch(
  "/admins/:adminId/activate",
  auth,
  isAuthorized([Role.SUPERADMIN]),
  adminController.activateAdmin
);

// ===== Admin Management =====
router.post(
  "/add-admin",
  auth,
  isAuthorized([Role.SUPERADMIN]),
  adminController.addAdmin
);

router.delete(
  "/delete-admin/:adminId",
  auth,
  isAuthorized([Role.SUPERADMIN]),
  adminController.deleteAdmin
);

// ===== Videos =====

// ✅ رفع فيديو جديد
router.post(
  "/videos/upload",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  uploadVideo.single("video"),
  handleUploadError,
  adminController.uploadVideo
);

router.post(
  "/videos",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.createVideo
);

router.get(
  "/videos",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.getAllVideos
);

router.get(
  "/videos/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.getVideoById
);

router.put(
  "/videos/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  uploadVideo.single("video"),
  handleUploadError,
  adminController.updateVideo
);

router.delete(
  "/videos/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.deleteVideo
);

router.delete(
  "/videos/:id/file",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.deleteVideoFile
);

// ===== Quizzes =====
router.post(
  "/quizzes",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.addQuiz
);

router.get(
  "/quizzes",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.getAllQuizzes
);

router.get(
  "/quizzes/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.getQuizById
);

router.put(
  "/quizzes/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.updateQuiz
);

router.delete(
  "/quizzes/:id",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  adminController.deleteQuiz
);

// ===== Lessons =====
router.post(
  "/lessons",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.createLesson
);

router.get(
  "/lessons",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.getAdminLessons
);

router.put(
  "/lessons/reorder",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.reorderLessons
);

router.get(
  "/lessons/:lessonId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.getAdminLessonById
);

router.patch(
  "/lessons/:lessonId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.updateLesson
);

router.delete(
  "/lessons/:lessonId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.deleteLesson
);

router.post(
  "/lessons/:lessonId/items",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.addLessonItem
);

router.patch(
  "/lessons/:lessonId/items/:itemId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.updateLessonItem
);

router.delete(
  "/lessons/:lessonId/items/:itemId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  lessonsController.deleteLessonItem
);

// ===== Activities / Games =====
router.post(
  "/activities/games",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  activitiesController.createActivityGame
);

router.get(
  "/activities/games",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  activitiesController.getAllActivityGames
);

router.get(
  "/activities/games/:gameId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  activitiesController.getActivityGameById
);

router.patch(
  "/activities/games/:gameId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  activitiesController.updateActivityGame
);

router.delete(
  "/activities/games/:gameId",
  auth,
  isAuthorized([Role.ADMIN, Role.SUPERADMIN]),
  activitiesController.deleteActivityGame
);

export default router;