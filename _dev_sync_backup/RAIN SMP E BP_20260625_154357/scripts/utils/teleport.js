export const TELEPORT_COOLDOWN_KEY = 'bd_tp_cooldown_until';
export const TELEPORT_COOLDOWN_MS = 30_000;

export const COMBAT_UNTIL_KEY = 'bd_combat_until';
export const COMBAT_MS = 30_000;

function readUntil(player, key) {
  const raw = player.getDynamicProperty(key);
  const until = Number(raw);
  return Number.isFinite(until) && until > 0 ? until : 0;
}

export function getTeleportCooldownRemainingMs(player, now = Date.now()) {
  const until = readUntil(player, TELEPORT_COOLDOWN_KEY);
  return Math.max(0, until - now);
}

export function getTeleportCooldownRemainingSeconds(player, now = Date.now()) {
  return Math.ceil(getTeleportCooldownRemainingMs(player, now) / 1000);
}

export function startTeleportCooldown(player, now = Date.now()) {
  player.setDynamicProperty(TELEPORT_COOLDOWN_KEY, now + TELEPORT_COOLDOWN_MS);
}

export function isInCombat(player, now = Date.now()) {
  const until = readUntil(player, COMBAT_UNTIL_KEY);
  return until > now;
}

export function getCombatRemainingSeconds(player, now = Date.now()) {
  const until = readUntil(player, COMBAT_UNTIL_KEY);
  const ms = until - now;
  if (ms <= 0) return 0;
  // Floor so each second ticks once (ceil kept "60" visible for ~2s at start).
  return Math.floor(ms / 1000);
}

export function markCombat(player, now = Date.now()) {
  const until = now + COMBAT_MS;
  player.setDynamicProperty(COMBAT_UNTIL_KEY, until);
  // Legacy key — keep in sync for older combat-log snapshots.
  player.setDynamicProperty("nf.combat_until", until);
  return until;
}

export function clearCombat(player) {
  player.setDynamicProperty(COMBAT_UNTIL_KEY, 0);
  player.setDynamicProperty("nf.combat_until", 0);
}