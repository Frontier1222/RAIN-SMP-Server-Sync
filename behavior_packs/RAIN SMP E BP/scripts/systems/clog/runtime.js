import { EquipmentSlot, ItemLockMode, ItemStack, system, world } from "@minecraft/server";
import { migrateReceivedRainGui, isRainGuiItem } from "../../utils/rainGui.js";
import { isSoulboundItem } from "../../utils/soulboundGrave.js";
import { notify } from "../../utils/realmPerf.js";
import { COMBAT_UNTIL_KEY, clearCombat as clearCombatState } from "../../utils/teleport.js";

const PENDING_CLEAR_KEY = "nf.clog.pending_death.v2";
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
    playerId: snap.playerId,
    dimId: snap.dimId,
    location: snap.location,
    combatUntil: snap.combatUntil,
    droppedOnLeave: !!snap.droppedOnLeave,
    items: (snap.items || []).map((entry) => ({
      kind: entry.kind,
      slot: entry.slot,
      data: entry.data || serializeSnapshotItem(entry),
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
    playerId: raw.playerId,
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
  const drop = cloneItem(item);
  if (!drop) return null;
  try {
    drop.keepOnDeath = false;
  } catch (e) {}
  try {
    drop.lockMode = ItemLockMode.none;
  } catch (e) {}
  return drop;
}

function getInventoryContainer(player) {
  return player?.getComponent("minecraft:inventory")?.container
    ?? player?.getComponent("inventory")?.container;
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

function dropSnapshotItemsDetailed(snap) {
  if (!snap?.items?.length || !snap.location) return { dropped: 0, remaining: [] };

  let dim;
  try {
    dim = world.getDimension(snap.dimId || "minecraft:overworld");
  } catch (e) {
    return { dropped: 0, remaining: snap.items };
  }

  let dropped = 0;
  const remaining = [];
  for (const entry of snap.items) {
    const raw = entry?.data || serializeSnapshotItem(entry);
    const source = entry?.item || deserializeSnapshotItem(raw);
    const stack = cloneForDrop(source);
    if (!stack || !shouldDropCombatLogItem(stack)) continue;

    try {
      dim.spawnItem(stack, spreadDropLocation(snap.location, dropped));
      dropped++;
    } catch (e) {
      remaining.push(entry);
    }
  }

  return { dropped, remaining };
}

function dropSnapshotItems(snap) {
  return dropSnapshotItemsDetailed(snap).dropped;
}

function snapshotDropCount(snap) {
  return Array.isArray(snap?.items)
    ? snap.items.filter((entry) => {
        if (entry?.item) return shouldDropCombatLogItem(entry.item);
        const raw = entry?.data || serializeSnapshotItem(entry);
        if (!raw?.typeId) return false;
        const stack = deserializeSnapshotItem(raw);
        return !!stack && shouldDropCombatLogItem(stack);
      }).length
    : 0;
}

function getSnapshotDropTotals(snap) {
  const totals = new Map()
  for (const entry of snap?.items || []) {
    const raw = entry?.data || serializeSnapshotItem(entry)
    const stack = entry?.item ? entry.item : deserializeSnapshotItem(raw)
    if (!stack || !shouldDropCombatLogItem(stack)) continue
    const typeId = String(stack.typeId || "")
    if (!typeId) continue
    totals.set(typeId, (totals.get(typeId) || 0) + Math.max(1, Number(stack.amount) || 1))
  }
  return totals
}

function hasDroppedSnapshotItems(snap) {
  const expected = getSnapshotDropTotals(snap)
  if (!expected.size || !snap?.location) return false

  let dimension
  try {
    dimension = world.getDimension(snap.dimId || "minecraft:overworld")
  } catch (e) {
    return false
  }

  const found = new Map()
  try {
    dimension.getEntities({
      location: snap.location,
      maxDistance: 8,
      type: "minecraft:item",
    }).forEach(entity => {
      const stack = entity.getComponent("minecraft:item")?.itemStack
      if (!stack?.typeId) return
      found.set(stack.typeId, (found.get(stack.typeId) || 0) + Math.max(1, Number(stack.amount) || 1))
    })
  } catch (e) {
    return false
  }

  for (const [typeId, amount] of expected) {
    if ((found.get(typeId) || 0) < amount) return false
  }
  return true
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

  const container = getInventoryContainer(player);
  if (container) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item || isRainGuiItem(item) || isSoulboundItem(item)) continue;
      try {
        container.setItem(i, undefined);
      } catch (e) {}
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
      if (!item || isRainGuiItem(item) || isSoulboundItem(item)) continue;
      try {
        eq.setEquipment(slot, undefined);
      } catch (e) {}
    }
  }
}

