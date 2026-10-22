// activities.admin.controller.js
import { ActivityGame } from "../../DB/Models/activity.model.js";
import { mapGame, normalizeGameId } from "./activities.helpers.js";

const validateCreatePayload = (payload) => {
  if (!payload || typeof payload !== "object") return "Invalid payload";
  if (!normalizeGameId(payload.id || payload.gameId)) return "id is required";
  if (!payload.title) return "title is required";
  if (!Number.isFinite(Number(payload.cost)) || Number(payload.cost) < 0) return "cost must be >= 0";
  if (!payload.iframeSrc) return "iframeSrc is required";
  if (!["all", "normal", "autism"].includes(payload.mode)) return "mode must be: all, normal, or autism";
  // ✅ تحديث: الرينج الجديد
  if (!["5-7", "8+"].includes(payload.ageRange)) return "ageRange must be: 5-7 or 8+";
  return null;
};

const toGameDocumentInput = (payload) => ({
  gameId: normalizeGameId(payload.id || payload.gameId),
  title: payload.title?.toString?.()?.trim?.() || "",
  description: payload.description?.toString?.()?.trim?.() || "",
  cost: Number(payload.cost),
  iframeSrc: payload.iframeSrc?.toString?.()?.trim?.() || "",
  available: typeof payload.available === "boolean" ? payload.available : true,
  mode: payload.mode || "all",
  ageRange: payload.ageRange || "5-7",  // ✅ تحديث
  emoji: payload.emoji || "🎮",
  color: payload.color || "#B5EAD7",
});

export const createActivityGame = async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      if (!req.body.length) {
        return res.status(400).json({ message: "Body array cannot be empty" });
      }

      for (const item of req.body) {
        const error = validateCreatePayload(item);
        if (error) return res.status(400).json({ message: `Invalid item: ${error}` });
      }

      const operations = req.body.map((item) => {
        const input = toGameDocumentInput(item);
        return {
          updateOne: {
            filter: { gameId: input.gameId },
            update: { $set: input },
            upsert: true,
          },
        };
      });

      await ActivityGame.bulkWrite(operations);

      const ids = req.body.map((item) => normalizeGameId(item.id || item.gameId));
      const games = await ActivityGame.find({ gameId: { $in: ids } }).sort({ gameId: 1 });

      return res.status(201).json({
        message: "Activity games upserted successfully",
        count: games.length,
        games: games.map(mapGame),
      });
    }

    const error = validateCreatePayload(req.body);
    if (error) return res.status(400).json({ message: error });

    const input = toGameDocumentInput(req.body);
    const existing = await ActivityGame.findOne({ gameId: input.gameId });
    if (existing) {
      return res.status(409).json({ message: "Game id already exists" });
    }

    const game = await ActivityGame.create(input);

    return res.status(201).json({
      message: "Activity game created successfully",
      game: mapGame(game),
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to create activity game",
      error: error.message,
    });
  }
};

export const getAllActivityGames = async (req, res) => {
  try {
    const filter = {};
    if (typeof req.query.available !== "undefined") {
      filter.available = req.query.available === "true";
    }
    if (req.query.mode) filter.mode = req.query.mode;
    if (req.query.ageRange) filter.ageRange = req.query.ageRange;

    const games = await ActivityGame.find(filter).sort({ gameId: 1 });
    
    console.log("📊 Filter:", filter, "Found:", games.length);
    
    return res.status(200).json({
      message: "Activity games fetched successfully",
      count: games.length,
      games: games.map(mapGame),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch activity games",
      error: error.message,
    });
  }
};

export const getActivityGameById = async (req, res) => {
  try {
    const gameId = normalizeGameId(req.params.gameId);
    if (!gameId) return res.status(400).json({ message: "gameId is required" });

    const game = await ActivityGame.findOne({ gameId });
    if (!game) return res.status(404).json({ message: "Game not found" });

    return res.status(200).json({
      message: "Activity game fetched successfully",
      game: mapGame(game),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch activity game",
      error: error.message,
    });
  }
};

export const updateActivityGame = async (req, res) => {
  try {
    const gameId = normalizeGameId(req.params.gameId);
    if (!gameId) return res.status(400).json({ message: "gameId is required" });

    const update = {};
    if (typeof req.body.title !== "undefined") update.title = req.body.title?.toString?.()?.trim?.() || "";
    if (typeof req.body.description !== "undefined") {
      update.description = req.body.description?.toString?.()?.trim?.() || "";
    }
    if (typeof req.body.cost !== "undefined") {
      const cost = Number(req.body.cost);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({ message: "cost must be >= 0" });
      }
      update.cost = cost;
    }
    if (typeof req.body.iframeSrc !== "undefined") {
      update.iframeSrc = req.body.iframeSrc?.toString?.()?.trim?.() || "";
    }
    if (typeof req.body.available === "boolean") update.available = req.body.available;
    if (req.body.mode && ["all", "normal", "autism"].includes(req.body.mode)) {
      update.mode = req.body.mode;
    }
    // ✅ تحديث: الرينج الجديد
    if (req.body.ageRange && ["5-7", "8+"].includes(req.body.ageRange)) {
      update.ageRange = req.body.ageRange;
    }
    if (req.body.emoji) update.emoji = req.body.emoji;
    if (req.body.color) update.color = req.body.color;

    const game = await ActivityGame.findOneAndUpdate({ gameId }, update, {
      new: true,
      runValidators: true,
    });

    if (!game) return res.status(404).json({ message: "Game not found" });

    return res.status(200).json({
      message: "Activity game updated successfully",
      game: mapGame(game),
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to update activity game",
      error: error.message,
    });
  }
};

export const deleteActivityGame = async (req, res) => {
  try {
    const gameId = normalizeGameId(req.params.gameId);
    if (!gameId) return res.status(400).json({ message: "gameId is required" });

    const game = await ActivityGame.findOneAndDelete({ gameId });

    if (!game) return res.status(404).json({ message: "Game not found" });

    return res.status(200).json({
      message: "Activity game deleted successfully",
      game: mapGame(game),
    });
  } catch (error) {
    return res.status(400).json({
      message: "Failed to delete activity game",
      error: error.message,
    });
  }
};