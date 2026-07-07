import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { migrateReceivedRainGui, isRainGuiItem } from "../../utils/rainGui.js";
import { isSoulboundItem, prepareInventoryForGravestone, restoreSoulboundAfterRespawn } from "../../utils/soulboundGrave.js";
import { notify } from "../../utils/realmPerf.js";
import { COMBAT_UNTIL_KEY, clearCombat as clearCombatState } from "../../utils/teleport.js";

const PENDING_CLEAR_KEY = "nf.clog.pending";
const PENDING_SNAPSHOTS_KEY = "nf.clog.snapshots";
const COMBAT_SCORE_KEY = "nf.combat_score";
const COMBAT_TIMER_OBJECTIVE = "combat_timer";
let combatTimerObjective = null;
const snapshotsByName = new Map();
const pendingSnapshotsByName = new Map();
const combatTimerLastById = new Map();

function parseJson(value, fallback) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    const obj = JSON.parse(value);
    return obj ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, obj) {
  world.setDynamicProperty(key, JSON.stringify(obj));
}

function getPendingSet() {
  const raw = parseJson(world.getDynamicProperty(PENDING_CLEAR_KEY), []);
  const arr = Array.isArray(raw) ? raw : [];
  return new Set(arr.map((v) => String(v)));
}

function setPendingSet(set) {
  writeJson(PENDING_CLEAR_KEY, [...set]);
}

function readPendingSnapshotsStore() {
  const raw = parseJson(world.getDynamicProperty(PENDING_SNAPSHOTS_KEY), {});
  return raw && typeof raw === "object" ? raw : {};
}

function writePendingSnapshotsStore(store) {
  writeJson(PENDING_SNAPSHOTS_KEY, store);
}

function savePendingSnapshot(name, snap) {
  if (!name || !snap) return;
  pendingSnapshotsByName.set(name, snap);
  const store = readPendingSnapshotsStore();
  store[name] = {
    dimId: snap.dimId,
    location: snap.location,
    combatUntil: snap.combatUntil,
    droppedOnLeave: !!snap.droppedOnLeave,
    items: (snap.items || []).map((entry) => ({
      kind: entry.kind,
      slot: entry.slot,
      data: serializeSnapshotItem(entry),
    })).filter((entry) => entry.data),
  };
  writePendingSnapshotsStore(store);
}

