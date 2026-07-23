import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { Command } from '../extensions/command.js';
import { hasPermission, BUILTIN_RANKS, ROLE_PERMISSION_DEFS, UTILITY_ROLE_TAGS, PROTECTED_ROLE_IDS, invalidateCustomRolesCache, formatPlayerRoleSummary, getCustomRoles, getRankMeta, isOperatorPlayer, isStaffPlayer, syncProtectedRoleTags, OPERATOR_ROLE_TAG } from '../systems/ranks.js';
import { syncRankChatTeam } from '../systems/rankChatRuntime.js';
import { world, system, InputPermissionCategory, GameMode } from '@minecraft/server'; 
import { seeInv, seeEnderChest } from '../systems/seeInv.js';
import { openShopManager } from '../systems/shop/menu.js';
import { REALM_STAGGER, notify, refreshRealmPlayers, registerRealmHook, runBuilderTesterGamemodeChange } from '../utils/realmPerf.js';
import {
  getRememberedGamemode,
  rememberPlayerGamemode,
  setCreativeRoleTag,
  isCreativeBuilderTagged,
  isCreativeBuilderSessionActive,
  isTester,
  isWorldBuilderRole,
} from '../utils/creativeRoleGuard.js';
import {
  canUseVanish,
  isVanished,
  listPlayersForAdminPicker,
  setVanished,
  startVanishRuntime,
} from '../utils/vanish.js';


const MUTE_TAG = 'bd_muted';
const FREEZE_TAG = 'bd_frozen';
const FROZEN_DP_KEY = 'bd_frozen';
const BAN_LIST_DP_KEY = 'bd_ban_list';
const WARN_LOG_DP_KEY = 'bd_warn_log';
const MAX_WARN_LOG = 25;
const frozenPlayerIds = new Set();

// ==========================================
// ANTI-EXPLOIT STAFF FREEZE LISTENERS
// ==========================================

// 1. Block clicking items (Ender Pearls, UI Items, Bows, Potions)
world.beforeEvents.itemUse.subscribe((event) => {
  const player = event.source;
  
  if (isFrozen(player)) {
      event.cancel = true; 
      
      system.run(() => {
          // ✨ FIX: Swapped to Toast
          notify(player, "admin_freeze_item", "§c§l[FROZEN]§r", "§cYou are frozen by staff! Items disabled.", "note.bass");
      });
  }
});

// 2. Block custom chat commands (if your Rain UI uses a chat command)
if (world.beforeEvents.chatSend) {
    world.beforeEvents.chatSend.subscribe((event) => {
      const player = event.sender;
      
      if (isFrozen(player) && event.message.startsWith("!")) { 
          event.cancel = true;
          system.run(() => {
              // ✨ FIX: Swapped to Toast
              notify(player, "admin_freeze_cmd", "§c§l[FROZEN]§r", "§cYou cannot use commands while frozen!", "note.bass");
          });
      }
    });
}

// ==========================================

function saveCustomRoles(roles) {
  world.setDynamicProperty('custom_roles', JSON.stringify(roles));
  invalidateCustomRolesCache();
}

function isStaffRank(player) {
  syncProtectedRoleTags(player);
  return isStaffPlayer(player);
}

function canManageRoles(player) {
  if (isOperatorPlayer(player)) return true;
  if (isCreativeBuilderTagged(player) || isWorldBuilderRole(player) || isTester(player)) {
    return false;
  }
  return isStaffRank(player) || hasPermission(player, 'manageRoles');
}

function canUseMute(player) {
  return isStaffRank(player) || hasPermission(player, 'can_mute') || hasPermission(player, 'managePunishments');
}

function canUseFreeze(player) {
  return isStaffRank(player) || hasPermission(player, 'can_freeze') || hasPermission(player, 'managePunishments');
}

function canUseKick(player) {
  return isStaffRank(player) || hasPermission(player, 'can_kick');
}

function canUseBan(player) {
  return isStaffRank(player) || hasPermission(player, 'can_ban');
}

function canUseWarn(player) {
  return (
    isStaffRank(player) ||
    hasPermission(player, 'can_warn') ||
    hasPermission(player, 'managePunishments')
  );
}

function canUseAdminControls(player) {
  return (
    canUseMute(player) ||
    canUseFreeze(player) ||
    canUseKick(player) ||
    canUseBan(player) ||
    canUseWarn(player) ||
    canUseVanish(player) ||
    hasPermission(player, 'invsee')
  );
}

function canUsePunishments(player) {
  return canUseMute(player) || canUseFreeze(player);
}

function getBanList() {
  const raw = world.getDynamicProperty(BAN_LIST_DP_KEY) || '[]';
  let list = [];

  try {
    list = JSON.parse(raw);
  } catch (e) {
    list = [];
  }

  return Array.isArray(list) ? list : [];
}

function saveBanList(list) {
  world.setDynamicProperty(BAN_LIST_DP_KEY, JSON.stringify(list));
}

function findBanEntry(player) {
  const name = String(player?.name || '').trim().toLowerCase();
  const id = String(player?.id || '').trim();

  return getBanList().find((entry) => {
    const entryName = String(entry?.name || '').trim().toLowerCase();
    const entryId = String(entry?.id || '').trim();
    return (name && entryName === name) || (id && entryId === id);
  });
}

function isBanned(player) {
  return !!findBanEntry(player);
}

function setBanned(target, banned, staff, reason = '') {
  const list = getBanList().filter((entry) => {
    const entryName = String(entry?.name || '').trim().toLowerCase();
    const entryId = String(entry?.id || '').trim();
    const targetName = String(target?.name || '').trim().toLowerCase();
    const targetId = String(target?.id || '').trim();
    return entryName !== targetName && entryId !== targetId;
  });

  if (banned) {
    list.push({
      name: target.name,
      id: target.id,
      reason: String(reason || 'No reason provided').trim(),
      by: staff?.name || 'Staff',
      at: Date.now(),
    });
  }

  saveBanList(list);
}

