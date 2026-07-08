import { world } from "@minecraft/server";

export const OPERATOR_ROLE_TAG = "rank:operator";
export const OPERATOR_NAMES = ["D3X3365"];
const OPERATOR_NAMES_LOWER = OPERATOR_NAMES.map((name) => name.toLowerCase());

const RANKS = [
  { id: "operator", tag: OPERATOR_ROLE_TAG, label: "OPERATOR", color: "§b" },
  { id: "owner", tag: "rank:owner", label: "OWNER", color: "§6" },
  { id: "coowner", tag: "rank:coowner", label: "CO-OWNER", color: "§e" },
  { id: "admin", tag: "rank:admin", label: "ADMIN", color: "§c" },
  { id: "mod", tag: "rank:mod", label: "MOD", color: "§5" },
  { id: "member", tag: "rank:member", label: "MEMBER", color: "§7" }
];

export { RANKS as BUILTIN_RANKS };

/** Permission toggles shown in Admin → Roles → Edit Permissions */
export const ROLE_PERMISSION_DEFS = [
  { key: "openAdminPanel", label: "Open Admin Panel" },
  { key: "manageRoles", label: "Manage & Assign Roles" },
  { key: "invsee", label: "View Inventory / Ender Chest" },
  { key: "manageShops", label: "Manage Server Shops" },
  { key: "can_mute", label: "Mute Players" },
  { key: "can_freeze", label: "Freeze Players" },
  { key: "can_warn", label: "Warn Players" },
  { key: "managePunishments", label: "Punishment Menu (Mute/Freeze)" },
  { key: "can_kick", label: "Kick Players" },
  { key: "can_ban", label: "Ban Players" },
  { key: "can_vanish", label: "Vanish Mode" },
  { key: "testerHub", label: "Tester Hub" },
];

export const UTILITY_ROLE_TAGS = [
  { id: "tester", tag: "tester", label: "§6Tester" },
  { id: "world_builder", tag: "world_builder", label: "§bWorld Builder" },
  { id: "infested", tag: "rank:infested", label: "§2Infested" },
];

export const PROTECTED_ROLE_IDS = new Set(["coowner", "infested"]);
const STAFF_RANK_TAGS = [
  "rank:owner",
  "rank:coowner",
  "rank:admin",
  "rank:mod",
];

const MOD_DEFAULT_PERMS = {
  invsee: true,
  can_mute: true,
  can_freeze: true,
  can_warn: true,
  openAdminPanel: true,
};

let cachedFactionsRaw = undefined;
let cachedFactions = [];


function getFactions() {
  const raw = world.getDynamicProperty("factions") || "[]";

  if (raw !== cachedFactionsRaw) {
    cachedFactionsRaw = raw;

    try {
      cachedFactions = JSON.parse(raw);
      if (!Array.isArray(cachedFactions)) cachedFactions = [];
    } catch (e) {
      cachedFactions = [];
    }
  }

  return cachedFactions;
}

let cachedCustomRolesRaw = undefined;
let cachedCustomRoles = [];

function persistCustomRoles(roles) {
  world.setDynamicProperty("custom_roles", JSON.stringify(roles));
  invalidateCustomRolesCache();
}

function ensureDefaultCustomRoles(roles) {
  let changed = false;

  if (!roles.find((r) => r.id === "coowner")) {
    roles.push({
      id: "coowner",
      tag: "rank:coowner",
      label: "§dCo-Owner",
      permissions: {
        openAdminPanel: true,
        invsee: true,
        manageRoles: true,
        manageShops: true,
        can_mute: true,
        can_freeze: true,
        managePunishments: true,
        can_kick: true,
        can_ban: true,
        can_warn: true,
        can_vanish: true,
        testerHub: true,
      },
    });
    changed = true;
  }

  if (!roles.find((r) => r.id === "infested")) {
    roles.push({
      id: "infested",
      tag: "rank:infested",
      label: "§2Infested",
      permissions: {},
    });
    changed = true;
  }

  if (changed) persistCustomRoles(roles);

  return roles;
}