function loadPendingSnapshot(name) {
  const mem = pendingSnapshotsByName.get(name);
  if (mem) return mem;
  const store = readPendingSnapshotsStore();
  const raw = store[name];
  if (!raw?.location || !raw?.dimId) return null;
  return {
    name,
    dimId: raw.dimId,
    location: raw.location,
    combatUntil: Number(raw.combatUntil) || 0,
    droppedOnLeave: !!raw.droppedOnLeave,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

function deletePendingSnapshot(name) {
  pendingSnapshotsByName.delete(name);
  const store = readPendingSnapshotsStore();
  if (store[name]) {
    delete store[name];
    writePendingSnapshotsStore(store);
  }
}

function cancelPendingCombatLog(playerName) {
  const name = String(playerName ?? "");
  if (!name) return;
  const pending = getPendingSet();
  if (!pending.has(name)) return;
  pending.delete(name);
  setPendingSet(pending);
  deletePendingSnapshot(name);
}

function readCombatUntil(player) {
  let until = Number(player.getDynamicProperty(COMBAT_UNTIL_KEY) ?? 0);
  if (!Number.isFinite(until) || until <= 0) {
    until = Number(player.getDynamicProperty("nf.combat_until") ?? 0);
  }
  if (!Number.isFinite(until) || until <= 0) return 0;
  return until;
}

function setCombatScore(player, score) {
  const n = Number(score);
  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  player.setDynamicProperty(COMBAT_SCORE_KEY, safe);
  setCombatTimerScore(player, safe > 0 ? 1 : 0);
}

function getCombatTimerObjective() {
  if (combatTimerObjective) return combatTimerObjective;
  const sb = world.scoreboard;
  if (!sb) return null;
  const existing = sb.getObjective(COMBAT_TIMER_OBJECTIVE);
  if (existing) {
    combatTimerObjective = existing;
    return existing;
  }
  const created = sb.addObjective(COMBAT_TIMER_OBJECTIVE, COMBAT_TIMER_OBJECTIVE);
  combatTimerObjective = created;
  return created;
}

function setCombatTimerScore(player, value) {
  const obj = getCombatTimerObjective();
  if (!obj || !player) return;
  const v = Number(value);
  const safe = Number.isFinite(v) ? (v > 0 ? 1 : 0) : 0;
  obj.setScore(player, safe);
}

function cloneItem(item) {
  if (!item) return null;
  return item.clone ? item.clone() : item;
}

function cloneForDrop(item) {
  if (!item) return null;
  return cloneItem(item);
}

function serializeSnapshotItem(entry) {
  if (!entry?.item) return null;
  const item = entry.item;
  let lore = [];
  try {
    lore = item.getLore?.() || [];
  } catch (e) {}
  return {
    kind: entry.kind,
    slot: entry.slot,
    typeId: item.typeId,
    amount: item.amount,
    nameTag: item.nameTag,
    lore,
    keepOnDeath: !!item.keepOnDeath,
    lockMode: item.lockMode,
  };
}

function deserializeSnapshotItem(data) {
  if (!data?.typeId) return null;
  try {
    const item = new ItemStack(data.typeId, data.amount || 1);
    if (data.nameTag) item.nameTag = data.nameTag;
    if (Array.isArray(data.lore) && data.lore.length && item.setLore) {
      item.setLore(data.lore);
    }
    if (data.keepOnDeath) item.keepOnDeath = true;
    if (data.lockMode !== undefined) item.lockMode = data.lockMode;
    return item;
  } catch (e) {
    return null;
  }
}

function dropSnapshotItems(snap) {
  if (!snap?.items?.length || !snap.location) return 0;

  let dim;
  try {
    dim = world.getDimension(snap.dimId || "minecraft:overworld");
  } catch (e) {
    return 0;
  }

  let dropped = 0;
  for (const entry of snap.items) {
    const raw = entry?.data || serializeSnapshotItem(entry);
    if (!raw?.typeId) continue;

    const stack = deserializeSnapshotItem(raw);
    if (!stack || !shouldDropCombatLogItem(stack)) continue;

    try {
      dim.spawnItem(stack, spreadDropLocation(snap.location, dropped));
      dropped++;
    } catch (e) {}
  }

  return dropped;
}

function spreadDropLocation(base, index) {
  const ring = Math.floor(index / 8);
  const angle = (index % 8) * (Math.PI / 4);
  const radius = 0.5 + ring * 0.35;
  return {
    x: base.x + Math.cos(angle) * radius,
    y: base.y + 0.25,
    z: base.z + Math.sin(angle) * radius,
  };
}

function shouldDropCombatLogItem(item) {
  if (!item) return false;
  if (isRainGuiItem(item) || item.typeId === "nf:gui" || item.typeId === "bd:gui") return false;
  if (isSoulboundItem(item)) return false;
  return true;
}

function getAllItemsSnapshot(player) {
  const inv = player.getComponent("minecraft:inventory");
  const container = inv?.container;
  const items = [];
  if (container) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      items.push({ kind: "inv", slot: i, item: cloneItem(item) });
    }
  }
  const eq = player.getComponent("minecraft:equippable");
  if (eq) {
    // Mainhand is the selected hotbar slot — already included above; including it again dupes weapons on combat log.
    const slots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
      EquipmentSlot.Offhand,
    ];
    for (const slot of slots) {
      const item = eq.getEquipment(slot);
      if (!item) continue;
      items.push({ kind: "equip", slot, item: cloneItem(item) });
    }
  }
  return items;
}

function clearNonSoulboundInventory(player) {
  if (!player?.isValid) return;

  const inv = player.getComponent("minecraft:inventory");
  const container = inv?.container;
  if (container) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item || isRainGuiItem(item) || isSoulboundItem(item)) continue;
      container.setItem(i, undefined);
    }
  }

  const eq = player.getComponent("minecraft:equippable");
  if (eq) {
    const slots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
      EquipmentSlot.Offhand,
      EquipmentSlot.Mainhand,
    ];
    for (const slot of slots) {
      const item = eq.getEquipment(slot);
      if (!item || isSoulboundItem(item)) continue;
      eq.setEquipment(slot, undefined);
    }
  }
}

function dropPlayerInventoryAtLocation(player, dimId, location) {
  if (!player?.isValid || !location) return 0;

  let dim;
  try {
    dim = world.getDimension(dimId);
  } catch (e) {
    dim = player.dimension;
  }

  const entries = getAllItemsSnapshot(player);
  let dropped = 0;

  for (const entry of entries) {
    if (!entry?.item || !shouldDropCombatLogItem(entry.item)) continue;
    const dropItem = cloneForDrop(entry.item);
    if (!dropItem) continue;
    try {
      dim.spawnItem(dropItem, spreadDropLocation(location, dropped));
      dropped++;
    } catch (e) {}
  }

  return dropped;
}

function buildCombatSnapshot(player, until) {
  return {
    name: player.name,
    dimId: player.dimension.id,
    location: { x: player.location.x, y: player.location.y, z: player.location.z },
    items: getAllItemsSnapshot(player),
    combatUntil: until,
  };
}

/** Called from markCombat() — refresh combat-log snapshot for this player. */
export function refreshCombatSnapshot(player, until = readCombatUntil(player)) {
  if (!player?.isValid || !until || until <= Date.now()) return;
  setCombatScore(player, 1);
  snapshotsByName.set(player.name, buildCombatSnapshot(player, until));
}

