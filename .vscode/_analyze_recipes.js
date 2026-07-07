const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "behavior_packs", "Essentials BP", "recipes", "ulkd");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

let stats = {
  total: files.length,
  leadingBlank: 0,
  unlockObject: 0,
  singleResultArray: 0,
  multiResult: 0,
  format1910: 0,
};

for (const file of files) {
  const full = path.join(dir, file);
  const raw = fs.readFileSync(full, "utf8");
  if (/^\uFEFF?\s*\n/.test(raw)) stats.leadingBlank++;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.log("PARSE FAIL", file, e.message);
    continue;
  }
  if (data.format_version === "1.19.10") stats.format1910++;
  const recipe = data["minecraft:recipe_shaped"] || data["minecraft:recipe_shapeless"] || data["minecraft:recipe_furnace"];
  if (!recipe) continue;
  if (recipe.unlock && !Array.isArray(recipe.unlock)) stats.unlockObject++;
  if (Array.isArray(recipe.result)) {
    if (recipe.result.length === 1) stats.singleResultArray++;
    else stats.multiResult++;
  }
}

console.log(stats);
