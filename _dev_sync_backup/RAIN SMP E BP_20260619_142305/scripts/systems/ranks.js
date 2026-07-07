import { world } from "@minecraft/server";
import { isVanished, VANISH_HIDDEN_NAMETAG } from "../utils/vanish.js";

const RANKS = [
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
  { key: "creativeBuilderHub", label: "Creative Builder Hub" },
  { key: "testerHub", label: "Tester Hub" },
  { key: "blockRainGui", label: "Block Rain GUI Access" },
];

export const UTILITY_ROLE_TAGS = [
  { id: "staff", tag: "staff", label: "§cStaff" },
  { id: "creative_builder", tag: "creative_builder", label: "§dCreative Builder" },
  { id: "tester", tag: "tester", label: "§6Tester" },
  { id: "world_builder", tag: "world_builder", label: "§bWorld Builder" },
  { id: "infested", tag: "rank:infested", label: "§2Infested" },
];

export const PROTECTED_ROLE_IDS = new Set(["coowner", "infested"]);

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
        creativeBuilderHub: true,
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

export function hasPermission(player, permKey) {
  if (
    player.hasTag("admin") ||
    player.hasTag("staff") ||
    player.hasTag("rank:owner") ||
    player.hasTag("rank:coowner") ||
    player.hasTag("rank:admin")
  ) {
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

/** Role permission or tag — blocks opening / receiving the Rain GUI (not overridden by staff auto-perms). */
export function isRainGuiBlocked(player) {
  if (!player) return false;
  if (player.hasTag("block_rain_gui")) return true;

  for (const cr of getCustomRoles()) {
    const tag = cr.tag || `rank:${cr.id}`;
    if (player.hasTag(tag) && cr.permissions?.blockRainGui === true) {
      return true;
    }
  }

  if (player.hasTag("rank:mod") || player.hasTag("rank:admin") || player.hasTag("rank:owner") || player.hasTag("rank:coowner")) {
    return false;
  }

  return false;
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
  for (const rank of RANKS) {
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
  if (isVanished(player)) return '';
  const msg = String(message ?? "");
  const body = msg.includes("§") ? msg : `§f${msg}`;
  return `${formatDisplayName(player)} §r§l§8»§r ${body}`;
}

export function formatNameTag(player) {
  if (isVanished(player)) return VANISH_HIDDEN_NAMETAG;
  return formatDisplayName(player);
}