function schedulePendingInventoryWipe(player) {
  clearNonSoulboundInventory(player);
  for (const delay of [1, 2, 5, 10, 20, 40, 80]) {
    system.runTimeout(() => {
      if (!player?.isValid) return;
      clearNonSoulboundInventory(player);
    }, delay);
  }
}

function snapshotEntryStack(entry) {
  const raw = entry?.data || serializeSnapshotItem(entry)
  return entry?.item || deserializeSnapshotItem(raw)
}

function snapshotStackMatches(current, expected) {
  if (!current || !expected || current.typeId !== expected.typeId) return false
  if ((current.nameTag || "") !== (expected.nameTag || "")) return false
  try {
    const currentLore = current.getLore?.() || []
    const expectedLore = expected.getLore?.() || []
    if (JSON.stringify(currentLore) !== JSON.stringify(expectedLore)) return false
  } catch (e) {}
  return true
}

function removeSnapshotAmount(container, slot, current, expected) {
  const amount = Math.max(1, Number(expected.amount) || 1)
  if ((Number(current.amount) || 1) <= amount) {
    container.setItem(slot, undefined)
    return
  }
  const remainder = cloneItem(current)
  remainder.amount = current.amount - amount
  container.setItem(slot, remainder)
}

function clearDroppedSnapshotItems(player, snap) {
  if (!player?.isValid || !snap?.items?.length) return
  const container = getInventoryContainer(player)
  const equippable = player.getComponent("minecraft:equippable")

  for (const entry of snap.items) {
    const expected = snapshotEntryStack(entry)
    if (!expected || !shouldDropCombatLogItem(expected)) continue

    try {
      if (entry.kind === "inv" && container) {
        const current = container.getItem(entry.slot)
        if (snapshotStackMatches(current, expected)) {
          removeSnapshotAmount(container, entry.slot, current, expected)
        }
      } else if (entry.kind === "equip" && equippable) {
        const current = equippable.getEquipment(entry.slot)
        if (snapshotStackMatches(current, expected)) {
          equippable.setEquipment(entry.slot, undefined)
        }
      }
    } catch (e) {}
  }
}

function scheduleVerifiedInventoryWipe(player, snap) {
  let firstVerificationPassed = false
  system.runTimeout(() => {
    if (!player?.isValid) return
    firstVerificationPassed = hasDroppedSnapshotItems(snap)
  }, 10)
  system.runTimeout(() => {
    if (!player?.isValid || !firstVerificationPassed || !hasDroppedSnapshotItems(snap)) return
    clearDroppedSnapshotItems(player, snap)
  }, 40)
}

