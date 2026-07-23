import { ActionFormData } from '@minecraft/server-ui';
import { system, world } from '@minecraft/server';
import { getPlayerCPS } from '../events/cps.js';
import { getFactionName, getFactionTag, getRankMeta } from './ranks.js';
import { getCombatRemainingSeconds, getTeleportCooldownRemainingSeconds, isInCombat } from '../utils/teleport.js';
import { livePlaytimeMsFor, formatPlaytimeDHMS } from '../utils/playtime.js';
import { toast, toastSuccess } from '../utils/realmPerf.js';

const KILLS_KEY = 'bd_kills';
const DEATHS_KEY = 'bd_deaths';
const SIDEBAR_OBJ = 'sb_side';

function clampNonNegative(v) {
  v = Number(v);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function formatDHMS(ms) {
  return formatPlaytimeDHMS(ms);
}

function ensureSidebarObjective() {
  try {
    world.scoreboard.getObjective(SIDEBAR_OBJ);
  } catch (e) {
    world.scoreboard.addObjective(SIDEBAR_OBJ, 'SB');
  }
}

function forceHideSidebarActionbar(player) {
  try {
    player.onScreenDisplay.setActionBar('');
  } catch (e) {}
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

  ensureSidebarObjective();

  if (player.hasTag('hide_stats')) {
    player.removeTag('hide_stats');
    try { player.scoreboard.setScore(SIDEBAR_OBJ, 0); } catch (e) {}
    toastSuccess(player, '\u00A7r\u00A7a\u00A7l[SYSTEM]\u00A7r \u00A7aStats Sidebar Enabled!', 'stats_enabled');
    return false;
  }

  player.addTag('hide_stats');
  try { player.scoreboard.setScore(SIDEBAR_OBJ, 1); } catch (e) {}
  toast(
    player,
    '\u00A7c\u00A7l[SYSTEM]\u00A7r \u00A7cStats Sidebar Disabled!',
    'stats_disabled',
    'note.bass'
  );

  forceHideSidebarActionbar(player);

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

  const pages = [
    {
      title: 'Overview',
      body:
`\u00A77IGN: \u00A7f${player.name}
\u00A77Rank: \u00A7f${rank.label}
\u00A77Faction: \u00A7f${factionDisplay}
\u00A77Playtime: \u00A7f${formatDHMS(playtimeMs)}`,
    },
    {
      title: 'Combat',
      body:
`\u00A77Kills: \u00A7f${kills}
\u00A77Deaths: \u00A7f${deaths}
\u00A77K/D: \u00A7f${kd}
\u00A77CPS: \u00A7f${cps}
\u00A77Combat: \u00A7f${combat}s`,
    },
    {
      title: 'Utility',
      body:
`\u00A77Homes: \u00A7f${homesCount}
\u00A77Plots: \u00A7f${plotsCount}
\u00A77Teleport Cooldown: \u00A7f${tpCd}s
\u00A77HUD Sidebar: ${isHidden ? '\u00A7cHidden' : '\u00A7aShown'}
\u00A78Toggle: \u00A77/bd:hidesidebar`,
    },
  ];

  system.runTimeout(() => {
    showStatsPage(player, pages, 0).catch(() => {});
  }, 2);
}

async function showStatsPage(player, pages, page) {
  const index = Math.max(0, Math.min(pages.length - 1, Number(page) || 0));
  const current = pages[index];
  const form = new ActionFormData()
    .title(`bd.action:Stats - ${current.title}`)
    .body(`${current.body}\n\n\u00A78Page \u00A7f${index + 1}/${pages.length}`)
    .button('\u00A7ePrevious')
    .button('\u00A7eNext')
    .button('\u00A77Close');

  const result = await form.show(player);
  if (!result || result.canceled || result.selection === 2) return;
  if (result.selection === 0) return showStatsPage(player, pages, index <= 0 ? pages.length - 1 : index - 1);
  if (result.selection === 1) return showStatsPage(player, pages, index >= pages.length - 1 ? 0 : index + 1);
}