function getCustomRoles() {
  const raw = world.getDynamicProperty("custom_roles") || "[]";

  if (raw !== cachedCustomRolesRaw) {
    cachedCustomRolesRaw = raw;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        cachedCustomRoles = [];
      } else {
        cachedCustomRoles = parsed
          .map(r => ({
            id: String(r.id || "").trim(),
            tag: String(r.tag || `rank:${r.id || ""}`).trim(),
            label: String(r.label || r.id || "").trim(),
            color: String(r.color || "§7").trim(),
            permissions: r.permissions || {}
          }))
          .filter(x => x.id);
      }
    } catch (e) {
      cachedCustomRoles = [];
    }
  }

  return ensureDefaultCustomRoles(cachedCustomRoles);
}

export { getCustomRoles };

export const ALL_RANK_TAGS = [
  OPERATOR_ROLE_TAG,
  "rank:owner",
  "rank:coowner",
  "rank:admin",
  "rank:mod",
  "rank:member"
];

export function invalidateCustomRolesCache() {
  cachedCustomRolesRaw = undefined;
}

export function getAllRankTags() {
  const built = ALL_RANK_TAGS.slice();
  const customs = getCustomRoles().map(r => r.tag || `rank:${r.id}`);
  return Array.from(new Set(built.concat(customs)));
}

export function isOperatorName(playerOrName) {
  const name = typeof playerOrName === "string" ? playerOrName : playerOrName?.name;
  return OPERATOR_NAMES_LOWER.includes(String(name || "").trim().toLowerCase());
}

export function isOperatorPlayer(player) {
  return !!player && isOperatorName(player);
}

export function syncProtectedRoleTags(player) {
  if (!player) return false;

  let changed = false;
  try {
    if (isOperatorPlayer(player)) {
      for (const tag of ["rank:owner", "rank:coowner", "rank:admin", "rank:mod", "admin"]) {
        if (player.hasTag(tag)) {
          player.removeTag(tag);
          changed = true;
        }
      }
      if (!player.hasTag(OPERATOR_ROLE_TAG)) {
        player.addTag(OPERATOR_ROLE_TAG);
        changed = true;
      }
      if (!player.hasTag("staff")) {
        player.addTag("staff");
        changed = true;
      }
      return changed;
    }

    if (player.hasTag(OPERATOR_ROLE_TAG)) {
      player.removeTag(OPERATOR_ROLE_TAG);
      changed = true;
    }

    const shouldBeStaff = player.hasTag("staff") || STAFF_RANK_TAGS.some((tag) => player.hasTag(tag));
    if (shouldBeStaff && !player.hasTag("staff")) {
      player.addTag("staff");
      changed = true;
    }
  } catch (e) {}

  return changed;
}

export function hasPermission(player, permKey) {
  syncProtectedRoleTags(player);

  if (isOperatorPlayer(player)) {
    return true;
  }

  if (player.hasTag("staff") && permKey !== "manageRoles") {
    return true;
  }

  if (player.hasTag("rank:mod") && MOD_DEFAULT_PERMS[permKey]) {
    return true;
  }

  const customs = getCustomRoles();

  for (const cr of customs) {
    const tag = cr.tag || `rank:${cr.id}`;

    if (player.hasTag(tag) && cr.permissions && cr.permissions[permKey]) {
      return true;
    }
  }

  return false;
}

const RAIN_GUI_DISABLED_KEY = "rain_gui_disabled";
const LEGACY_RAIN_GUI_BLOCK_TAGS = [
  "blockraingui",
  "block_rain_gui",
  "rain_gui_blocked",
  "no_rain_gui",
];

function clearLegacyRainGuiBlockTags(player) {
  for (const tag of LEGACY_RAIN_GUI_BLOCK_TAGS) {
    if (!player.hasTag(tag)) continue;
    try {
      player.removeTag(tag);
    } catch (e) {}
  }
}

export function setRainGuiDisabled(player, disabled) {
  if (!player) return false;
  clearLegacyRainGuiBlockTags(player);
  player.setDynamicProperty(RAIN_GUI_DISABLED_KEY, disabled ? true : undefined);
  return disabled === true;
}

