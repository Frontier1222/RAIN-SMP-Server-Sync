import { world } from "@minecraft/server";

// ==========================================
// CHUNKED SHOP STORAGE
// Fixes dynamic property string limit errors
// ==========================================

const OLD_KEY = "shops";
const CHUNK_COUNT_KEY = "shops_chunk_count";
const CHUNK_KEY_PREFIX = "shops_chunk_";

// Keep below Bedrock dynamic property string max.
const MAX_CHUNK_SIZE = 30000;

let cachedRaw = null;
let cachedShops = null;
let shopContentSynced = false;

/** Shop UI icons for Event Shop randomized reward loot bags (matches item BP icons). */
export const EVENT_LOOT_BAG_ICONS = {
  "viberater:loot_random_skull": "textures/items/lootbag_bat_item_texture",
  "viberater:loot_music_disc": "textures/items/lootbag_darkosto_item_texture",
  "viberater:loot_common_trim": "textures/items/lootbag_common_item_texture",
  "viberater:loot_rare_trim": "textures/items/lootbag_rare_item_texture",
  "viberater:loot_random_dyes": "textures/items/lootbag_bacon_item_texture",
  "viberater:loot_random_flowers": "textures/items/lootbag_waffle_item_texture",
  "viberater:loot_random_wool": "textures/items/lootbag_texture_string",
  "viberater:loot_random_terracotta": "textures/items/lootbag_worn_out_item_texture",
  "viberater:loot_random_concrete": "textures/items/lootbag_texture_base",
  "viberater:loot_hmob_egg": "textures/items/lootbag_legendary_item_texture"
};

function applyShopContentSync(shops) {
  let changed = false;

  for (const shop of shops) {
    for (const item of shop.items || []) {
      const typeId = item.sell?.typeId;

      if (shop.name === "Event Shop") {
        const icon = EVENT_LOOT_BAG_ICONS[typeId];
        if (icon && item.icon !== icon) {
          item.icon = icon;
          changed = true;
        }
      }

      if (shop.name === "End Shop" && typeId === "minecraft:dragon_egg") {
        const payments = [...(Array.isArray(item.wants) ? item.wants : []), item.want].filter(Boolean);
        for (const payment of payments) {
          if (payment.amount !== 100) {
            payment.amount = 100;
            changed = true;
          }
        }
        const lore = ["§7Unique luxury item", "§8Price: 100 Rain SMP Coins"];
        if (JSON.stringify(item.sell.lore || []) !== JSON.stringify(lore)) {
          item.sell.lore = lore;
          changed = true;
        }
      }

      if (shop.name === "Banker") {
        const rawType = typeId === "minecraft:iron_ingot"
          ? "minecraft:raw_iron"
          : typeId === "minecraft:gold_ingot"
            ? "minecraft:raw_gold"
            : null;
        if (rawType) {
          item.sell.typeId = rawType;
          item.icon = rawType === "minecraft:raw_iron" ? "textures/items/raw_iron" : "textures/items/raw_gold";
          item.customName = rawType === "minecraft:raw_iron"
            ? "Sell Common Coin For Raw Iron"
            : "Sell Uncommon Coin For Raw Gold";
          changed = true;
        }

        const payments = [...(Array.isArray(item.wants) ? item.wants : []), item.want].filter(Boolean);
        for (const payment of payments) {
          if (payment.typeId === "minecraft:iron_ingot") {
            payment.typeId = "minecraft:raw_iron";
            payment.icon = "textures/items/raw_iron";
            changed = true;
          } else if (payment.typeId === "minecraft:gold_ingot") {
            payment.typeId = "minecraft:raw_gold";
            payment.icon = "textures/items/raw_gold";
            changed = true;
          }
        }
      }

      if (shop.name === "Stone Shop" && typeId === "minecraft:prismarine") {
        const icon = "textures/items/ocean_prismarine_bricks";
        if (item.icon !== icon) {
          item.icon = icon;
          changed = true;
        }
      }
    }
  }

  return changed;
}

function getChunkKey(index) {
  return `${CHUNK_KEY_PREFIX}${index}`;
}

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(s => ({
      ...s,
      items: Array.isArray(s.items) ? s.items : []
    }));
  } catch (err) {
    return [];
  }
}

function readChunkedRaw() {
  const count = Number(world.getDynamicProperty(CHUNK_COUNT_KEY) || 0);

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  let raw = "";

  for (let i = 0; i < count; i++) {
    const part = world.getDynamicProperty(getChunkKey(i));

    if (typeof part !== "string") {
      return null;
    }

    raw += part;
  }

  return raw;
}

function readLegacyShopRaw() {
  const oldRaw = world.getDynamicProperty(OLD_KEY);
  return typeof oldRaw === "string" && oldRaw.length > 0 ? oldRaw : null;
}

