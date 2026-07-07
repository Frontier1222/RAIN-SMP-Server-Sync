import { EVENT_LOOT_BAG_ICONS } from "./store.js";

const PAYMENT_ICON_OVERRIDES = {
  "viberater:rain_common_coin": "textures/items/rain_common_coin",
  "viberater:rain_uncommon_coin": "textures/items/rain_uncommon_coin",
  "viberater:rain_rare_coin": "textures/items/rain_rare_coin",
  "viberater:rain_coin": "textures/items/rain_coin",
  "viberater:rain_event_coin": "textures/items/rain_event_coin",
  "minecraft:iron_ingot": "textures/items/iron_ingot",
  "minecraft:gold_ingot": "textures/items/gold_ingot",
  "minecraft:emerald": "textures/items/emerald",
  "minecraft:diamond": "textures/items/diamond",
  "minecraft:diamond_block": "textures/items/diamond_block",
  "minecraft:netherite_ingot": "textures/items/netherite_ingot",
  "minecraft:wither_rose": "textures/items/wither_rose",
  ...EVENT_LOOT_BAG_ICONS
};

/** Resolve a form button icon path for a shop payment/sell item typeId. */
export function resolveShopItemIcon(typeId, fallbackIcon = "") {
  const id = String(typeId || "").trim();
  if (!id) return String(fallbackIcon || "").trim();

  if (PAYMENT_ICON_OVERRIDES[id]) {
    return PAYMENT_ICON_OVERRIDES[id];
  }

  if (fallbackIcon) return String(fallbackIcon).trim();

  const short = id.includes(":") ? id.split(":")[1] : id;
  return `textures/items/${short}`;
}

/** Sell-item icon only for form buttons (must be a single valid texture path). */
export function buildShopButtonTexture(sellIcon) {
  const raw = String(sellIcon || "").trim();
  if (!raw) return undefined;
  // Never pass combined paths — Bedrock crashes trying to load them.
  const sell = raw.includes("|") ? raw.split("|")[0].trim() : raw;
  return sell || undefined;
}
