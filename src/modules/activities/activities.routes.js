// activities.routes.js
import { Router } from "express";
import { auth } from "../../middleware/authentication.js";
import * as activitiesController from "./activities.controller.js";

const router = Router();

// ✅ Child endpoints
router.get("/games", auth, activitiesController.getChildActivityGames);
router.post("/games/:gameId/purchase", auth, activitiesController.purchaseActivityGame);

export default router;