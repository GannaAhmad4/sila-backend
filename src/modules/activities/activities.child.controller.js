import { ActivityGame } from "../../DB/Models/activity.model.js";
import { Child } from "../../DB/Models/child.model.js";
import { mapGame, normalizeGameId, getAgeRange } from "./activities.helpers.js";

const isChildRequest = (req) => req.userType === "child" || Boolean(req.user?.parentId);

export const getChildActivityGames = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const child = await Child.findById(req.user._id).select("age status points purchasedActivityGameIds");
    if (!child) return res.status(404).json({ message: "Child not found" });

    const ageRange = getAgeRange(child.age);
    const mode = child.status === "autistic" ? "autism" : "normal";
    
    console.log("👶 Child:", { age: child.age, ageRange, status: child.status, mode });

    // ✅ جلب الألعاب بناءً على السن والمود فقط
    const games = await ActivityGame.find({
      ageRange: ageRange,
      mode: { $in: [mode, "all"] }
    }).sort({ gameId: 1 });

    console.log("🎮 Raw games from DB:", games);

    const purchasedIds = new Set((child.purchasedActivityGameIds || []).map((id) => id.toLowerCase()));
    
    const result = games.map((game) => {
      const base = mapGame(game);
      const isPurchased = purchasedIds.has(game.gameId);
      
      // ✅ يمكن الشراء فقط إذا:
      // 1. اللعبة available = true
      // 2. ما اتشترت بالفعل
      // 3. عند الطفل نقاط كافية
      const canPurchase = game.available && !isPurchased && child.points >= game.cost;
      const pointsNeeded = Math.max(0, game.cost - child.points);

      return {
        ...base,
        available: game.available,  // ✅ القيمة الحقيقية
        isPurchased,
        canPurchase,
        pointsNeeded,
      };
    });

    console.log("✅ Final result:", result);

    return res.status(200).json({
      message: "Child activity games fetched successfully",
      childPoints: child.points,
      childAge: child.age,
      childMode: mode,
      count: result.length,
      games: result,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to fetch child activity games",
      error: error.message,
    });
  }
};

export const purchaseActivityGame = async (req, res) => {
  try {
    if (!isChildRequest(req)) {
      return res.status(403).json({ message: "Only children can access this endpoint" });
    }

    const gameId = normalizeGameId(req.params.gameId);
    if (!gameId) return res.status(400).json({ message: "gameId is required" });

    const game = await ActivityGame.findOne({ gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (!game.available) {
      return res.status(400).json({ message: "Game is currently not available for purchase" });
    }

    const child = await Child.findById(req.user._id).select("points purchasedActivityGameIds");
    if (!child) return res.status(404).json({ message: "Child not found" });

    const purchasedIds = (child.purchasedActivityGameIds || []).map((id) => id.toLowerCase());
    if (purchasedIds.includes(gameId)) {
      return res.status(200).json({
        message: "Game already purchased",
        alreadyPurchased: true,
        game: {
          ...mapGame(game),
          available: true,
        },
        childPoints: child.points,
      });
    }

    if (child.points < game.cost) {
      return res.status(400).json({
        message: "Not enough points to purchase this game",
        childPoints: child.points,
        requiredPoints: game.cost,
      });
    }

    const updatedChild = await Child.findOneAndUpdate(
      {
        _id: child._id,
        points: { $gte: game.cost },
        purchasedActivityGameIds: { $ne: gameId },
      },
      {
        $inc: { points: -game.cost },
        $addToSet: { purchasedActivityGameIds: gameId },
      },
      { new: true }
    );

    if (!updatedChild) {
      return res.status(409).json({
        message: "Purchase could not be completed, please retry",
      });
    }

    return res.status(200).json({
      message: "Game purchased successfully",
      game: {
        ...mapGame(game),
        available: true,
      },
      deductedPoints: game.cost,
      childPoints: updatedChild.points,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to purchase activity game",
      error: error.message,
    });
  }
};