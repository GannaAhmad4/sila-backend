import { Router } from "express";
import { auth } from "../../middleware/authentication.js";
import { Child } from "../../DB/Models/child.model.js";

const router = Router();

router.get("/child/:id", async (req, res) => {
  try {
    const child = await Child.findById(req.params.id).select("-password");
    
    if (!child) {
      return res.status(404).json({ message: "not found" });
    }

    res.status(200).json({
      id: child._id,
      name: child.name,
      age: child.age,
      gender: child.gender,
      status: child.status,
      points: child.points
    });
  } catch (error) {
    res.status(500).json({ message: "server error" });
  }
});

// ✅ Get child progress
router.get("/progress", auth, async (req, res) => {
  try {
    console.log("📡 /user/progress endpoint called");
    console.log("👤 User ID:", req.user?._id);

    if (!req.user?._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const child = await Child.findById(req.user._id).select(
      "watchedVideos completedLessonItems points"
    );

    if (!child) {
      return res.status(404).json({ message: "Child not found" });
    }

    console.log("✅ Progress data retrieved");
    console.log("   - watchedVideos:", child.watchedVideos?.length || 0);
    console.log("   - completedLessonItems:", child.completedLessonItems?.length || 0);

    return res.status(200).json({
      message: "Child progress data retrieved successfully",
      child: {
        watchedVideos: child.watchedVideos || [],
        completedLessonItems: child.completedLessonItems || [],
        points: child.points || 0,
      },
    });
  } catch (error) {
    console.error("❌ Error in /user/progress:", error);
    return res.status(500).json({
      message: "Failed to get child progress data",
      error: error.message,
    });
  }
});

export default router;