export function clearCombat(player) {
  if (!player?.isValid) return;
  clearCombatState(player);
  setCombatScore(player, 0);
  combatTimerLastById.delete(player.id);
  snapshotsByName.delete(player.name);
}

let combatPollRot = 0;

function syncCombatTimerForPlayer(p, now) {
  let until = readCombatUntil(p);

  if (until && now > until) {
    clearCombatState(p);
    setCombatScore(p, 0);
    combatTimerLastById.delete(p.id);
    snapshotsByName.delete(p.name);
    return;
  }

  const inCombat = until && now <= until ? 1 : 0;
  const last = combatTimerLastById.get(p.id);
  if (last !== inCombat) {
    setCombatTimerScore(p, inCombat);
    combatTimerLastById.set(p.id, inCombat);
  }

  if (!inCombat) {
    snapshotsByName.delete(p.name);
    return;
  }

  const snap = snapshotsByName.get(p.name);
  if (snap) {
    snap.location = { x: p.location.x, y: p.location.y, z: p.location.z };
    snap.combatUntil = until;
    snap.dimId = p.dimension.id;
  } else {
    snapshotsByName.set(p.name, buildCombatSnapshot(p, until));
  }
}

/** Only combat-tracked players + one poll — avoids scanning everyone every master tick. */
export function tickCombatSnapshots(players, now = Date.now()) {
  if (!players?.length && !snapshotsByName.size) return;

  const playersByName = new Map();
  for (const p of players) {
    if (p?.name) playersByName.set(p.name, p);
  }

  for (const [name] of snapshotsByName) {
    const p = playersByName.get(name);
    if (!p?.isValid) continue;
    syncCombatTimerForPlayer(p, now);
  }

  if (!players.length) return;

  combatPollRot = (combatPollRot + 1) % players.length;
  const polled = players[combatPollRot];
  if (snapshotsByName.has(polled.name)) return;
  syncCombatTimerForPlayer(polled, now);
}

let combatSnapshotItemRot = 0;

/** Refresh one combat player's item snapshot per pass (expensive — do not run for everyone). */
export function tickCombatSnapshotItems(players, now = Date.now()) {
  const combatPlayers = [];

  for (const p of players) {
    const until = readCombatUntil(p);
    if (until && now <= until) combatPlayers.push(p);
  }

  if (!combatPlayers.length) return;

  combatSnapshotItemRot = (combatSnapshotItemRot + 1) % combatPlayers.length;
  const player = combatPlayers[combatSnapshotItemRot];
  const until = readCombatUntil(player);
  snapshotsByName.set(player.name, buildCombatSnapshot(player, until));
}

export function onPlayerDeath(player) {
  if (!player) return;

  cancelPendingCombatLog(player.name);
  snapshotsByName.delete(player.name);
  combatTimerLastById.delete(player.id);

  try {
    clearCombatState(player);
    setCombatScore(player, 0);
  } catch (e) {}
}

export function onPlayerLeave(ev) {
  const player = ev.player;
  const name = String(player?.name ?? ev.playerName ?? "");
  if (!name) return;

  if (player?.isValid) {
    const until = readCombatUntil(player);
    if (until && until > Date.now()) {
      snapshotsByName.set(name, buildCombatSnapshot(player, until));
    }
  }

  const snap = snapshotsByName.get(name);
  if (!snap) return;
  const now = Date.now();
  if (!snap.combatUntil || now > snap.combatUntil) return;

  dropSnapshotItems(snap);

  if (player?.isValid) {
    clearNonSoulboundInventory(player);
  }

  savePendingSnapshot(name, {
    ...snap,
    items: [],
    droppedOnLeave: true,
  });
  snapshotsByName.delete(name);

  const pending = getPendingSet();
  pending.add(name);
  setPendingSet(pending);
}

export function onPlayerSpawn(ev) {
  const player = ev.player;

  if (ev.initialSpawn) {
    migrateReceivedRainGui(player);
  }

  const pending = getPendingSet();
  if (!pending.has(player.name)) return;

  const snap = loadPendingSnapshot(player.name);

  pending.delete(player.name);
  setPendingSet(pending);
  deletePendingSnapshot(player.name);

  clearNonSoulboundInventory(player);

  try {
    prepareInventoryForGravestone(player);
  } catch (e) {}

  notify(
    player,
    "clog_drop",
    "§r§c§l[COMBAT LOG]§r",
    snap?.droppedOnLeave
      ? "§cYou logged out during combat! Your items were dropped where you left."
      : "§cYou logged out during combat! Non-soulbound items were removed.",
    "note.bass"
  );

  clearCombat(player);

  system.runTimeout(() => {
    if (!player.isValid) return;
    try {
      restoreSoulboundAfterRespawn(player);
    } catch (e) {}
  }, 5);
}