export function isRainGuiBlocked(player) {
  if (!player) return false;
  if (isStaffPlayer(player)) return false;
  return player.getDynamicProperty(RAIN_GUI_DISABLED_KEY) === true;
}

export function syncRainGuiBlockState(player) {
  if (!player) return false;
  clearLegacyRainGuiBlockTags(player);
  return isRainGuiBlocked(player);
}

export function formatPlayerRoleSummary(player) {
  const rank = getRankMeta(player);
  const utilities = UTILITY_ROLE_TAGS
    .filter((entry) => player.hasTag(entry.tag))
    .map((entry) => entry.label.replace(/§./g, "").trim());

  let text =
    `§7Primary rank: ${rank.color}${rank.label}§r\n` +
    `§7Tag: §f${rank.tag}`;

  if (utilities.length) {
    text += `\n§7Extra tags: §f${utilities.join("§7, §f")}`;
  } else {
    text += `\n§7Extra tags: §8none`;
  }

  return text;
}

export function getRankMeta(player) {
  if (isOperatorPlayer(player)) {
    return RANKS[0];
  }

  for (const rank of RANKS) {
    if (rank.tag === OPERATOR_ROLE_TAG) continue;
    if (player.hasTag(rank.tag)) {
      return rank;
    }
  }

  const customs = getCustomRoles();

  for (const cr of customs) {
    const tag = cr.tag || `rank:${cr.id}`;

    if (player.hasTag(tag)) {
      return {
        id: cr.id,
        tag,
        label: String(cr.label || cr.id).toUpperCase(),
        color: cr.color || "§7"
      };
    }
  }

  return {
    id: "member",
    tag: "rank:member",
    label: "MEMBER",
    color: "§7"
  };
}

export function getFactionName(player) {
  const factionId = player.getDynamicProperty("faction");

  if (!factionId) return "";

  const factions = getFactions();
  const found = factions.find(f => f && f.id === factionId);

  return found?.name || "";
}

export function getFactionTag(player) {
  const factionId = player.getDynamicProperty("faction");

  if (!factionId) return "";

  const factions = getFactions();
  const found = factions.find(f => f && f.id === factionId);

  return found?.tag || "";
}

export function formatRankBadge(player) {
  const rank = getRankMeta(player);
  return `§8§l[§r${rank.color}§l${rank.label}§8§l]§r`;
}

export function formatFactionBadge(player) {
  const facTag = getFactionTag(player);

  if (facTag) {
    return ` §8§l[§r§e${facTag}§8§l]§r`;
  }

  const facName = getFactionName(player);

  if (!facName) return "";

  return ` §8§l[§r§b${facName}§8§l]§r`;
}

export function formatDisplayName(player) {
  const rank = getRankMeta(player);
  return `${formatRankBadge(player)}${formatFactionBadge(player)} ${rank.color}${player.name}§r`;
}

export function formatChatLine(player, message) {
  return `${formatDisplayName(player)} §r§l§8»§r §7${message}`;
}

export function formatNameTag(player) {
  return formatDisplayName(player);
}

/**
 * Returns true for the hardcoded operator, a primary staff rank, or the flat staff tag.
 * @param {import('@minecraft/server').Player} player
 */
export function isStaffPlayer(player) {
  if (!player) return false;
  syncProtectedRoleTags(player);
  return isOperatorPlayer(player) || player.hasTag("staff") || STAFF_RANK_TAGS.some((tag) => player.hasTag(tag));
}

/**
 * Ensures ranked staff have the flat "staff" tag without removing manually tagged staff.
 * Called on player spawn/respawn so the tag stays in sync.
 * @param {import('@minecraft/server').Player} player
 */
export function syncStaffTagsOnJoin(player) {
  if (!player) return;
  syncProtectedRoleTags(player);
  const shouldBeStaff =
    isOperatorPlayer(player) ||
    player.hasTag("staff") ||
    STAFF_RANK_TAGS.some((tag) => player.hasTag(tag));
  try {
    if (shouldBeStaff && !player.hasTag("staff")) player.addTag("staff");
  } catch (e) {}
}
