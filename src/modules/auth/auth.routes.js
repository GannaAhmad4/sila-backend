import { Router } from "express";
import * as authController from "./auth.controller.js";

const router = Router();


router.post("/register", authController.register);
router.get("/activate/:token", authController.activate);
router.post("/login", authController.login);

export default router;