function saveShops(shops) {
  const safeShops = Array.isArray(shops) ? shops : [];
  const raw = JSON.stringify(safeShops);

  const oldCount = Number(world.getDynamicProperty(CHUNK_COUNT_KEY) || 0);
  const chunks = [];

  for (let i = 0; i < raw.length; i += MAX_CHUNK_SIZE) {
    chunks.push(raw.slice(i, i + MAX_CHUNK_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    world.setDynamicProperty(getChunkKey(i), chunks[i]);
  }

  if (oldCount > chunks.length) {
    for (let i = chunks.length; i < oldCount; i++) {
      try {
        world.setDynamicProperty(getChunkKey(i), undefined);
      } catch (e) {}
    }
  }

  world.setDynamicProperty(CHUNK_COUNT_KEY, chunks.length);

  // Stop using the old single big property.
  try {
    world.setDynamicProperty(OLD_KEY, undefined);
  } catch (e) {}

  cachedRaw = raw;
  cachedShops = safeShops;
}

function readShops() {
  let raw = readChunkedRaw();

  // First-time migration from old single "shops" property.
  if (raw === null) {
    const oldRaw = world.getDynamicProperty(OLD_KEY);

    if (typeof oldRaw === "string" && oldRaw.length > 0) {
      const migrated = safeParse(oldRaw);
      saveShops(migrated);

      if (!shopContentSynced) {
        shopContentSynced = true;

        if (applyShopContentSync(migrated)) {
          saveShops(migrated);
        }
      }

      return migrated;
    }

    raw = "[]";
  }

  if (raw === cachedRaw && cachedShops) {
    return cachedShops;
  }

  const parsed = safeParse(raw);

  if (!shopContentSynced) {
    shopContentSynced = true;

    if (applyShopContentSync(parsed)) {
      saveShops(parsed);
      return parsed;
    }
  }

  cachedRaw = raw;
  cachedShops = parsed;

  return parsed;
}

export function listShops() {
  return readShops();
}

export function getShopById(id) {
  if (!id) return null;

  return readShops().find(s => String(s.id) === String(id)) || null;
}

export function getShopByNpc(npcId) {
  if (!npcId) return null;

  const shops = readShops();
  return shops.find(s => s.npc && String(s.npc) === String(npcId)) || null;
}

export function addShop(shop) {
  const shops = readShops();

  shops.push({
    id: String(shop.id || Date.now()),
    name: String(shop.name || "New Shop"),
    npc: shop.npc ?? null,
    items: Array.isArray(shop.items) ? shop.items : [],
    useTabs: shop.useTabs !== false
  });

  saveShops(shops);
  return true;
}

export function updateShop(updated) {
  const shops = readShops();
  const idx = shops.findIndex(s => String(s.id) === String(updated.id));

  if (idx === -1) {
    return { ok: false, reason: "not_found" };
  }

  shops[idx] = {
    ...shops[idx],
    ...updated,
    items: Array.isArray(updated.items) ? updated.items : shops[idx].items
  };

  saveShops(shops);

  return { ok: true };
}

/** Payment list for a shop trade (supports legacy single `want` or `wants[]`). */
export function getShopWants(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.wants) && entry.wants.length) {
    return entry.wants.filter((w) => w?.typeId);
  }
  if (entry.want?.typeId) return [entry.want];
  return [];
}

export function addShopItem(shopId, itemData) {
  const shops = readShops();
  const shop = shops.find(s => String(s.id) === String(shopId));

  if (!shop) {
    return { ok: false, reason: "shop_not_found" };
  }

  const id = itemData.id || `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const wants = getShopWants(itemData);

  const entry = {
    id,
    sell: itemData.sell || null,
    want: wants[0] || null,
    wants: wants.length > 1 ? wants : undefined,
    category: itemData.category || "Misc Items",
    icon: itemData.icon || "",
    customName: itemData.customName || ""
  };

  shop.items = Array.isArray(shop.items) ? shop.items : [];
  shop.items.push(entry);

  saveShops(shops);

  return { ok: true, item: entry };
}

export function removeShopItem(shopId, itemId) {
  const shops = readShops();
  const shop = shops.find(s => String(s.id) === String(shopId));

  if (!shop) {
    return { ok: false, reason: "shop_not_found" };
  }

  shop.items = Array.isArray(shop.items) ? shop.items : [];

  const idx = shop.items.findIndex(i => String(i.id) === String(itemId));

  if (idx === -1) {
    return { ok: false, reason: "item_not_found" };
  }

  const [removed] = shop.items.splice(idx, 1);

  saveShops(shops);

  return { ok: true, removed };
}

export function setShopNpc(shopId, npcId) {
  const shops = readShops();
  const shop = shops.find(s => String(s.id) === String(shopId));

  if (!shop) {
    return { ok: false, reason: "shop_not_found" };
  }

  shop.npc = npcId || null;

  saveShops(shops);

  return { ok: true };
}

export function removeShop(shopId) {
  const shops = readShops();
  const idx = shops.findIndex(s => String(s.id) === String(shopId));

  if (idx === -1) {
    return { ok: false, reason: "not_found" };
  }

  const [removed] = shops.splice(idx, 1);

  saveShops(shops);

  return { ok: true, removed };
}
