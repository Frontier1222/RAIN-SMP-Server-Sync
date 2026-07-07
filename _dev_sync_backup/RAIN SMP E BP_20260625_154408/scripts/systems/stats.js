import { ActionFormData } from '@minecraft/server-ui';
import { getPlayerCPS } from '../events/cps.js';
import { getFactionName, getFactionTag, getRankMeta, canHideSidebar } from './ranks.js';
import { getCombatRemainingSeconds, getTeleportCooldownRemainingSeconds, isInCombat } from '../utils/teleport.js';
import { livePlaytimeMsFor, formatPlaytimeDHMS } from '../utils/playtime.js';
import { toastError, toastSuccess } from '../utils/realmPerf.js';

const KILLS_KEY = 'bd_kills';
const DEATHS_KEY = 'bd_deaths';

function clampNonNegative(v) {
  v = Number(v);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function formatDHMS(ms) {
  return formatPlaytimeDHMS(ms);
}

function getArrayLengthFromDynamicProperty(player, key) {
  const raw = player.getDynamicProperty(key);
  if (!raw) return 0;

  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch (e) {
    return 0;
  }
}

export function togglePlayerHudSidebar(player) {
  if (!player) return false;

  if (!canHideSidebar(player)) {
    toastError(player, '§r§c§l[SYSTEM]§r §cYou do not have permission to hide the stats sidebar.', 'stats_no_perm');
    return false;
  }

  if (player.hasTag('hide_stats')) {
    player.removeTag('hide_stats');
    toastSuccess(player, '§r§a§l[SYSTEM]§r §aStats Sidebar Enabled!', 'stats_enabled');
    return false;
  }

  player.addTag('hide_stats');
  toastError(player, '§r§c§l[SYSTEM]§r §cStats Sidebar Disabled!', 'stats_disabled');

  try {
    player.onScreenDisplay.setActionBar('');
  } catch (e) {}

  try {
    player.runCommandAsync('title @s actionbar clear');
  } catch (e) {}

  return true;
}

export function showPlayerStats(player) {
  const kills = clampNonNegative(player.getDynamicProperty(KILLS_KEY));
  const deaths = clampNonNegative(player.getDynamicProperty(DEATHS_KEY));
  const kd = (kills / Math.max(1, deaths)).toFixed(2);

  const rank = getRankMeta(player);
  const factionTag = getFactionTag(player);
  const factionName = getFactionName(player);
  const factionDisplay = factionTag ? `[${factionTag}]` : (factionName || 'None');

  const cps = getPlayerCPS(player);
  const playtimeMs = livePlaytimeMsFor(player);

  const homesCount = getArrayLengthFromDynamicProperty(player, 'homes');
  const plotsCount = getArrayLengthFromDynamicProperty(player, 'owned_plots');

  const tpCd = getTeleportCooldownRemainingSeconds(player);
  const combat = isInCombat(player) ? getCombatRemainingSeconds(player) : 0;

  const isHidden = player.hasTag('hide_stats');

  const body =
`§7IGN: §f${player.name}
§7Rank: §f${rank.label}
§7Faction: §f${factionDisplay}

§7Kills: §f${kills}
§7Deaths: §f${deaths}
§7K/D: §f${kd}

§7CPS: §f${cps}
§7Playtime: §f${formatDHMS(playtimeMs)}

§7Homes: §f${homesCount}
§7Plots: §f${plotsCount}

§7Teleport Cooldown: §f${tpCd}s
§7Combat: §f${combat}s

§7HUD Sidebar: ${isHidden ? '§cHidden' : '§aShown'}
§8Toggle: §7/bd:hidesidebar`;

  const form = new ActionFormData()
    .title('bd.action:Stats')
    .body(body)
    .button('§7Close');

  return form.show(player);
}