async function kickPlayer(staff, target, reason) {
  if (!target?.isValid) return false;

  const targetName = String(target.name || '').trim();
  if (!targetName) return false;

  const selectorName = targetName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const quotedName = targetName.replace(/"/g, '\\"');
  const safeReason = String(reason || 'Kicked by staff')
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, 160) || 'Kicked by staff';

  let dimension;
  try {
    dimension = target.dimension;
  } catch (e) {
    dimension = world.getDimension('minecraft:overworld');
  }

  const commands = [
    `kick @a[name="${selectorName}",c=1] ${safeReason}`,
    `execute as @a[name="${selectorName}",c=1] run kick @s ${safeReason}`,
    `kick "${quotedName}" ${safeReason}`,
  ];

  let lastError = '';
  for (const command of commands) {
    try {
      const result = await dimension.runCommandAsync(command);
      if ((result?.successCount ?? 0) > 0) return true;
      lastError = `successCount=${result?.successCount ?? 0}`;
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }

  console.warn(`[RAIN admin] Kick failed for ${targetName}: ${lastError || 'unknown command failure'}`);
  return false;
}

async function pickPlayer(staff, title, hint = 'Tap a player name to continue.') {
  const players = listPlayersForAdminPicker(staff);
  if (!players.length) return null;

  const list = new ActionFormData()
    .title(`bd.action:${title}`)
    .body(
      `§7Staff: §f${staff.name}\n\n` +
      `§7Online players: §f${players.length}\n\n` +
      `§8${hint}`
    );

  for (const p of players) {
    const status = getPlayerStatusLine(p);
    list.button(`§a${p.name}${status}`);
  }
  list.button('§7Back');

  const picked = await list.show(staff);
  if (picked.canceled || picked.selection === players.length) return null;

  return players[picked.selection] || null;
}

function getWarnLog(player) {
  const raw = player?.getDynamicProperty(WARN_LOG_DP_KEY) || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function getWarnCount(player) {
  return getWarnLog(player).length;
}

function addWarnEntry(target, staff, reason) {
  const log = getWarnLog(target);
  log.push({
    reason: String(reason || 'No reason provided').trim(),
    by: staff?.name || 'Staff',
    at: Date.now(),
  });

  target.setDynamicProperty(
    WARN_LOG_DP_KEY,
    JSON.stringify(log.slice(-MAX_WARN_LOG))
  );

  return log.length;
}

function getPlayerStatusLine(player) {
  const parts = [];

  if (isMuted(player)) parts.push('§cMuted');
  if (isFrozen(player)) parts.push('§bFrozen');
  if (isBanned(player)) parts.push('§4Banned');

  const warnCount = getWarnCount(player);
  if (warnCount > 0) parts.push(`§e${warnCount} warn${warnCount === 1 ? '' : 's'}`);

  return parts.length ? `\n§8${parts.join(' §7| ')}` : '';
}

function buildMainPanelBody(caller) {
  return (
    `§7Signed in as §f${caller.name}\n\n` +
    `§8Server management and moderation.\n` +
    `§8Choose a section below.`
  );
}

function buildAdminControlsBody(staff) {
  return (
    `§7Staff: §f${staff.name}\n\n` +
    `§8Player moderation and staff tools.\n` +
    `§8Warnings are sent in chat to the player.`
  );
}

function buildRolesMenuBody() {
  const online = refreshRealmPlayers();
  const staffCount = online.filter((p) =>
    isOperatorPlayer(p) ||
    p.hasTag('rank:owner') ||
    p.hasTag('rank:coowner') ||
    p.hasTag('rank:admin') ||
    p.hasTag('rank:mod') ||
    p.hasTag('staff')
  ).length;

  return (
    `§8Create ranks, edit permissions, and assign players.\n\n` +
    `§7Online staff/mod tags: §f${staffCount}§7/${online.length}`
  );
}

function getPrimaryRankChoices() {
  const seen = new Set();
  const choices = [];

  for (const rank of BUILTIN_RANKS) {
    if (rank.tag === OPERATOR_ROLE_TAG) continue;
    choices.push({ tag: rank.tag, label: `${rank.color}${rank.label}` });
    seen.add(rank.tag);
  }

  for (const role of getCustomRoles()) {
    if (!role?.tag || seen.has(role.tag)) continue;
    if (role.id === 'infested') continue;
    choices.push({ tag: role.tag, label: role.label });
    seen.add(role.tag);
  }

  return choices;
}

function clearPrimaryRankTags(player) {
  for (const rank of BUILTIN_RANKS) {
    if (player.hasTag(rank.tag)) player.removeTag(rank.tag);
  }

  for (const role of getCustomRoles()) {
    const tag = role?.tag;
    if (tag && player.hasTag(tag)) player.removeTag(tag);
  }
}

function setPrimaryRankTag(player, tag) {
  if (isOperatorPlayer(player)) {
    syncProtectedRoleTags(player);
    return;
  }
  clearPrimaryRankTags(player);
  if (tag) player.addTag(tag);
  syncProtectedRoleTags(player);
  syncRankChatTeam(player, true);
}

function setUtilityRoleTags(player, enabledTags) {
  for (const entry of UTILITY_ROLE_TAGS) {
    const shouldHave = enabledTags.has(entry.tag);
    const has = player.hasTag(entry.tag);

    if (shouldHave && !has) {
      player.addTag(entry.tag);
    }
    if (!shouldHave && has) player.removeTag(entry.tag);
  }
}

function summarizeRolePermissions(role) {
  const perms = role?.permissions || {};
  const enabled = ROLE_PERMISSION_DEFS
    .filter((def) => perms[def.key] === true)
    .map((def) => def.label);

  if (!enabled.length) return '§8No permissions enabled.';
  if (enabled.length <= 4) return `§7${enabled.join('\n§7')}`;
  return `§7${enabled.slice(0, 4).join('\n§7')}\n§8+${enabled.length - 4} more...`;
}

async function openOnlineStaffList(caller) {
  const players = refreshRealmPlayers();
  const staff = players.filter((p) => {
    syncProtectedRoleTags(p);
    if (
      isOperatorPlayer(p) ||
      p.hasTag('staff') ||
      p.hasTag('rank:mod') ||
      p.hasTag('rank:admin') ||
      p.hasTag('rank:owner') ||
      p.hasTag('rank:coowner')
    ) {
      return true;
    }

    return getRankMeta(p).id !== 'member';
  });

  const form = new ActionFormData()
    .title('bd.action:Online Roles')
    .body(
      staff.length
        ? `§7Tap a player to manage their roles.\n\n§8Showing ${staff.length} notable players.`
        : '§7No staff-tagged players online right now.'
    );

  for (const p of staff) {
    form.button(`§a${p.name}\n§8${getRankMeta(p).label}`);
  }
  form.button('§7Back');

  const res = await form.show(caller);
  if (res.canceled || res.selection === staff.length) return;
  const target = staff[res.selection];
  if (target) await openAssignRolesMenu(caller, target);
}

async function openPrimaryRankPicker(caller, target) {
  if (!canManageRoles(caller)) {
    notify(caller, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const choices = getPrimaryRankChoices();
  const form = new ActionFormData()
    .title(`bd.action:Primary Rank`)
    .body(`§7Player: §f${target.name}\n\n§8Select one primary rank tag.`);

  for (const choice of choices) {
    form.button(choice.label);
  }
  form.button('§8Clear Rank');
  form.button('§7Back');

  const res = await form.show(caller);
  if (res.canceled || res.selection === choices.length + 1) return;

  if (res.selection === choices.length) {
    clearPrimaryRankTags(target);
    notify(caller, 'admin_role_cleared_rank', '§e§l[ROLES]§r', `§eCleared primary rank for ${target.name}.`, 'random.orb');
    return;
  }

  const picked = choices[res.selection];
  if (!picked) return;

  setPrimaryRankTag(target, picked.tag);
  notify(caller, 'admin_role_rank_set', '§a§l[ROLES]§r', `§aSet ${target.name} to ${picked.label}§a.`, 'random.levelup');
}

async function openUtilityTagsEditor(caller, target) {
  if (!canManageRoles(caller)) {
    notify(caller, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const form = new ModalFormData().title(`bd.modal:Tags · ${target.name}`);

  for (const entry of UTILITY_ROLE_TAGS) {
    form.toggle(entry.label, { defaultValue: target.hasTag(entry.tag) });
  }

  const res = await form.show(caller);
  if (res.canceled) return;

  const enabled = new Set();
  UTILITY_ROLE_TAGS.forEach((entry, index) => {
    if (res.formValues[index]) enabled.add(entry.tag);
  });

  setUtilityRoleTags(target, enabled);
  notify(caller, 'admin_role_tags_set', '§a§l[ROLES]§r', `§aUpdated utility tags for ${target.name}.`, 'random.orb');
}

async function openRolePresetsMenu(caller, target) {
  if (!canManageRoles(caller)) {
    notify(caller, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const form = new ActionFormData()
    .title('bd.action:Role Presets')
    .body(`§7Player: §f${target.name}\n\n§8Quick combinations for common jobs.`);

  const presets = [
    {
      label: '§7Member',
      apply: () => {
        clearPrimaryRankTags(target);
        setUtilityRoleTags(target, new Set());
      },
    },
    {
      label: '§5Moderator',
      apply: () => {
        setPrimaryRankTag(target, 'rank:mod');
        setUtilityRoleTags(target, new Set(['staff']));
      },
    },
    {
      label: '§cAdmin',
      apply: () => {
        setPrimaryRankTag(target, 'rank:admin');
        setUtilityRoleTags(target, new Set(['staff']));
      },
    },
    {
      label: '§bWorld Builder',
      apply: () => {
        setPrimaryRankTag(target, 'rank:member');
        setUtilityRoleTags(target, new Set(['world_builder']));
      },
    },
    {
      label: '§6Tester',
      apply: () => {
        setPrimaryRankTag(target, 'rank:member');
        setUtilityRoleTags(target, new Set(['tester']));
      },
    },
    {
      label: '§2Infested',
      apply: () => {
        setPrimaryRankTag(target, 'rank:member');
        setUtilityRoleTags(target, new Set(['rank:infested']));
      },
    },
  ];

  for (const preset of presets) {
    form.button(preset.label);
  }
  form.button('§7Back');

  const res = await form.show(caller);
  if (res.canceled || res.selection === presets.length) return;

  const preset = presets[res.selection];
  if (!preset) return;

  preset.apply();
  notify(caller, 'admin_role_preset', '§a§l[ROLES]§r', `§aApplied ${preset.label}§a to ${target.name}.`, 'random.levelup');
}

async function openAssignRolesMenu(caller, target = null) {
  if (!canManageRoles(caller)) {
    notify(caller, 'admin_error', '§c§l[ERROR]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  if (!target) {
    target = await pickPlayer(caller, 'Assign Roles', 'Pick a player to manage rank and tags.');
    if (!target) return;
  }

  if (isOperatorPlayer(target)) {
    syncProtectedRoleTags(target);
    notify(caller, 'admin_error', '§b§l[OPERATOR]§r', '§cThe hardcoded operator role cannot be changed.', 'note.bass');
    return;
  }

  while (true) {
    const form = new ActionFormData()
      .title(`bd.action:Roles · ${target.name}`)
      .body(formatPlayerRoleSummary(target) + '\n\n§8Choose an action below.')
      .button('§eSet Primary Rank')
      .button('§bEdit Utility Tags')
      .button('§aQuick Presets')
      .button('§7Back');

    const res = await form.show(caller);
    if (res.canceled || res.selection === 3) return;

    if (res.selection === 0) {
      await openPrimaryRankPicker(caller, target);
      continue;
    }

    if (res.selection === 1) {
      await openUtilityTagsEditor(caller, target);
      continue;
    }

    if (res.selection === 2) {
      await openRolePresetsMenu(caller, target);
      continue;
    }
  }
}

function isMuted(player) {
  return player?.hasTag(MUTE_TAG);
}

function isFrozenPersisted(player) {
  const stored = player?.getDynamicProperty(FROZEN_DP_KEY);
  return stored === true || stored === 1;
}

function isFrozen(player) {
  return isFrozenPersisted(player) || player?.hasTag(FREEZE_TAG);
}

function applyFreezeMovement(player, frozen) {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !frozen);
  } catch (e) {
    try {
      player.runCommandAsync(`inputpermission set @s movement ${frozen ? 'disabled' : 'enabled'}`);
    } catch (err) {}
  }
}

function syncFrozenPlayer(player, notifyOnRestore = false) {
  if (!isFrozenPersisted(player)) {
    frozenPlayerIds.delete(player?.id);
    return false;
  }

  frozenPlayerIds.add(player.id);
  if (!player.hasTag(FREEZE_TAG)) player.addTag(FREEZE_TAG);
  applyFreezeMovement(player, true);

  if (notifyOnRestore) {
    notify(player, "admin_freeze_restore", "§b§l[FROZEN]§r", "§bYou are still frozen by staff.", "note.bass");
  }

  return true;
}

function setMuted(player, muted) {
  if (!player) return;

  if (muted) {
    if (!player.hasTag(MUTE_TAG)) player.addTag(MUTE_TAG);
  } else {
    if (player.hasTag(MUTE_TAG)) player.removeTag(MUTE_TAG);
  }
}

function setFrozen(player, frozen) {
  if (!player) return;

  if (frozen) {
    player.setDynamicProperty(FROZEN_DP_KEY, true);
    if (!player.hasTag(FREEZE_TAG)) player.addTag(FREEZE_TAG);
    frozenPlayerIds.add(player.id);
  } else {
    player.setDynamicProperty(FROZEN_DP_KEY, undefined);
    if (player.hasTag(FREEZE_TAG)) player.removeTag(FREEZE_TAG);
    frozenPlayerIds.delete(player.id);
  }

  applyFreezeMovement(player, frozen);
}

function restoreFrozenOnSpawn(player) {
  syncFrozenPlayer(player, true);
}

if (world.afterEvents?.playerSpawn) {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;

    system.runTimeout(() => restoreFrozenOnSpawn(ev.player), 1);
    system.runTimeout(() => syncFrozenPlayer(ev.player, false), 20);
    system.runTimeout(() => syncFrozenPlayer(ev.player, false), 60);

    system.runTimeout(() => {
      const ban = findBanEntry(ev.player);
      if (!ban) return;

      const reason = ban.reason ? `Banned: ${ban.reason}` : 'Banned from this server.';
      kickPlayer(null, ev.player, reason).catch(() => {});
      notify(ev.player, 'admin_ban_join', '§c§l[BANNED]§r', `§c${ban.reason || 'You are banned from this server.'}`, 'note.bass');
    }, 5);
  });
}

let frozenSyncRot = 0;

function tickFrozenPlayersSync(players) {
  if (!frozenPlayerIds.size) return;

  const ids = [...frozenPlayerIds];
  const targetId = ids[frozenSyncRot % ids.length];
  frozenSyncRot++;

  const player = players.find((p) => p.id === targetId);
  if (!player) {
    frozenPlayerIds.delete(targetId);
    return;
  }

  if (!isFrozenPersisted(player)) {
    frozenPlayerIds.delete(player.id);
    return;
  }

  syncFrozenPlayer(player, false);
}

registerRealmHook(REALM_STAGGER.MEDIUM, tickFrozenPlayersSync);

startVanishRuntime();

async function openMuteMenu(staff) {
  if (!canUseMute(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to mute.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(staff, 'Mute Player', 'Toggle chat mute for the selected player.');
    if (!target) return;

    const nextMuted = !isMuted(target);
    setMuted(target, nextMuted);

    notify(staff, "admin_mute_success", "§a§l[STAFF]§r", nextMuted ? `§aMuted ${target.name}.` : `§aUnmuted ${target.name}.`, "random.orb");
    notify(target, "admin_mute_alert", nextMuted ? "§c§l[MUTED]§r" : "§a§l[UNMUTED]§r", nextMuted ? "§cYou have been muted by staff." : "§aYou have been unmuted by staff.", nextMuted ? "note.bass" : "random.levelup");
  }
}

async function openFreezeMenu(staff) {
  if (!canUseFreeze(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to freeze.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(staff, 'Freeze Player', 'Toggle movement freeze for the selected player.');
    if (!target) return;

    const nextFrozen = !isFrozen(target);
    setFrozen(target, nextFrozen);

    notify(staff, "admin_freeze_success", "§a§l[STAFF]§r", nextFrozen ? `§aFroze ${target.name}.` : `§aUnfroze ${target.name}.`, "random.orb");
    notify(target, "admin_freeze_alert", nextFrozen ? "§b§l[FROZEN]§r" : "§a§l[UNFROZEN]§r", nextFrozen ? "§bYou have been frozen by staff." : "§aYou have been unfrozen by staff.", nextFrozen ? "note.bass" : "random.levelup");
  }
}

async function openKickMenu(staff) {
  if (!canUseKick(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to kick.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(staff, 'Kick Player', 'Remove the selected player from the world.');
    if (!target) return;

    const confirm = await new ActionFormData()
      .title(`bd.action:Kick ${target.name}?`)
      .body('§7This will remove the player from the world.')
      .button('§cKick Player')
      .button('§7Cancel')
      .show(staff);

    if (confirm.canceled || confirm.selection !== 0) continue;

    const modal = await new ModalFormData()
      .title('bd.modal:Kick Reason')
      .textField('Reason (optional)', 'Breaking rules')
      .show(staff);

    const reason = modal.canceled ? 'Kicked by staff' : String(modal.formValues?.[0] || 'Kicked by staff').trim();
    const ok = await kickPlayer(staff, target, reason);

    if (ok) {
      notify(staff, 'admin_kick_success', '§a§l[STAFF]§r', `§aKicked ${target.name}.`, 'random.orb');
    } else {
      notify(staff, 'admin_kick_fail', '§c§l[ERROR]§r', '§cFailed to kick player.', 'note.bass');
    }
  }
}

async function openBanMenu(staff) {
  if (!canUseBan(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to ban.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(staff, 'Ban Player', 'Ban or unban the selected player.');
    if (!target) return;

    if (isBanned(target)) {
      const ban = findBanEntry(target);
      const unban = await new ActionFormData()
        .title(`bd.action:${target.name}`)
        .body(`§7Status: §cBanned\n§7Reason: §f${ban?.reason || 'Unknown'}\n\n§7Unban this player?`)
        .button('§aUnban Player')
        .button('§7Back')
        .show(staff);

      if (unban.canceled || unban.selection !== 0) continue;

      setBanned(target, false, staff);
      notify(staff, 'admin_unban_success', '§a§l[STAFF]§r', `§aUnbanned ${target.name}.`, 'random.orb');
      continue;
    }

    const modal = await new ModalFormData()
      .title(`bd.modal:Ban ${target.name}`)
      .textField('Reason', 'Breaking rules')
      .show(staff);

    if (modal.canceled) continue;

    const reason = String(modal.formValues?.[0] || 'Banned by staff').trim() || 'Banned by staff';

    const confirm = await new ActionFormData()
      .title(`bd.action:Ban ${target.name}?`)
      .body(`§7Reason: §f${reason}\n\n§cThey will be kicked and blocked from rejoining.`)
      .button('§cBan Player')
      .button('§7Cancel')
      .show(staff);

    if (confirm.canceled || confirm.selection !== 0) continue;

    setBanned(target, true, staff, reason);
    await kickPlayer(staff, target, `Banned: ${reason}`);
    notify(staff, 'admin_ban_success', '§c§l[STAFF]§r', `§cBanned ${target.name}.`, 'random.orb');
  }
}

async function openWarnMenu(staff) {
  if (!canUseWarn(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to warn.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(
      staff,
      'Warn Player',
      'Select who to warn, then enter a message.'
    );
    if (!target) return;

    const priorWarns = getWarnCount(target);
    const modal = await new ModalFormData()
      .title(`bd.modal:Warn ${target.name}`)
      .textField('Warning message', 'Please follow server rules.')
      .show(staff);

    if (modal.canceled) continue;

    const reason = String(modal.formValues?.[0] || 'You have received a staff warning.').trim()
      || 'You have received a staff warning.';

    const confirm = await new ActionFormData()
      .title(`bd.action:Warn ${target.name}?`)
      .body(
        `§7Target: §f${target.name}\n` +
        `§7Previous warnings: §e${priorWarns}\n\n` +
        `§7Message:\n§f${reason}\n\n` +
        `§8This will be sent to the player in chat.`
      )
      .button('§eSend Warning')
      .button('§7Cancel')
      .show(staff);

    if (confirm.canceled || confirm.selection !== 0) continue;

    const totalWarns = addWarnEntry(target, staff, reason);

    target.sendMessage(
      `§e[WARNING] §f${reason}\n` +
      `§7From: §f${staff.name} §8| §7Total warnings: §e${totalWarns}`
    );
    staff.sendMessage(
      `§8[Staff] §7You warned §f${target.name}§7: §f${reason}`
    );

    notify(
      staff,
      'admin_warn_success',
      '§e[STAFF]',
      `§eWarned ${target.name}. Total: ${totalWarns}`,
      'random.orb'
    );
  }
}

async function openEnderChestMenu(staff) {
  if (!hasPermission(staff, 'invsee')) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cNo permission to view ender chests.", "note.bass");
    return;
  }

  while (true) {
    const target = await pickPlayer(staff, 'Ender Chest', 'View and manage ender chest items.');
    if (!target) return;

    await seeEnderChest(staff, target);
  }
}

async function openAdminControlsMenu(staff) {
  if (!canUseAdminControls(staff)) {
    notify(staff, "admin_error", "§c§l[ERROR]§r", "§cYou do not have permission.", "note.bass");
    return;
  }

  while (true) {
    const form = new ActionFormData()
      .title('bd.action:Admin Controls')
      .body(buildAdminControlsBody(staff))
      .button(canUseMute(staff) ? '§cMute Player' : '§7Mute Player (no perm)')
      .button(canUseFreeze(staff) ? '§bFreeze Player' : '§7Freeze Player (no perm)')
      .button(canUseWarn(staff) ? '§eWarn Player' : '§7Warn Player (no perm)')
      .button(canUseKick(staff) ? '§6Kick Player' : '§7Kick Player (no perm)')
      .button(canUseBan(staff) ? '§4Ban Player' : '§7Ban Player (no perm)')
      .button(canUseVanish(staff) ? '§5Vanish Mode' : '§7Vanish Mode (no perm)')
      .button(hasPermission(staff, 'invsee') ? '§dEnder Chest' : '§7Ender Chest (no perm)')
      .button('§7Back');

    const res = await form.show(staff);
    if (res.canceled || res.selection === 7) return;

    if (res.selection === 0) {
      await openMuteMenu(staff);
      continue;
    }

    if (res.selection === 1) {
      await openFreezeMenu(staff);
      continue;
    }

    if (res.selection === 2) {
      await openWarnMenu(staff);
      continue;
    }

    if (res.selection === 3) {
      await openKickMenu(staff);
      continue;
    }

    if (res.selection === 4) {
      await openBanMenu(staff);
      continue;
    }

    if (res.selection === 5) {
      await openVanishMenu(staff);
      continue;
    }

    if (res.selection === 6) {
      await openEnderChestMenu(staff);
      continue;
    }
  }
}

async function openVanishMenu(staff) {
  if (!canUseVanish(staff)) {
    notify(staff, 'admin_error', '§c§l[ERROR]§r', '§cYou do not have permission to use vanish.', 'note.bass');
    return;
  }

  while (true) {
    const vanished = isVanished(staff);
    const statusLine = vanished ? '§aEnabled' : '§cDisabled';

    const form = new ActionFormData()
      .title('bd.action:Vanish Mode')
      .body(
        `§7Status: ${statusLine}\n\n` +
        `§8Creative flight with hidden presence.\n` +
        `§8Inventory is stored until vanish ends.\n` +
        `§8Use flight to avoid ground footsteps.\n` +
        `§8Use the hotbar item to disable vanish.`
      )
      .button(vanished ? '§cDisable Vanish' : '§aEnable Vanish')
      .button('§7Back');

    const res = await form.show(staff);
    if (res.canceled || res.selection === 1) return;

    const nextVanished = !vanished;
    const ok = setVanished(staff, nextVanished);
    if (!ok) continue;

    notify(
      staff,
      'admin_vanish_toggle',
      nextVanished ? '§5§l[VANISH]§r' : '§a§l[VANISH]§r',
      nextVanished ? '§7Vanish mode enabled.' : '§7Vanish mode disabled.',
      nextVanished ? 'random.orb' : 'random.levelup'
    );
  }
}

async function openPunishmentMenu(staff) {
  await openAdminControlsMenu(staff);
}

async function roleHubMenu(player, role, index) {
  if (!canManageRoles(player)) {
    notify(player, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const protectedRole = PROTECTED_ROLE_IDS.has(role.id);

  const form = new ActionFormData()
    .title(`bd.action:${role.label} §r§8Hub`)
    .body(
      `Tag: §7${role.tag}§r\n` +
      `ID: §8${role.id}\n\n` +
      summarizeRolePermissions(role) +
      (protectedRole ? '\n\n§8Protected role — cannot delete.' : '')
    )
    .button('§bEdit Permissions')
    .button('§eRename Label')
    .button('§aAssign To Player')
    .button(protectedRole ? '§8Delete Role (protected)' : '§cDelete Role')
    .button('§7Back');

  const res = await form.show(player);
  if (res.canceled || res.selection === 4) return;

  if (res.selection === 0) {
    await editRolePermissionsMenu(player, role, index);
    return;
  }

  if (res.selection === 1) {
    await editRoleLabelMenu(player, role, index);
    return;
  }

  if (res.selection === 2) {
    const target = await pickPlayer(player, 'Assign Role', `Give ${role.label}§r to a player:`);
    if (target) {
      setPrimaryRankTag(target, role.tag);
      notify(
        player,
        'admin_role_assigned',
        '§a§l[ROLES]§r',
        `§aSet ${target.name} to ${role.label}§a.`,
        'random.levelup'
      );
    }
    await roleHubMenu(player, role, index);
    return;
  }

  if (res.selection === 3) {
    if (protectedRole) {
      notify(player, 'admin_error', '§c§l[ROLES]§r', '§cThat role is protected and cannot be deleted.', 'note.bass');
      await roleHubMenu(player, role, index);
      return;
    }

    await confirmDeleteRole(player, role, index);
  }
}

async function editRoleLabelMenu(player, role, index) {
  if (!canManageRoles(player)) {
    notify(player, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const modal = new ModalFormData()
    .title('bd.modal:Rename Role')
    .textField('Display label (Use § for colors)', role.label);

  const res = await modal.show(player);
  if (res.canceled) return roleHubMenu(player, role, index);

  const nextLabel = String(res.formValues[0] || role.id).trim();
  if (!nextLabel) {
    notify(player, 'admin_error', '§c§l[ERROR]§r', '§cLabel cannot be empty.', 'note.bass');
    return roleHubMenu(player, role, index);
  }

  role.label = nextLabel;

  const allRoles = getCustomRoles();
  allRoles[index] = role;
  saveCustomRoles(allRoles);

  notify(player, 'admin_role_renamed', '§a§l[ROLES]§r', `§aRenamed role to ${nextLabel}§a.`, 'random.orb');
  await roleHubMenu(player, role, index);
}

async function editRolePermissionsMenu(player, role, index) {
  if (!canManageRoles(player)) {
    notify(player, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  const perms = role.permissions || {};
  const form = new ModalFormData().title('bd.modal:Role Permissions');

  for (const def of ROLE_PERMISSION_DEFS) {
    form.toggle(def.label, { defaultValue: perms[def.key] === true });
  }

  const res = await form.show(player);
  if (res.canceled) return roleHubMenu(player, role, index);

  const nextPerms = {};
  ROLE_PERMISSION_DEFS.forEach((def, i) => {
    nextPerms[def.key] = res.formValues[i] === true;
  });

  role.permissions = nextPerms;

  const allRoles = getCustomRoles();
  allRoles[index] = role;
  saveCustomRoles(allRoles);

  notify(player, "admin_role_success", "§a§l[ROLES]§r", `§aPermissions updated for ${role.label}!`, "random.orb");
  await roleHubMenu(player, role, index);
}

async function confirmDeleteRole(player, role, index) {
  if (!canManageRoles(player)) {
    notify(player, 'admin_error', '§c§l[ROLES]§r', '§cStaff role-management access is required.', 'note.bass');
    return;
  }

  if (PROTECTED_ROLE_IDS.has(role.id)) {
    notify(player, 'admin_error', '§c§l[ROLES]§r', '§cThat role is protected and cannot be deleted.', 'note.bass');
    return roleHubMenu(player, role, index);
  }

  const form = new ActionFormData()
    .title('bd.action:§c§lDelete Role?')
    .body(`Are you completely sure you want to delete the ${role.label} §rrole?\n\n§4This cannot be undone!`)
    .button('§cYes, Delete It')
    .button('§aNo, Keep It');

  const res = await form.show(player);
  if (res.canceled || res.selection === 1) return roleHubMenu(player, role, index);

  const allRoles = getCustomRoles();
  allRoles.splice(index, 1);
  saveCustomRoles(allRoles);

  notify(player, "admin_role_deleted", "§c§l[ROLES]§r", "§cRole deleted successfully.", "random.orb");
}

const HARDCODED_TESTER_NAMES = ['Itmecatt2058', 'Ravenslash16'].map((name) => name.toLowerCase());

function hasTagIgnoreCase(player, tagName) {
  const want = String(tagName || '').trim().toLowerCase();
  if (!want) return false;

  try {
    for (const tag of player.getTags()) {
      if (String(tag).trim().toLowerCase() === want) return true;
    }
  } catch (e) {}

  return false;
}

function hasBuilderHubAccess(player) {
  return isCreativeBuilderTagged(player);
}

function hasTesterHubAccess(player) {
  return (
    isTester(player) ||
    hasPermission(player, 'testerHub') ||
    HARDCODED_TESTER_NAMES.includes(String(player?.name || '').trim().toLowerCase())
  );
}

export function canOpenAdminPanel(player) {
  syncProtectedRoleTags(player);
  return isOperatorPlayer(player) || hasPermission(player, 'openAdminPanel');
}

export function canOpenCreativeBuilderHub(player) {
  return hasBuilderHubAccess(player) || isStaffRank(player);
}

export function canOpenTesterHub(player) {
  return hasTesterHubAccess(player) || isStaffRank(player);
}

function resolveGamemodeKey(player) {
  try {
    const mode = player.getGameMode?.();
    if (mode == null) return null;

    if (
      mode === GameMode.Creative ||
      mode === GameMode.creative
    ) return 'creative';

    if (
      mode === GameMode.Survival ||
      mode === GameMode.survival
    ) return 'survival';

    if (
      mode === GameMode.Spectator ||
      mode === GameMode.spectator
    ) return 'spectator';

    if (
      mode === GameMode.Adventure ||
      mode === GameMode.adventure
    ) return 'adventure';

    const name = String(mode).toLowerCase();
    if (name.includes('creative')) return 'creative';
    if (name.includes('spectator')) return 'spectator';
    if (name.includes('adventure')) return 'adventure';
    if (name.includes('survival')) return 'survival';
  } catch (e) {}

  return null;
}

function gamemodeKeyToEnum(key) {
  const map = {
    creative: GameMode.Creative ?? GameMode.creative,
    survival: GameMode.Survival ?? GameMode.survival,
    spectator: GameMode.Spectator ?? GameMode.spectator,
    adventure: GameMode.Adventure ?? GameMode.adventure,
  };

  return map[key] ?? null;
}

function getHubGamemodeLabel(player) {
  const labels = {
    survival: '§aSurvival',
    creative: '§dCreative',
    spectator: '§7Spectator',
    adventure: '§6Adventure',
  };

  const key =
    resolveGamemodeKey(player) ||
    getRememberedGamemode(player) ||
    (player.hasTag('rain_creative_role') ? 'creative' : null);

  return labels[key] || '§8Unknown';
}

function waitTicks(ticks = 1) {
  return new Promise((resolve) => system.runTimeout(resolve, ticks));
}

function getPlayerGamemodeKey(player) {
  return resolveGamemodeKey(player);
}

function resolveBuilderHubFromMode(player) {
  if (isCreativeBuilderSessionActive(player) || player.hasTag('rain_creative_role')) {
    return 'creative';
  }

  const remembered = getRememberedGamemode(player);
  if (remembered) return remembered;

  return getPlayerGamemodeKey(player) || 'survival';
}

function syncCreativeBuilderHubSession(player, targetMode) {
  if (!isCreativeBuilderTagged(player)) return;

  const fromMode = resolveBuilderHubFromMode(player);

  if (targetMode === 'creative') {
    runBuilderTesterGamemodeChange(player, fromMode === 'creative' ? 'survival' : fromMode, 'creative');
    return;
  }

  if (targetMode === 'survival' && isCreativeBuilderSessionActive(player)) {
    runBuilderTesterGamemodeChange(player, 'creative', 'survival');
  }
}

async function applyHubGamemode(player, modeName) {
  const target = gamemodeKeyToEnum(modeName);
  if (!target) return false;

  syncCreativeBuilderHubSession(player, modeName);

  const fromMode = resolveBuilderHubFromMode(player);

  if (fromMode === modeName) {
    syncCreativeBuilderHubSession(player, modeName);
    return true;
  }

  const finishSwitch = () => {
    runBuilderTesterGamemodeChange(player, fromMode, modeName);
    rememberPlayerGamemode(player, modeName);
    setCreativeRoleTag(player, modeName === 'creative');
  };

  const safeName = String(player.name || '').replace(/"/g, '\\"');
  const commandAttempts = [
    `execute as "${safeName}" at @s run gamemode ${modeName} @s`,
    `gamemode ${modeName} "${safeName}"`,
    `gamemode ${modeName.charAt(0)} "${safeName}"`,
    `gamemode ${modeName === 'creative' ? '1' : modeName === 'survival' ? '0' : '3'} "${safeName}"`,
    `gamemode ${modeName} @s`,
  ];

  let attempted = false;

  try {
    player.setGameMode(target);
    attempted = true;
    await waitTicks(2);
    if (getPlayerGamemodeKey(player) === modeName) {
      finishSwitch();
      return true;
    }
  } catch (e) {}

  for (const cmd of commandAttempts) {
    try {
      await player.dimension.runCommandAsync(cmd);
      attempted = true;
      await waitTicks(2);
      if (getPlayerGamemodeKey(player) === modeName) {
        finishSwitch();
        return true;
      }
    } catch (e) {}
  }

  try {
    await player.runCommandAsync(`gamemode ${modeName} @s`);
    attempted = true;
    await waitTicks(2);
    if (getPlayerGamemodeKey(player) === modeName) {
      finishSwitch();
      return true;
    }
  } catch (e) {}

  // Realms often fail gamemode readback even after a successful switch — still vault + sync tag.
  if (attempted) {
    finishSwitch();
    return true;
  }

  return false;
}

function buildCreativeBuilderHubBody(player) {
  return (
    `§7Signed in as §f${player.name}\n\n` +
    `§8Creative builder tools and gamemode control.\n` +
    `§8Survival inventory is vaulted when entering Creative.\n\n` +
    `§7Current mode: ${getHubGamemodeLabel(player)}`
  );
}

function buildTesterHubBody(player) {
  return (
    `§7Signed in as §f${player.name}\n\n` +
    `§8Tester utilities and gamemode control.\n` +
    `§8Survival gear is saved when entering Creative.\n\n` +
    `§7Current mode: ${getHubGamemodeLabel(player)}`
  );
}

async function openGamemodeHub(player, hubType) {
  const isBuilder = hubType === 'builder';
  const title = isBuilder ? 'bd.action:§dCreative Builder Hub' : 'bd.action:§6Tester Hub';
  const buildBody = isBuilder ? buildCreativeBuilderHubBody : buildTesterHubBody;
  const successPrefix = isBuilder ? '§d§l[BUILDER]§r' : '§6§l[TESTER]§r';
  const notifyKey = isBuilder ? 'builder_gm_switch' : 'tester_gm_switch';

  while (true) {
    const form = new ActionFormData()
      .title(title)
      .body(buildBody(player))
      .button('§aSurvival Mode')
      .button('§dCreative Mode')
      .button('§7Spectator Mode')
      .button('§7Close');

    const res = await form.show(player);
    if (res.canceled || res.selection === 3) return;

    const modeNames = ['survival', 'creative', 'spectator'];
    const displayNames = ['Survival', 'Creative', 'Spectator'];
    const modeName = modeNames[res.selection];
    const displayName = displayNames[res.selection];

    if (!modeName) continue;

    syncCreativeBuilderHubSession(player, modeName);

    try {
      if (getPlayerGamemodeKey(player) === modeName && !isCreativeBuilderTagged(player)) {
        notify(
          player,
          `${notifyKey}_same`,
          successPrefix,
          `§7You are already in §f${displayName}§7 mode.`,
          'random.orb'
        );
        continue;
      }
    } catch (e) {}

    const ok = await applyHubGamemode(player, modeName);
    if (!ok) {
      notify(player, `${notifyKey}_fail`, '§c§l[ERROR]§r', '§cCould not switch gamemode.', 'note.bass');
      continue;
    }

    notify(
      player,
      notifyKey,
      successPrefix,
      `§7Switched to §f${displayName}§7 mode.`,
      'random.levelup'
    );
  }
}

export async function openCreativeBuilderHub(player) {
  if (!canOpenCreativeBuilderHub(player)) {
    notify(player, 'builder_hub_denied', '§c§l[ERROR]§r', '§cYou do not have access to the Creative Builder Hub.', 'note.bass');
    return;
  }

  await openGamemodeHub(player, 'builder');
}

export async function openTesterHub(player) {
  if (!canOpenTesterHub(player)) {
    notify(player, 'tester_hub_denied', '§c§l[ERROR]§r', '§cYou do not have access to the Tester Hub.', 'note.bass');
    return;
  }

  await openGamemodeHub(player, 'tester');
}

function buildHubAccessBody(player) {
  return (
    `§7Signed in as §f${player.name}\n\n` +
    `§8Staff tools and gamemode hubs.\n` +
    `§8Choose a section below.`
  );
}

async function openHubAccessMenu(caller) {
  const showBuilder = hasBuilderHubAccess(caller);
  const showTester = hasTesterHubAccess(caller);
  if (!showBuilder && !showTester) return;

  while (true) {
    const form = new ActionFormData()
      .title('bd.action:§cStaff Tools')
      .body(buildHubAccessBody(caller));

    if (showBuilder) form.button('§dCreative Builder Hub');
    if (showTester) form.button('§6Tester Hub');
    form.button('§7Close');

    const builderIdx = showBuilder ? 0 : -1;
    const testerIdx = showTester ? (showBuilder ? 1 : 0) : -1;
    const closeIdx = (showBuilder ? 1 : 0) + (showTester ? 1 : 0);

    const res = await form.show(caller);
    if (res.canceled || res.selection === closeIdx) return;

    if (res.selection === builderIdx) {
      await openCreativeBuilderHub(caller);
      continue;
    }

    if (res.selection === testerIdx) {
      await openTesterHub(caller);
      continue;
    }
  }
}

export async function openAdminPanel(caller) {
  while (true) {
        const showBuilderHub = canOpenCreativeBuilderHub(caller);
        const showTesterHub = canOpenTesterHub(caller);

        const main = new ActionFormData()
          .title('bd.action:§cAdmin Panel')
          .body(buildMainPanelBody(caller))
          .button(canManageRoles(caller) ? '§dRoles' : '§7Roles (no perm)')
          .button(hasPermission(caller, 'invsee') ? '§bView Inventory' : '§7View Inventory (no perm)')
          .button(hasPermission(caller, 'manageShops') ? '§aShop Maker' : '§7Shop Maker (no perm)')
          .button(canUseAdminControls(caller) ? '§cAdmin Controls' : '§7Admin Controls (no perm)');

        if (showBuilderHub) main.button('§dCreative Builder Hub');
        if (showTesterHub) main.button('§6Tester Hub');

        const builderIdx = showBuilderHub ? 4 : -1;
        const testerIdx = showTesterHub ? (showBuilderHub ? 5 : 4) : -1;

        const res = await main.show(caller);
        if (res.canceled) break;

        if (res.selection === 0) {
          while (true) {
            const rolesMenu = new ActionFormData()
              .title('bd.action:Roles')
              .body(buildRolesMenuBody())
              .button('§aCreate New Role')
              .button('§dEdit / Delete Roles')
              .button('§eAssign Roles')
              .button('§bOnline Staff List')
              .button('§7Back');

            const rm = await rolesMenu.show(caller);
            if (rm.canceled || rm.selection === 4) break;

            if (!canManageRoles(caller)) {
              notify(caller, "admin_error", "§c§l[ERROR]§r", "§cYou do not have permission to manage roles.", "note.bass");
              continue;
            }

            if (rm.selection === 0) {
              const modal = new ModalFormData()
                .title('bd.modal:Create Role')
                .textField('Role id (no spaces)', 'moderator')
                .textField('Display label (Use § for colors)', '§9Moderator');

              const m = await modal.show(caller);
              if (m.canceled) continue;

              const [ridRaw, rlabelRaw] = m.formValues;
              const rid = String(ridRaw || '').trim().toLowerCase().replace(/\s+/g, '_');

              if (!rid) {
                notify(caller, "admin_error", "§c§l[ERROR]§r", "§cInvalid role id.", "note.bass");
                continue;
              }

              const roles = getCustomRoles();

              if (roles.find(r => r.id === rid)) {
                notify(caller, "admin_error", "§c§l[ERROR]§r", "§cRole already exists.", "note.bass");
                continue;
              }

              roles.push({
                id: rid,
                tag: `rank:${rid}`,
                label: String(rlabelRaw || rid),
                permissions: {}
              });

              saveCustomRoles(roles);
              notify(caller, "admin_role_created", "§a§l[ROLES]§r", `§aRole '${rid}' created.`, "random.orb");
              continue;
            }

            if (rm.selection === 1) {
              const roles = getCustomRoles();

              if (!roles.length) {
                notify(caller, "admin_error", "§c§l[ROLES]§r", "§cNo custom roles defined.", "note.bass");
                continue;
              }

              const list = new ActionFormData()
                .title('bd.action:Custom Roles')
                .body('§8Tap a role to edit permissions, rename, assign, or delete.');

              roles.forEach((r) => list.button(`${r.label}\n§8${r.id}`));
              list.button('§7Back');

              const picked = await list.show(caller);
              if (picked.canceled || picked.selection === roles.length) continue;

              await roleHubMenu(caller, roles[picked.selection], picked.selection);
              continue;
            }

            if (rm.selection === 2) {
              await openAssignRolesMenu(caller);
              continue;
            }

            if (rm.selection === 3) {
              await openOnlineStaffList(caller);
              continue;
            }
          }

          continue;
        }

        if (res.selection === 1) {
          if (!hasPermission(caller, 'invsee')) {
            notify(caller, "admin_error", "§c§l[ERROR]§r", "§cNo permission.", "note.bass");
            continue;
          }

          const players = listPlayersForAdminPicker(caller);
          if (!players.length) continue;

          const list = new ActionFormData()
            .title('bd.action:View Inventory')
            .body(
              `§7Staff: §f${caller.name}\n\n` +
              `§8Inspect a player's inventory,\n` +
              `§8grab, duplicate, or delete items.`
            );

          players.forEach(p => list.button('§a' + p.name));
          list.button('§7Cancel');

          const picked = await list.show(caller);
          if (picked.canceled || picked.selection === players.length) continue;

          await seeInv(caller, players[picked.selection]);
          continue;
        }

        if (res.selection === 2) {
          if (!hasPermission(caller, 'manageShops')) {
            notify(caller, "admin_error", "§c§l[ERROR]§r", "§cNo permission.", "note.bass");
            continue;
          }

          await openShopManager(caller);
          continue;
        }

        if (res.selection === 3) {
          await openAdminControlsMenu(caller);
          continue;
        }

        if (res.selection === builderIdx) {
          await openCreativeBuilderHub(caller);
          continue;
        }

        if (res.selection === testerIdx) {
          await openTesterHub(caller);
          continue;
        }
      }
}

export default {
  data: new Command()
    .setName('admin')
    .setDescription('Open staff, builder, or tester UI')
    .setPermission('Any'),

  run: (system, origin) => {
    system.run(async () => {
      const caller = origin.source;
      if (!caller) return;

      if (canOpenAdminPanel(caller)) {
        await openAdminPanel(caller);
        return;
      }

      if (hasBuilderHubAccess(caller) || hasTesterHubAccess(caller)) {
        await openHubAccessMenu(caller);
        return;
      }

      notify(caller, "admin_error", "§c§l[ERROR]§r", "§cYou are not allowed to use this command.", "note.bass");
    });
  }
};
