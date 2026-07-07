const fs = require("fs");
const path = require("path");

const RECIPE_DIR = path.join(__dirname, "..", "behavior_packs", "Essentials BP", "recipes", "ulkd");
const TARGET_VERSION = "1.21.110";

function normalizeDescriptor(value) {
  if (typeof value === "string") {
    return { item: value };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  return value;
}

function normalizeUnlock(unlock) {
  if (!unlock) return unlock;
  if (Array.isArray(unlock)) {
    return unlock.map((entry) => normalizeDescriptor(entry));
  }
  return [normalizeDescriptor(unlock)];
}

function normalizeResult(result) {
  if (Array.isArray(result)) {
    const normalized = result.map((entry) => normalizeDescriptor(entry));
    return normalized.length === 1 ? normalized[0] : normalized;
  }
  if (typeof result === "string") {
    return { item: result };
  }
  return normalizeDescriptor(result);
}

function normalizeKey(key) {
  if (!key || typeof key !== "object") return key;
  const out = {};
  for (const [symbol, value] of Object.entries(key)) {
    out[symbol] = normalizeDescriptor(value);
  }
  return out;
}

function normalizeIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return ingredients;
  return ingredients.map((entry) => normalizeDescriptor(entry));
}

function collectIngredientItems(recipe, type) {
  const items = [];
  if (type === "shaped" && recipe.key) {
    for (const value of Object.values(recipe.key)) {
      if (value?.item) items.push(value.item);
    }
  } else if (type === "shapeless" && recipe.ingredients) {
    for (const value of recipe.ingredients) {
      if (value?.item) items.push(value.item);
    }
  } else if (type === "furnace") {
    const input = normalizeDescriptor(recipe.input);
    if (input?.item) items.push(input.item);
  }
  return items;
}

function buildUnlock(recipe, type) {
  const items = collectIngredientItems(recipe, type);
  const unlockItem = items.find((item) => item.startsWith("minecraft:")) || items[0];
  if (unlockItem) {
    return [{ item: unlockItem }];
  }
  return [{ context: "AlwaysUnlocked" }];
}

function needsUnlockFix(unlock) {
  if (!unlock) return true;
  const entries = Array.isArray(unlock) ? unlock : [unlock];
  if (!entries.length) return true;
  return entries.every((entry) => entry?.context === "AlwaysUnlocked" && !entry?.item);
}

function migrateRecipe(data) {
  data.format_version = TARGET_VERSION;

  const shaped = data["minecraft:recipe_shaped"];
  if (shaped) {
    if (shaped.key) shaped.key = normalizeKey(shaped.key);
    if (shaped.result !== undefined) shaped.result = normalizeResult(shaped.result);
    if (needsUnlockFix(shaped.unlock)) shaped.unlock = buildUnlock(shaped, "shaped");
    else if (shaped.unlock) shaped.unlock = normalizeUnlock(shaped.unlock);
    return data;
  }

  const shapeless = data["minecraft:recipe_shapeless"];
  if (shapeless) {
    if (shapeless.ingredients) shapeless.ingredients = normalizeIngredients(shapeless.ingredients);
    if (shapeless.result !== undefined) shapeless.result = normalizeResult(shapeless.result);
    if (needsUnlockFix(shapeless.unlock)) shapeless.unlock = buildUnlock(shapeless, "shapeless");
    else if (shapeless.unlock) shapeless.unlock = normalizeUnlock(shapeless.unlock);
    return data;
  }

  const furnace = data["minecraft:recipe_furnace"];
  if (furnace) {
    if (typeof furnace.input === "string") furnace.input = normalizeDescriptor(furnace.input);
    if (furnace.output) furnace.output = normalizeDescriptor(furnace.output);
    if (needsUnlockFix(furnace.unlock)) furnace.unlock = buildUnlock(furnace, "furnace");
    else if (furnace.unlock) furnace.unlock = normalizeUnlock(furnace.unlock);
    return data;
  }

  return data;
}

function main() {
  const files = fs.readdirSync(RECIPE_DIR).filter((name) => name.endsWith(".json"));
  let updated = 0;
  let addedUnlock = 0;
  let replacedAlwaysUnlocked = 0;

  for (const file of files) {
    const fullPath = path.join(RECIPE_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "").trimStart();
    const before = JSON.parse(raw);
    const recipe =
      before["minecraft:recipe_shaped"] ||
      before["minecraft:recipe_shapeless"] ||
      before["minecraft:recipe_furnace"];
    const hadUnlock = !!recipe?.unlock;
    const hadAlways = needsUnlockFix(recipe?.unlock) && hadUnlock;

    const migrated = migrateRecipe(before);
    const output = `${JSON.stringify(migrated, null, 2)}\n`;
    fs.writeFileSync(fullPath, output, "utf8");
    updated += 1;
    if (!hadUnlock) addedUnlock += 1;
    else if (hadAlways) replacedAlwaysUnlocked += 1;
  }

  console.log(`Updated ${updated}/${files.length} recipe files to format_version ${TARGET_VERSION}`);
  console.log(`  Added unlock: ${addedUnlock}`);
  console.log(`  Replaced AlwaysUnlocked-only unlock: ${replacedAlwaysUnlocked}`);
}

main();
