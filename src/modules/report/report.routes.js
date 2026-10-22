import { Router } from "express";
import { auth } from "../../middleware/authentication.js";
import { isAuthorized } from "../../middleware/authorization.js";
import { Role } from "../../DB/Models/user.model.js";
import * as reportController from "./report.controller.js";

const router = Router();

// ✅ استخدم middleware للـ parentId من JWT
router.get("/child/:childId", 
    auth,  // ✅ هذا بيعطيك req.user من الـ token
    isAuthorized([Role.PARENT, Role.ADMIN, Role.SUPERADMIN]), 
    reportController.getDashboardAnalytics 
);

router.patch("/mental-status", 
    auth,
    reportController.updateMentalStatus
);

export default router;