function dropAndClearPlayerInventoryAtLocation(player, dimId, location) {
  if (!player?.isValid || !location) return 0;

  let dim;
  try {
    dim = world.getDimension(dimId);
  } catch (e) {
    dim = player.dimension;
  }

  let dropped = 0;

  const container = getInventoryContainer(player);
  if (container) {
    for (let i = 0; i < container.size; i++) {
      let item = container.getItem(i);
      if (!item || !shouldDropCombatLogItem(item)) continue;

      if (item.lockMode !== ItemLockMode.none) {
        try {
          const unlocked = cloneItem(item);
          unlocked.lockMode = ItemLockMode.none;
          container.setItem(i, unlocked);
          item = unlocked;
        } catch (e) {
          continue;
        }
      }

      const dropItem = cloneForDrop(item);
      if (!dropItem) continue;
      let itemEntity;
      try {
        itemEntity = dim.spawnItem(dropItem, spreadDropLocation(location, dropped));
      } catch (e) {
        continue;
      }
      try {
        itemEntity?.addTag("rain_combat_log_drop");
      } catch (e) {}
      try {
        container.setItem(i, undefined);
        dropped++;
      } catch (e) {
        try {
          itemEntity?.remove();
        } catch (removeError) {}
      }
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
    ];
    for (const slot of slots) {
      let item = eq.getEquipment(slot);
      if (!item || !shouldDropCombatLogItem(item)) continue;

      if (item.lockMode !== ItemLockMode.none) {
        try {
          const unlocked = cloneItem(item);
          unlocked.lockMode = ItemLockMode.none;
          eq.setEquipment(slot, unlocked);
          item = unlocked;
        } catch (e) {
          continue;
        }
      }

      const dropItem = cloneForDrop(item);
      if (!dropItem) continue;
      let itemEntity;
      try {
        itemEntity = dim.spawnItem(dropItem, spreadDropLocation(location, dropped));
      } catch (e) {
        continue;
      }
      try {
        itemEntity?.addTag("rain_combat_log_drop");
      } catch (e) {}
      try {
        eq.setEquipment(slot, undefined);
        dropped++;
      } catch (e) {
        try {
          itemEntity?.remove();
        } catch (removeError) {}
      }
    }
  }

  return dropped;
}

function buildCombatSnapshot(player, until) {
  return {
    name: player.name,
    playerId: player.id,
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
  let eventPlayerId = String(ev.playerId ?? "");
  let name = String(ev.playerName ?? "");
  try {
    if (!eventPlayerId) eventPlayerId = String(player?.id ?? "");
    if (!name) name = String(player?.name ?? "");
  } catch (e) {}

  let snap = name ? snapshotsByName.get(name) : null;
  if (!snap && eventPlayerId) {
    for (const [snapshotName, candidate] of snapshotsByName) {
      if (String(candidate?.playerId ?? "") === eventPlayerId) {
        name = snapshotName;
        snap = candidate;
        break;
      }
    }
  }
  if (!name || !snap) return;

  const pending = getPendingSet();
  if (pending.has(name)) return;

  try {
    if (player?.isValid) {
      const until = readCombatUntil(player);
      if (until && until > Date.now()) {
        snap = buildCombatSnapshot(player, until);
        snapshotsByName.set(name, snap);
      }
    }
  } catch (e) {}

  const now = Date.now();
  if (!snap.combatUntil || now > snap.combatUntil) return;

  snapshotsByName.delete(name);
  deletePendingSnapshot(name);

  pending.add(name);
  setPendingSet(pending);

  // Kill while the leaving player entity still exists. Essentials handles the
  // death inventory and vanilla item drops from this point.
  let playerIsValid = false;
  try {
    playerIsValid = !!player?.isValid;
  } catch (e) {}
  if (!playerIsValid) return;

  try {
    if (player.kill() !== false) return;
  } catch (e) {}

  system.run(() => {
    try {
      if (!player?.isValid) return;
    } catch (e) {
      return;
    }
    try {
      player.kill();
    } catch (e) {
      try {
        player.runCommand("kill @s");
      } catch (commandError) {}
    }
  });
}

export function onPlayerSpawn(ev) {
  const player = ev.player;

  if (ev.initialSpawn) {
    migrateReceivedRainGui(player);
  }

  const pending = getPendingSet();
  if (!pending.has(player.name)) return;

  pending.delete(player.name);
  setPendingSet(pending);
  deletePendingSnapshot(player.name);

  notify(
    player,
    "clog_death",
    "§r§c§l[COMBAT LOG]§r",
    "§cYou logged out during combat and were killed.",
    "note.bass"
  );

  clearCombat(player);
  system.runTimeout(() => {
    if (!player?.isValid) return;
    try {
      player.kill();
    } catch (e) {
      try {
        player.runCommand("kill @s");
      } catch (commandError) {}
    }
  }, 1);
}
