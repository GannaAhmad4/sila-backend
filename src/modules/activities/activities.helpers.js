export const normalizeGameId = (value) => value?.toString?.()?.trim?.()?.toLowerCase?.() || "";

// ✅ تحديث: الرينج الجديد
export const getAgeRange = (age) => {
  const num = Number(age);
  if (num <= 7) return "5-7";   // ✅ 5, 6, 7
  return "8+";                  // ✅ 8+
};

export const mapGame = (game) => ({
  id: game.gameId,
  title: game.title,
  description: game.description,
  cost: game.cost,
  iframeSrc: game.iframeSrc,
  available: game.available,
  mode: game.mode || "all",
  ageRange: game.ageRange || "5-7",
  emoji: game.emoji || "🎮",
  color: game.color || "#B5EAD7",
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
});