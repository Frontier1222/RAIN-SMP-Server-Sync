import { ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { MinecraftBlockTypes, MinecraftItemTypes } from "../../../utils/data/vanilla.js";
// ChestFormData no longer needed here

const blockTypeIds = new Set(Object.values(MinecraftBlockTypes));
const allItemTypeIds = Object.values(MinecraftItemTypes);

const excludedExactTypeIds = new Set([
  "minecraft:air",
  "minecraft:chipped_anvil",
  "minecraft:damaged_anvil",
]);

function isExcludedTypeId(typeId) {
  if (excludedExactTypeIds.has(typeId)) return true;

  const key = typeId.split(":")[1] ?? typeId;

  if (key.endsWith("_spawn_egg")) return true;
  if (key.includes("music_disc") || key.startsWith("record_")) return true;
  if (key.includes("skull") || key.endsWith("_head")) return true;

  return false;
}

const equipmentKeywords = [
  "sword",
  "pickaxe",
  "axe",
  "shovel",
  "hoe",
  "helmet",
  "chestplate",
  "leggings",
  "boots",
  "elytra",
  "shield",
  "bow",
  "crossbow",
  "trident",
  "mace",
  "fishing_rod",
  "flint_and_steel",
  "shears",
  "brush",
  "spyglass",
  "clock",
  "compass",
  "totem",
  "turtle_helmet",
  "carrot_on_a_stick",
  "warped_fungus_on_a_stick",
  "saddle",
  "horse_armor",
];

const constructionBlockKeywords = [
  "planks",
  "slab",
  "stairs",
  "door",
  "trapdoor",
  "fence",
  "fence_gate",
  "wall",
  "glass",
  "pane",
  "concrete",
  "terracotta",
  "wool",
  "carpet",
  "bricks",
  "brick",
  "tiles",
  "polished",
  "chiseled",
  "cut_",
  "smooth_",
  "mosaic",
  "pillar",
  "prismarine",
  "purpur",
  "quartz",
  "packed_mud",
  "mud_bricks",
  "glazed_terracotta",
  "stained_glass",
  "stained_glass_pane",
];

const natureKeywords = [
  "sapling",
  "leaves",
  "log",
  "wood",
  "mangrove_roots",
  "mushroom",
  "fungus",
  "root",
  "roots",
  "vine",
  "bamboo",
  "cactus",
  "sugar_cane",
  "kelp",
  "seagrass",
  "coral",
  "flower",
  "azalea",
  "grass",
  "fern",
  "dirt",
  "podzol",
  "mycelium",
  "moss",
  "mud",
  "sand",
  "gravel",
  "clay",
  "stone",
  "deepslate",
  "andesite",
  "diorite",
  "granite",
  "tuff",
  "calcite",
  "ore",
  "netherrack",
  "basalt",
  "blackstone",
  "end_stone",
  "ice",
  "snow",
  "pumpkin",
  "melon",
  "wheat",
  "beetroot",
  "carrot",
  "potato",
  "seeds",
  "cocoa",
  "nether_wart",
  "chorus",
  "lily_pad",
  "tallgrass",
  "double_plant",
  "deadbush",
  "sea_pickle",
  "sweet_berries",
  "glow_berries",
  "honeycomb",
  "honey_bottle",
];

function containsKeyword(typeId, keywords) {
  const key = typeId.split(":")[1] ?? typeId;
  for (const word of keywords) {
    if (key.includes(word)) return true;
  }
  return false;
}

function categoryForTypeId(typeId) {
  if (containsKeyword(typeId, equipmentKeywords)) return "equipment";

  const isBlock = blockTypeIds.has(typeId);
  if (isBlock) {
    if (containsKeyword(typeId, constructionBlockKeywords)) return "construction";
    return "nature";
  }

  if (containsKeyword(typeId, natureKeywords)) return "nature";
  return "items";
}

function sortKey(typeId) {
  const key = typeId.split(":")[1] ?? typeId;
  return key.replace(/_/g, " ");
}

const familySuffixOrder = [
  "planks",
  "log",
  "wood",
  "stripped_log",
  "stripped_wood",
  "leaves",
  "sapling",
  "slab",
  "stairs",
  "wall",
  "fence",
  "fence_gate",
  "door",
  "trapdoor",
  "button",
  "pressure_plate",
  "sign",
  "hanging_sign",
  "wool",
  "carpet",
  "concrete",
  "concrete_powder",
  "terracotta",
  "glazed_terracotta",
  "glass",
  "pane",
  "stained_glass",
  "stained_glass_pane",
  "bricks",
  "brick",
];

const familySuffixMatch = [...familySuffixOrder]
  .sort((a, b) => b.length - a.length);

function extractFamilyParts(typeId) {
  const key = typeId.split(":")[1] ?? typeId;

  for (const suffix of familySuffixMatch) {
    if (key === suffix) return { family: suffix, base: "" };
    if (key.endsWith(`_${suffix}`)) {
      return { family: suffix, base: key.slice(0, -1 * (suffix.length + 1)) };
    }
  }

  const parts = key.split("_");
  if (parts.length >= 2) {
    return { family: parts[parts.length - 1], base: parts.slice(0, -1).join("_") };
  }

  return { family: "", base: key };
}

function familyRank(family) {
  const idx = familySuffixOrder.indexOf(family);
  return idx === -1 ? 999 : idx;
}

const categoryCache = (() => {
  const buckets = {
    construction: [],
    items: [],
    equipment: [],
    nature: [],
  };

  for (const typeId of allItemTypeIds) {
    if (isExcludedTypeId(typeId)) continue;
    const cat = categoryForTypeId(typeId);
    buckets[cat].push(typeId);
  }

  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => {
      const fa = extractFamilyParts(a);
      const fb = extractFamilyParts(b);

      const ra = familyRank(fa.family);
      const rb = familyRank(fb.family);
      if (ra !== rb) return ra - rb;

      if (fa.family !== fb.family) return fa.family.localeCompare(fb.family);
      if (fa.base !== fb.base) return fa.base.localeCompare(fb.base);
      return sortKey(a).localeCompare(sortKey(b));
    });
  }

  return buckets;
})();

async function pickCategory(player, title) {
  const form = new ActionFormData()
    .title(title)
    .body("Choose a category")
    .button("§6Construction")
    .button("§bItems")
    .button("§aEquipment")
    .button("§2Nature")
    .button("§7Back");

  const res = await form.show(player);
  if (res.canceled) return null;

  switch (res.selection) {
    case 0: return "construction";
    case 1: return "items";
    case 2: return "equipment";
    case 3: return "nature";
    default: return null;
  }
}

function itemButtonLabel(typeId) {
  const stack = new ItemStack(typeId, 1);
  if (stack.localizationKey) return { rawtext: [{ translate: stack.localizationKey }] };
  return typeId;
}

async function pickFromCategory(player, title, category) {
  const items = categoryCache[category] ?? [];
  if (items.length === 0) return null;

  const pageSize = 45;
  let page = 0;

  while (true) {
    const maxPage = Math.max(0, Math.ceil(items.length / pageSize) - 1);
    if (page > maxPage) page = maxPage;

    const start = page * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    const form = new ActionFormData()
      .title({ rawtext: [{ text: `bd.action:${category.charAt(0).toUpperCase() + category.slice(1)} (${page + 1}/${maxPage + 1})` }] });

    const buttons = [];
    pageItems.forEach(typeId => buttons.push(itemButtonLabel(typeId)));
    if (page > 0) buttons.push('§ePrev');
    buttons.push('§cBack');
    if (page < maxPage) buttons.push('§eNext');

    buttons.forEach(b => form.button(b));

    const res = await form.show(player);
    if (res.canceled) return null;

    const sel = res.selection;
    if (sel < 0) continue;
    if (sel < pageItems.length) {
      return new ItemStack(pageItems[sel], 1);
    }
    let idx = pageItems.length;
    if (page > 0) {
      if (sel === idx) {
        page--;
        continue;
      }
      idx++;
    }
    if (sel === idx) {
      return "__category_back__";
    }
    idx++;
    if (page < maxPage && sel === idx) {
      page++;
      continue;
    }
    // fallback
    continue;
  }
}

export async function pickVanillaItem(player, title) {
  while (true) {
    const category = await pickCategory(player, title);
    if (!category) return null;

    const res = await pickFromCategory(player, title, category);
    if (res === "__category_back__") continue;
    return res;
  }
}
