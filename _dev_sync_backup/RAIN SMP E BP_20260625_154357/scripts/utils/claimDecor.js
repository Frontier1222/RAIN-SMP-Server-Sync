import { BlockPermutation, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { findPlayerPermRecord, isClaimPermAllowed, hasTesterSurvivalBuildBypass } from "./claimPermissions.js";
import { isTester } from "./creativeRoleGuard.js";
import { getRealmPlayerById, registerRealmHook, REALM_STAGGER } from "./realmPerf.js";

const FRAME_RESTORE_TICKS = [0, 1, 2, 3, 5, 8, 13, 21];
const FRAME_SNAPSHOT_TTL = 80;
const ENFORCE_DENY_COOLDOWN_TICKS = 8;
const SWING_SNAPSHOT_COOLDOWN = 2;
const GUARD_BATCH_PER_TICK = 24;

const DECOR_EQUIP_SLOTS = [
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Mainhand,
    EquipmentSlot.Offhand,
];

const pendingDecorRestore = new Map();
const pendingFrameRestore = new Map();
const pendingEntityInteractRestore = new Map();
const decorTheftWatches = new Map();
/** entityId -> { snap, playerId, untilTick } — fast restore for entity item frames */
const protectedEntityFrameGuards = new Map();
/** entityId -> { snap, playerId, untilTick } — respawn broken armor stands */
const protectedArmorStandGuards = new Map();
const pendingArmorStandRestore = new Map();
const denyCooldowns = new Map();
const swingSnapshotCooldown = new Map();

function scheduleRestoreJob(_key, runner, delays = FRAME_RESTORE_TICKS) {
    for (const delay of delays) {
        system.runTimeout(() => {
            try {
                runner();
            } catch (e) {}
        }, delay);
    }
}

function canShowDecorDeny(key) {
    const now = system.currentTick;
    const until = denyCooldowns.get(key) ?? 0;
    if (until > now) return false;
    denyCooldowns.set(key, now + ENFORCE_DENY_COOLDOWN_TICKS);
    return true;
}

export function canSnapshotDecorSwing(playerId) {
    const now = system.currentTick;
    const last = swingSnapshotCooldown.get(playerId) ?? 0;
    if (now - last < SWING_SNAPSHOT_COOLDOWN) return false;
    swingSnapshotCooldown.set(playerId, now);
    return true;
}

function getBlockKey(location, dimensionId) {
    return `${Math.floor(location.x)}:${Math.floor(location.y)}:${Math.floor(location.z)}:${dimensionId}`;
}

function getItemFrameContainer(block) {
    if (!block) return null;

    for (const id of ["minecraft:inventory", "inventory"]) {
        try {
            const comp = block.getComponent(id);
            if (comp?.container) return comp.container;
        } catch (e) {}
    }

    try {
        const components = block.getComponents?.() ?? [];
        for (const comp of components) {
            if (comp?.container) return comp.container;
        }
    } catch (e) {}

    return null;
}

function cloneItemStack(item) {
    if (!item?.typeId) return undefined;

    try {
        if (typeof item.clone === "function") return item.clone();
        return new ItemStack(item.typeId, item.amount);
    } catch (e) {
        return undefined;
    }
}

function readFrameItemFromBlock(block, permutation) {
    try {
        const fromContainer = getItemFrameContainer(block)?.getItem(0);
        if (fromContainer) return fromContainer;
    } catch (e) {}

    for (const slot of [0, 1]) {
        try {
            const fromPerm = permutation?.getItemStack?.(slot, true);
            if (fromPerm) return fromPerm;
        } catch (e) {}

        try {
            const fromBlock = block?.getItemStack?.(slot, true);
            if (fromBlock) return fromBlock;
        } catch (e) {}
    }

    try {
        return block?.getItemStack?.();
    } catch (e) {}

    return undefined;
}

function writeFrameItemToBlock(block, itemStack, states) {
    if (!block?.isValid || !isItemFrameBlock(block.typeId)) return false;

    const stateCopy = { ...(states ?? block.permutation.getAllStates?.() ?? {}) };

    try {
        let perm = BlockPermutation.resolve(block.typeId, stateCopy);
        if (itemStack && typeof perm.withItem === "function") {
            for (const slot of [0, 1]) {
                try {
                    perm = perm.withItem(itemStack, slot);
                    break;
                } catch (e) {}
            }
        }
        block.setPermutation(perm);
    } catch (e) {}

    try {
        getItemFrameContainer(block)?.setItem(0, itemStack ?? undefined);
    } catch (e) {}

    if (!itemStack) return true;

    const readBack = readFrameItemFromBlock(block, block.permutation);
    if (readBack?.typeId === itemStack.typeId) return true;

    return writeFrameItemViaBlockCommand(block, itemStack);
}

function writeFrameItemViaBlockCommand(block, itemStack) {
    if (!block?.isValid || !itemStack?.typeId) return false;

    const dim = block.dimension;
    const loc = block.location;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    const item = itemStack.typeId.replace("minecraft:", "");
    const amount = Math.max(1, itemStack.amount | 0);
    const slots = ["slot.container 0", "slot.weapon.offhand 0", "slot.weapon.mainhand 0"];

    for (const slot of slots) {
        try {
            dim.runCommand(`replaceitem block ${x} ${y} ${z} ${slot} ${item} ${amount}`);
            const readBack = readFrameItemFromBlock(block, block.permutation);
            if (readBack?.typeId === itemStack.typeId) return true;
        } catch (e) {}
    }

    return false;
}

export function isItemFrameBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return id === "minecraft:frame" || id === "minecraft:glow_frame";
}

function mergeEntityFrameSnapshots(prev, next) {
    if (!prev) return next;
    if (!next) return prev;
    return {
        ...next,
        entityId: next.entityId || prev.entityId,
        typeId: next.typeId || prev.typeId,
        dimensionId: next.dimensionId || prev.dimensionId,
        location: next.location || prev.location,
        frameItem: next.frameItem || prev.frameItem,
    };
}

function sameDecorWatch(watch, entityId, mode) {
    return watch?.mode === mode && watch?.entityId === entityId;
}

function getEntityItemFrameComponent(entity) {
    if (!entity?.isValid) return null;

    for (const id of [
        "minecraft:item_frame",
        "minecraft:glow_item_frame",
        "item_frame",
        "glow_item_frame",
    ]) {
        try {
            const comp = entity.getComponent(id);
            if (comp) return comp;
        } catch (e) {}
    }

    return null;
}

function entityFrameItemMatches(entity, expectedItem) {
    const current = readFrameItemFromEntity(entity);
    if (!expectedItem?.typeId) return !!current;
    return current?.typeId === expectedItem.typeId;
}

export function isEntityItemFrame(entityId) {
    const id = String(entityId || "").toLowerCase();
    return id === "minecraft:item_frame" || id === "minecraft:glow_item_frame";
}

export function isArmorStandEntity(entityId) {
    return String(entityId || "").toLowerCase() === "minecraft:armor_stand";
}

function mergeArmorStandSnapshots(prev, next) {
    if (!prev) return next;
    if (!next) return prev;

    const equipment = { ...(prev.equipment || {}) };
    for (const slot of DECOR_EQUIP_SLOTS) {
        if (next.equipment?.[slot]) {
            equipment[slot] = next.equipment[slot];
        }
    }

    return {
        ...next,
        entityId: next.entityId || prev.entityId,
        typeId: next.typeId || prev.typeId,
        dimensionId: next.dimensionId || prev.dimensionId,
        location: next.location || prev.location,
        equipment,
    };
}

function findArmorStand(snapshot) {
    if (!snapshot) return null;

    if (snapshot.entityId) {
        try {
            const entity = world.getEntity(snapshot.entityId);
            if (entity?.isValid && isArmorStandEntity(entity.typeId)) return entity;
        } catch (e) {}
    }

    try {
        const dim = world.getDimension(snapshot.dimensionId || "minecraft:overworld");
        return dim.getEntities({
            type: "minecraft:armor_stand",
            location: snapshot.location,
            maxDistance: 1.5,
        })?.[0] ?? null;
    } catch (e) {
        return null;
    }
}

function readArmorStandEquipment(entity) {
    const equipment = {};
    if (!entity?.isValid || !isArmorStandEntity(entity.typeId)) return equipment;

    try {
        const eq = entity.getComponent("minecraft:equippable");
        if (!eq) return equipment;
        for (const slot of DECOR_EQUIP_SLOTS) {
            const item = eq.getEquipment(slot);
            if (item) equipment[slot] = item;
        }
    } catch (e) {}

    return equipment;
}

function armorStandEquipmentDiffers(entity, snapshot) {
    if (!entity?.isValid || !snapshot) return false;

    try {
        const eq = entity.getComponent("minecraft:equippable");
        if (!eq) return false;

        for (const slot of DECOR_EQUIP_SLOTS) {
            const expected = snapshot.equipment?.[slot];
            const current = eq.getEquipment(slot);
            const expectedId = expected?.typeId || null;
            const currentId = current?.typeId || null;
            if (expectedId !== currentId) return true;
            if (expected && current && expected.amount !== current.amount) return true;
        }
    } catch (e) {
        return true;
    }

    return false;
}

/** Remove item drops from armor-stand theft (prevents dupes). */
export function vacuumArmorStandTheftDrops(snapshot, player) {
    if (!snapshot?.location) return;

    try {
        const dim = world.getDimension(snapshot.dimensionId || "minecraft:overworld");
        const loc = snapshot.location;

        removeDroppedTheftNear(loc, dim, { typeId: "minecraft:armor_stand", amount: 1 });

        for (const slot of DECOR_EQUIP_SLOTS) {
            const item = snapshot.equipment?.[slot];
            if (item) removeDroppedTheftNear(loc, dim, item);
        }

        const drops = dim.getEntities({
            type: "minecraft:item",
            location: loc,
            maxDistance: 2.5,
        });

        for (const drop of drops ?? []) {
            const stack = drop.getComponent("minecraft:item")?.itemStack;
            if (!stack?.typeId) continue;

            if (stack.typeId === "minecraft:armor_stand") {
                drop.remove();
                if (player) reclaimArmorStandDropFromPlayer(player);
                continue;
            }

            for (const slot of DECOR_EQUIP_SLOTS) {
                const expected = snapshot.equipment?.[slot];
                if (!expected || stack.typeId !== expected.typeId) continue;
                drop.remove();
                if (player) reclaimDecorItemFromPlayer(player, stack);
            }
        }
    } catch (e) {}
}

export function applyArmorStandEquipmentRestore(snapshot, player) {
    if (!snapshot || !isArmorStandEntity(snapshot.typeId)) return false;

    const entity = findArmorStand(snapshot);
    if (!entity?.isValid) return applyArmorStandRestore(snapshot, player);

    try {
        const eq = entity.getComponent("minecraft:equippable");
        if (!eq) return false;

        let restored = false;
        for (const slot of DECOR_EQUIP_SLOTS) {
            const expected = snapshot.equipment?.[slot];
            const current = eq.getEquipment(slot);
            const expectedId = expected?.typeId || null;
            const currentId = current?.typeId || null;

            if (expectedId !== currentId || (expected && current && expected.amount !== current.amount)) {
                if (expected) {
                    eq.setEquipment(slot, expected);
                    if (player) reclaimDecorItemFromPlayer(player, expected);
                    removeDroppedTheftNear(entity.location, entity.dimension, expected);
                } else if (current && player) {
                    reclaimDecorItemFromPlayer(player, current);
                    eq.setEquipment(slot, undefined);
                }
                restored = true;
            }
        }

        registerProtectedArmorStandGuard(entity, player, {
            ...snapshot,
            entityId: entity.id,
        });

        return restored;
    } catch (e) {
        return false;
    }
}

function reclaimArmorStandDropFromPlayer(player) {
    if (!player) return;

    try {
        const inv = player.getComponent("minecraft:inventory")?.container
            || player.getComponent("inventory")?.container;
        if (!inv) return;

        for (let i = 0; i < inv.size; i++) {
            const stack = inv.getItem(i);
            if (stack?.typeId !== "minecraft:armor_stand") continue;
            inv.setItem(i, undefined);
            return;
        }
    } catch (e) {}
}

function applyArmorStandRestore(snapshot, player) {
    if (!snapshot || !isArmorStandEntity(snapshot.typeId)) return false;

    const existing = findArmorStand(snapshot);
    if (existing?.isValid) {
        return applyArmorStandEquipmentRestore(snapshot, player);
    }

    try {
        const dim = world.getDimension(snapshot.dimensionId || "minecraft:overworld");
        const loc = snapshot.location;

        const entity = dim.spawnEntity("minecraft:armor_stand", loc);

        if (!entity?.isValid) return false;

        const eq = entity.getComponent("minecraft:equippable");
        if (eq) {
            for (const slot of DECOR_EQUIP_SLOTS) {
                const item = snapshot.equipment?.[slot];
                if (!item) continue;
                eq.setEquipment(slot, item);
                if (player) reclaimDecorItemFromPlayer(player, item);
            }
        }

        if (player) {
            reclaimArmorStandDropFromPlayer(player);
            removeDroppedTheftNear(loc, dim, { typeId: "minecraft:armor_stand", amount: 1 });
        }

        if (snapshot.entityId && snapshot.entityId !== entity.id) {
            protectedArmorStandGuards.delete(snapshot.entityId);
        }

        registerProtectedArmorStandGuard(entity, player, {
            ...snapshot,
            entityId: entity.id,
        });

        return true;
    } catch (e) {
        return false;
    }
}

export function queueArmorStandRestore(entity) {
    const snap = snapshotDecorEntity(entity);
    if (!snap || !entity?.id) return snap;

    const merged = mergeArmorStandSnapshots(pendingArmorStandRestore.get(entity.id), snap);
    pendingArmorStandRestore.set(entity.id, merged);
    system.runTimeout(() => {
        if (pendingArmorStandRestore.get(entity.id) === merged) {
            pendingArmorStandRestore.delete(entity.id);
        }
    }, FRAME_SNAPSHOT_TTL);

    return merged;
}

export function peekPendingArmorStandRestore(entityId) {
    return pendingArmorStandRestore.get(entityId);
}

/** Trusted break / intentional removal — stop auto-respawn loops. */
export function clearArmorStandRestoreState(entityId) {
    if (!entityId) return;
    pendingArmorStandRestore.delete(entityId);
    protectedArmorStandGuards.delete(entityId);
    pendingDecorRestore.delete(entityId);
    for (const [playerId, watch] of [...decorTheftWatches.entries()]) {
        if (watch?.entityId === entityId && watch?.mode === "armor_stand") {
            decorTheftWatches.delete(playerId);
        }
    }
}

export function registerProtectedArmorStandGuard(entity, player, snap) {
    if (!snap) return;

    const entityId = entity?.id || snap.entityId;
    if (!entityId) return;

    const merged = mergeArmorStandSnapshots(
        protectedArmorStandGuards.get(entityId)?.snap,
        snap
    );

    protectedArmorStandGuards.set(entityId, {
        snap: merged,
        playerId: player?.id,
        untilTick: system.currentTick + FRAME_SNAPSHOT_TTL,
    });
    ensureDecorGuardLoop();
}

export function registerArmorStandBreakWatch(player, entity, plot) {
    if (!player?.id || !entity?.isValid || !isArmorStandEntity(entity.typeId)) return;

    const prevWatch = decorTheftWatches.get(player.id);
    const prevSnap = sameDecorWatch(prevWatch, entity.id, "armor_stand") ? prevWatch.snap : null;
    const liveSnap = snapshotDecorEntity(entity);
    const snap = mergeArmorStandSnapshots(
        mergeArmorStandSnapshots(prevSnap, peekPendingArmorStandRestore(entity.id)),
        liveSnap
    ) || {
        typeId: entity.typeId,
        entityId: entity.id,
        location: { x: entity.location.x, y: entity.location.y, z: entity.location.z },
        dimensionId: entity.dimension.id,
        equipment: {},
    };

    registerProtectedArmorStandGuard(entity, player, snap);

    decorTheftWatches.set(player.id, {
        mode: "armor_stand",
        snap,
        entityId: entity.id,
        location: { x: entity.location.x, y: entity.location.y, z: entity.location.z },
        dimensionId: entity.dimension.id,
        plotName: plot?.name,
        untilTick: system.currentTick + FRAME_SNAPSHOT_TTL,
    });
    ensureDecorGuardLoop();
}

export function enforceProtectedArmorStand(player, entity, denyFn) {
    if (!player || !entity?.isValid || !isArmorStandEntity(entity.typeId)) return;

    const enforceKey = `stand:${player.id}:${entity.id}`;
    let snap = peekPendingArmorStandRestore(entity.id);
    snap = mergeArmorStandSnapshots(snap, snapshotDecorEntity(entity));

    if (snap) {
        registerProtectedArmorStandGuard(entity, player, snap);
        scheduleRestoreJob(enforceKey, () => {
            const stand = findArmorStand(snap);
            if (stand?.isValid) {
                if (armorStandEquipmentDiffers(stand, snap)) {
                    return applyArmorStandEquipmentRestore(snap, player);
                }
                return true;
            }
            return applyArmorStandRestore(snap, player);
        });
    }

    if (typeof denyFn === "function" && canShowDecorDeny(`${enforceKey}:deny`)) {
        denyFn(player);
    }
}

function tickProtectedArmorStandGuards(players) {
    if (!protectedArmorStandGuards.size) return;

    const now = system.currentTick;

    for (const [entityId, guard] of [...protectedArmorStandGuards.entries()]) {
        if (now > guard.untilTick) {
            protectedArmorStandGuards.delete(entityId);
            continue;
        }

        let entity;
        try {
            entity = world.getEntity(entityId);
        } catch (e) {
            entity = null;
        }

        if (entity?.isValid && isArmorStandEntity(entity.typeId)) {
            if (armorStandEquipmentDiffers(entity, guard.snap)) {
                const player = guard.playerId ? getRealmPlayerById(guard.playerId) : null;
                applyArmorStandEquipmentRestore(guard.snap, player);
            }
            continue;
        }

        const player = guard.playerId ? getRealmPlayerById(guard.playerId) : null;
        if (applyArmorStandRestore(guard.snap, player)) {
            protectedArmorStandGuards.delete(entityId);
        }
    }
}

function readFrameItemFromEntity(entity) {
    if (!entity?.isValid) return undefined;

    const frameComp = getEntityItemFrameComponent(entity);
    if (frameComp) {
        try {
            if (frameComp.item?.typeId) return frameComp.item;
        } catch (e) {}

        try {
            if (typeof frameComp.getItem === "function") {
                const item = frameComp.getItem();
                if (item?.typeId) return item;
            }
        } catch (e) {}
    }

    for (const id of [
        "minecraft:item_frame",
        "minecraft:glow_item_frame",
        "item_frame",
        "glow_item_frame",
    ]) {
        try {
            const comp = entity.getComponent(id);
            if (typeof comp?.getItem === "function") {
                const item = comp.getItem();
                if (item) return item;
            }
        } catch (e) {}
    }

    try {
        for (const comp of entity.getComponents?.() ?? []) {
            if (typeof comp?.getItem === "function") {
                const item = comp.getItem();
                if (item?.typeId) return item;
            }
            if (comp?.container?.size) {
                const item = comp.container.getItem(0);
                if (item) return item;
            }
        }
    } catch (e) {}

    try {
        const eq = entity.getComponent("minecraft:equippable");
        for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
            const item = eq?.getEquipment(slot);
            if (item) return item;
        }
    } catch (e) {}

    for (const id of ["minecraft:inventory", "inventory"]) {
        try {
            const item = entity.getComponent(id)?.container?.getItem(0);
            if (item) return item;
        } catch (e) {}
    }

    return undefined;
}

function writeFrameItemViaCommand(entity, itemStack) {
    if (!entity?.isValid || !itemStack?.typeId) return false;

    const dim = entity.dimension;
    const loc = entity.location;
    const type = entity.typeId.replace("minecraft:", "");
    const itemName = itemStack.typeId.replace("minecraft:", "");
    const amount = Math.max(1, itemStack.amount | 0);
    const x = loc.x.toFixed(2);
    const y = loc.y.toFixed(2);
    const z = loc.z.toFixed(2);

    const selfCommands = [
        `replaceitem entity @s slot.weapon.mainhand 0 ${itemName} ${amount}`,
        `item replace entity @s slot.weapon.mainhand 0 with ${itemStack.typeId} ${amount}`,
    ];

    for (const cmd of selfCommands) {
        try {
            entity.runCommand(cmd);
            if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
        } catch (e) {}
    }

    const selectorCommands = [
        `replaceitem entity @e[type=${type},x=${x},y=${y},z=${z},r=0.5,c=1] slot.weapon.mainhand 0 ${itemName} ${amount}`,
        `replaceitem entity @e[type=${type},x=${x},y=${y},z=${z},r=0.5,c=1] slot.armor.head 0 ${itemName} ${amount}`,
        `item replace entity @e[type=${type},x=${x},y=${y},z=${z},r=0.5,c=1] slot.weapon.mainhand 0 with ${itemStack.typeId} ${amount}`,
    ];

    for (const cmd of selectorCommands) {
        try {
            dim.runCommand(cmd);
            if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
        } catch (e) {}
    }

    return false;
}

function writeFrameItemToEntity(entity, itemStack) {
    if (!entity?.isValid || !isEntityItemFrame(entity.typeId)) return false;

    const frameComp = getEntityItemFrameComponent(entity);
    if (frameComp) {
        try {
            if ("item" in frameComp) {
                frameComp.item = itemStack ?? undefined;
                if (!itemStack) return !readFrameItemFromEntity(entity);
                if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
            }
        } catch (e) {}

        try {
            if (typeof frameComp.setItem === "function") {
                frameComp.setItem(itemStack ?? undefined);
                if (!itemStack) return !readFrameItemFromEntity(entity);
                if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
            }
        } catch (e) {}
    }

    for (const id of [
        "minecraft:item_frame",
        "minecraft:glow_item_frame",
        "item_frame",
        "glow_item_frame",
    ]) {
        try {
            const comp = entity.getComponent(id);
            if (typeof comp?.setItem === "function") {
                comp.setItem(itemStack ?? undefined);
                if (!itemStack) return !readFrameItemFromEntity(entity);
                if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
            }
        } catch (e) {}
    }

    try {
        for (const comp of entity.getComponents?.() ?? []) {
            if (typeof comp?.setItem === "function") {
                comp.setItem(itemStack ?? undefined);
                if (!itemStack) return !readFrameItemFromEntity(entity);
                if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
            }
        }
    } catch (e) {}

    try {
        const eq = entity.getComponent("minecraft:equippable");
        if (eq) {
            eq.setEquipment(EquipmentSlot.Mainhand, itemStack ?? undefined);
            if (!itemStack) return !readFrameItemFromEntity(entity);
            if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
        }
    } catch (e) {}

    for (const id of ["minecraft:inventory", "inventory"]) {
        try {
            const container = entity.getComponent(id)?.container;
            if (!container) continue;
            container.setItem(0, itemStack ?? undefined);
            if (!itemStack) return !readFrameItemFromEntity(entity);
            if (readFrameItemFromEntity(entity)?.typeId === itemStack.typeId) return true;
        } catch (e) {}
    }

    if (itemStack) return writeFrameItemViaCommand(entity, itemStack);
    return false;
}

function removeDroppedTheftNear(location, dimension, itemStack) {
    if (!location || !dimension || !itemStack?.typeId) return;

    try {
        const drop = dimension.getEntities({
            type: "minecraft:item",
            location,
            maxDistance: 1.5,
        })?.[0];

        const stack = drop?.getComponent("minecraft:item")?.itemStack;
        if (stack?.typeId === itemStack.typeId) drop.remove();
    } catch (e) {}
}

function removeDroppedTheftNearFrame(entity, itemStack) {
    if (!entity?.isValid || !itemStack?.typeId) return;
    removeDroppedTheftNear(entity.location, entity.dimension, itemStack);
}

function findEntityItemFrame(snapshot) {
    if (!snapshot) return null;

    if (snapshot.entityId) {
        try {
            const entity = world.getEntity(snapshot.entityId);
            if (entity?.isValid && isEntityItemFrame(entity.typeId)) return entity;
        } catch (e) {}
    }

    try {
        const dim = world.getDimension(snapshot.dimensionId || "minecraft:overworld");
        for (const typeId of [snapshot.typeId, "minecraft:item_frame", "minecraft:glow_item_frame"]) {
            if (!typeId) continue;
            const matches = dim.getEntities({
                type: typeId,
                location: snapshot.location,
                maxDistance: 1.5,
            });
            if (matches?.[0]?.isValid) return matches[0];
        }
    } catch (e) {}

    return null;
}

export function registerProtectedEntityFrameGuard(entity, player, snap) {
    if (!entity?.id || !snap) return;

    const merged = mergeEntityFrameSnapshots(
        protectedEntityFrameGuards.get(entity.id)?.snap,
        snap
    );

    protectedEntityFrameGuards.set(entity.id, {
        snap: merged,
        playerId: player?.id,
        untilTick: system.currentTick + FRAME_SNAPSHOT_TTL,
    });
    ensureDecorGuardLoop();
}

function tickProtectedEntityFrameGuards(players) {
    if (!protectedEntityFrameGuards.size) return;

    const now = system.currentTick;

    for (const [entityId, guard] of [...protectedEntityFrameGuards.entries()]) {
        if (now > guard.untilTick) {
            protectedEntityFrameGuards.delete(entityId);
            continue;
        }

        let entity;
        try {
            entity = world.getEntity(entityId);
        } catch (e) {
            entity = null;
        }

        if (!entity?.isValid) {
            entity = findEntityItemFrame(guard.snap);
        }

        if (!entity?.isValid) continue;

        const current = readFrameItemFromEntity(entity);
        if (guard.snap?.frameItem) {
            if (!entityFrameItemMatches(entity, guard.snap.frameItem)) {
                const player = guard.playerId ? getRealmPlayerById(guard.playerId) : null;
                applyEntityItemFrameRestore(guard.snap, player);
            }
        } else if (!current) {
            const player = guard.playerId ? getRealmPlayerById(guard.playerId) : null;
            restoreEntityFrameTheftFromPlayer(player, entity);
        }
    }
}

/** Entities that hold display items (frames, stands, paintings). */
export function isDecorEntity(entityId) {
    const id = String(entityId || "").toLowerCase();
    return (
        id === "minecraft:armor_stand" ||
        id === "minecraft:item_frame" ||
        id === "minecraft:glow_item_frame" ||
        id === "minecraft:painting"
    );
}

function isFactionMember(plot, player) {
    if (!plot?.factionClaim || !plot.ownerId) return false;
    return player.getDynamicProperty("faction") === plot.ownerId;
}

function isListedGuest(plot, player) {
    const guests = plot?.permissions?.guests;
    if (!Array.isArray(guests)) return false;
    const name = player.name.toLowerCase();
    return guests.some((g) => String(g).toLowerCase() === name);
}

/** Owner, staff, faction mates, trusted players, and per-player allow entries. */
export function isClaimTrustedForDecor(plot, player) {
    if (!plot || !player) return false;
    if (plot.ownerId === player.id || plot.ownerName === player.name) return true;
    if (player.hasTag("staff") && !isTester(player)) return true;
    if (hasTesterSurvivalBuildBypass(plot, player)) return true;
    if (isFactionMember(plot, player)) return true;
    if (isListedGuest(plot, player)) return true;

    const pName = player.name.toLowerCase();

    if (Array.isArray(plot.members) && plot.members.map((n) => String(n).toLowerCase()).includes(pName)) {
        return true;
    }
    if (Array.isArray(plot.trusted) && plot.trusted.map((n) => String(n).toLowerCase()).includes(pName)) {
        return true;
    }

    if (plot.permissions?.players) {
        const record = findPlayerPermRecord(plot, player);
        if (record) {
            const pData = record.entry;
            if (pData === true) return true;

            if (typeof pData === "object") {
                if (pData.protectInteract === false || pData.decorations === true) return true;
            }
        }
    }

    return false;
}

/** Resolve the player responsible for decor damage (melee or projectile owner). */
export function getDecorDamagePlayer(damageSource) {
    if (!damageSource) return null;

    const direct = damageSource.damagingEntity;
    if (direct?.typeId === "minecraft:player") return direct;

    const owner = damageSource.damagingProjectile?.owner;
    if (owner?.typeId === "minecraft:player") return owner;

    return null;
}

/** Capture armor stand state so it can be re-spawned when Bedrock ignores event cancel. */
export function snapshotDecorEntity(entity) {
    if (!entity?.isValid) return null;

    const loc = entity.location;
    const snap = {
        typeId: entity.typeId,
        entityId: entity.id,
        location: { x: loc.x, y: loc.y, z: loc.z },
        dimensionId: entity.dimension.id,
        equipment: {},
        frameItem: undefined,
    };

    if (entity.typeId === "minecraft:armor_stand") {
        try {
            const eq = entity.getComponent("minecraft:equippable");
            if (eq) {
                for (const slot of DECOR_EQUIP_SLOTS) {
                    const item = eq.getEquipment(slot);
                    if (item) snap.equipment[slot] = cloneItemStack(item);
                }
            }
        } catch (e) {}
    }

    if (isEntityItemFrame(entity.typeId)) {
        snap.frameItem = cloneItemStack(readFrameItemFromEntity(entity));
    }

    return snap;
}

function applyEntityItemFrameRestore(snapshot, player) {
    const entity = findEntityItemFrame(snapshot);
    if (!entity) return false;

    const currentItem = readFrameItemFromEntity(entity);

    if (snapshot.frameItem) {
        if (currentItem?.typeId === snapshot.frameItem.typeId) {
            return true;
        }

        if (writeFrameItemToEntity(entity, snapshot.frameItem)) {
            if (player) reclaimDecorItemFromPlayer(player, snapshot.frameItem);
            removeDroppedTheftNearFrame(entity, snapshot.frameItem);
            return true;
        }

        if (player) {
            restoreEntityFrameTheftFromPlayer(player, entity, snapshot.frameItem);
            removeDroppedTheftNearFrame(entity, snapshot.frameItem);
        }

        return !!readFrameItemFromEntity(entity);
    }

    if (player) return restoreEntityFrameTheftFromPlayer(player, entity);
    return true;
}

export function restoreEntityFrameTheftFromPlayer(player, entity, expectedItem) {
    if (!player || !entity?.isValid || !isEntityItemFrame(entity.typeId)) return false;
    if (entityFrameItemMatches(entity, expectedItem)) return true;

    try {
        const inv = player.getComponent("minecraft:inventory")?.container
            || player.getComponent("inventory")?.container;
        if (!inv) return false;

        const guard = protectedEntityFrameGuards.get(entity.id);
        const expectedType = expectedItem?.typeId || guard?.snap?.frameItem?.typeId;

        const slots = [player.selectedSlotIndex];
        for (let i = 0; i < inv.size; i++) {
            if (!slots.includes(i)) slots.push(i);
        }

        if (expectedType) {
            for (const slot of slots) {
                const held = inv.getItem(slot);
                if (!held || held.typeId !== expectedType) continue;

                if (writeFrameItemToEntity(entity, held)) {
                    reclaimDecorItemFromPlayer(player, held);
                    removeDroppedTheftNearFrame(entity, held);
                    return true;
                }
            }
        }

        for (const slot of slots) {
            const held = inv.getItem(slot);
            if (!held) continue;

            if (writeFrameItemToEntity(entity, held)) {
                reclaimDecorItemFromPlayer(player, held);
                removeDroppedTheftNearFrame(entity, held);
                return true;
            }
        }
    } catch (e) {}

    return false;
}

export function enforceProtectedEntityFrame(player, entity, denyFn) {
    if (!player || !entity?.isValid || !isEntityItemFrame(entity.typeId)) return;

    const enforceKey = `entity:${player.id}:${entity.id}`;

    let snap = mergeEntityFrameSnapshots(
        peekPendingDecorEntityInteractRestore(entity.id),
        protectedEntityFrameGuards.get(entity.id)?.snap
    );
    snap = mergeEntityFrameSnapshots(snap, snapshotDecorEntity(entity));

    if (snap) {
        registerProtectedEntityFrameGuard(entity, player, snap);
        scheduleRestoreJob(enforceKey, () => applyEntityItemFrameRestore(snap, player));
    } else {
        scheduleRestoreJob(enforceKey, () => restoreEntityFrameTheftFromPlayer(player, entity));
    }

    if (typeof denyFn === "function" && canShowDecorDeny(`${enforceKey}:deny`)) {
        denyFn(player);
    }
}

export function restoreDecorEntity(snapshot, player) {
    if (!snapshot?.typeId || !snapshot.location) return;

    if (isEntityItemFrame(snapshot.typeId)) {
        const key = `decor:${snapshot.entityId || snapshot.typeId}:${Math.floor(snapshot.location.x)}:${Math.floor(snapshot.location.y)}:${Math.floor(snapshot.location.z)}`;
        scheduleRestoreJob(key, () => applyEntityItemFrameRestore(snapshot, player));
        return;
    }

    if (isArmorStandEntity(snapshot.typeId)) {
        const key = `stand:${snapshot.entityId || "armor_stand"}:${Math.floor(snapshot.location.x)}:${Math.floor(snapshot.location.y)}:${Math.floor(snapshot.location.z)}`;
        scheduleRestoreJob(key, () => applyArmorStandRestore(snapshot, player));
    }
}

export function queueDecorRestore(entityId, snapshot) {
    if (!entityId || !snapshot) return;
    pendingDecorRestore.set(entityId, snapshot);
    system.runTimeout(() => {
        if (pendingDecorRestore.get(entityId) === snapshot) {
            pendingDecorRestore.delete(entityId);
        }
    }, FRAME_SNAPSHOT_TTL);
}

export function takePendingDecorRestore(entityId) {
    const snap = pendingDecorRestore.get(entityId);
    if (snap) pendingDecorRestore.delete(entityId);
    return snap;
}

/** Snapshot item frame block contents (Bedrock block entity inventory + states). */
export function snapshotItemFrameBlock(block) {
    if (!block?.isValid || !isItemFrameBlock(block.typeId)) return null;

    const loc = block.location;
    const snap = {
        typeId: block.typeId,
        location: { x: loc.x, y: loc.y, z: loc.z },
        dimensionId: block.dimension.id,
        states: {},
        frameItem: undefined,
    };

    try {
        snap.states = { ...(block.permutation.getAllStates?.() ?? {}) };
    } catch (e) {}

    snap.frameItem = cloneItemStack(readFrameItemFromBlock(block, block.permutation));

    return snap;
}

function storeItemFrameSnapshot(snap) {
    if (!snap?.location) return;

    const key = getBlockKey(snap.location, snap.dimensionId);
    pendingFrameRestore.set(key, snap);
    system.runTimeout(() => {
        if (pendingFrameRestore.get(key) === snap) pendingFrameRestore.delete(key);
    }, FRAME_SNAPSHOT_TTL);
}

/** Build a frame snapshot from the permutation captured at hit time. */
export function snapshotItemFrameFromHit(permutation, block) {
    if (!block?.isValid || !isItemFrameBlock(block.typeId)) return null;

    const loc = block.location;
    return {
        typeId: String(permutation?.type?.id || block.typeId),
        location: { x: loc.x, y: loc.y, z: loc.z },
        dimensionId: block.dimension.id,
        states: { ...(permutation?.getAllStates?.() ?? {}) },
        frameItem: cloneItemStack(readFrameItemFromBlock(block, permutation)),
    };
}

export function queueItemFrameRestore(block) {
    const snap = snapshotItemFrameBlock(block);
    if (!snap) return;

    storeItemFrameSnapshot(snap);
    return snap;
}

/** Track a protected block frame so survival inventory changes can be reverted. */
export function registerFrameTheftWatch(player, block, plot) {
    if (!player?.id || !block?.isValid) return;

    const snap = snapshotItemFrameBlock(block) || {
        typeId: block.typeId,
        location: { x: block.location.x, y: block.location.y, z: block.location.z },
        dimensionId: block.dimension.id,
        states: { ...(block.permutation.getAllStates?.() ?? {}) },
        frameItem: undefined,
    };

    decorTheftWatches.set(player.id, {
        mode: "block",
        snap,
        location: { x: block.location.x, y: block.location.y, z: block.location.z },
        dimensionId: block.dimension.id,
        plotName: plot?.name,
        untilTick: system.currentTick + FRAME_SNAPSHOT_TTL,
    });
    ensureDecorGuardLoop();
}

/** Track a protected entity item frame for survival theft recovery. */
export function registerEntityFrameTheftWatch(player, entity, plot) {
    if (!player?.id || !entity?.isValid || !isEntityItemFrame(entity.typeId)) return;

    const prevWatch = decorTheftWatches.get(player.id);
    const prevSnap = sameDecorWatch(prevWatch, entity.id, "entity") ? prevWatch.snap : null;
    const liveSnap = snapshotDecorEntity(entity);
    const snap = mergeEntityFrameSnapshots(
        mergeEntityFrameSnapshots(prevSnap, peekPendingDecorEntityInteractRestore(entity.id)),
        liveSnap
    ) || {
        typeId: entity.typeId,
        entityId: entity.id,
        location: { x: entity.location.x, y: entity.location.y, z: entity.location.z },
        dimensionId: entity.dimension.id,
        frameItem: undefined,
    };

    registerProtectedEntityFrameGuard(entity, player, snap);

    decorTheftWatches.set(player.id, {
        mode: "entity",
        snap,
        entityId: entity.id,
        location: { x: entity.location.x, y: entity.location.y, z: entity.location.z },
        dimensionId: entity.dimension.id,
        plotName: plot?.name,
        untilTick: system.currentTick + FRAME_SNAPSHOT_TTL,
    });
    ensureDecorGuardLoop();
}

let decorGuardRot = 0;

function decorGuardsActive() {
    return (
        decorTheftWatches.size > 0 ||
        protectedEntityFrameGuards.size > 0 ||
        protectedArmorStandGuards.size > 0
    );
}

/** Decor frame/stand guard — staggered on the master loop (not every aux tick). */
export function tickDecorGuardRealm(players) {
    if (!decorGuardsActive()) return;

    tickDecorTheftWatches(players);
    tickProtectedEntityFrameGuards(players);
    tickProtectedArmorStandGuards(players);
}

/** Guards are polled by tickDecorGuardRealm — no separate interval. */
function ensureDecorGuardLoop() {}

function tickDecorTheftWatches(players) {
    if (!decorTheftWatches.size) return;

    const now = system.currentTick;
    let processed = 0;
    const entries = [...decorTheftWatches.entries()];

    for (let i = 0; i < entries.length && processed < GUARD_BATCH_PER_TICK; i++) {
        decorGuardRot = (decorGuardRot + 1) % Math.max(entries.length, 1);
        const [playerId, watch] = entries[decorGuardRot];

        if (now > watch.untilTick) {
            decorTheftWatches.delete(playerId);
            continue;
        }

        const player = getRealmPlayerById(playerId);
        if (!player) continue;

        processed++;

        if (watch.mode === "block") {
            try {
                const dim = world.getDimension(watch.dimensionId || "minecraft:overworld");
                const block = dim.getBlock(watch.location);
                if (!block?.isValid || !isItemFrameBlock(block.typeId)) {
                    decorTheftWatches.delete(playerId);
                    continue;
                }

                const current = readFrameItemFromBlock(block, block.permutation);
                if (watch.snap?.frameItem) {
                    if (current?.typeId === watch.snap.frameItem.typeId) {
                        decorTheftWatches.delete(playerId);
                    } else if (!current || current.typeId !== watch.snap.frameItem.typeId) {
                        applyItemFrameRestore(watch.snap, player);
                    }
                } else if (!current) {
                    restoreFrameTheftFromPlayer(player, block);
                }
            } catch (e) {}
            continue;
        }

        if (watch.mode === "entity") {
            let entity;
            try {
                entity = watch.entityId ? world.getEntity(watch.entityId) : null;
            } catch (e) {
                entity = null;
            }
            if (!entity?.isValid) {
                entity = findEntityItemFrame(watch.snap);
            }
            if (!entity) continue;

            const current = readFrameItemFromEntity(entity);
            if (watch.snap?.frameItem) {
                if (!entityFrameItemMatches(entity, watch.snap.frameItem)) {
                    applyEntityItemFrameRestore(watch.snap, player);
                }
            } else if (!readFrameItemFromEntity(entity)) {
                restoreEntityFrameTheftFromPlayer(player, entity, watch.snap?.frameItem);
            }
            continue;
        }

        if (watch.mode === "armor_stand") {
            let entity;
            try {
                entity = watch.entityId ? world.getEntity(watch.entityId) : null;
            } catch (e) {
                entity = null;
            }

            if (!entity?.isValid) {
                entity = findArmorStand(watch.snap);
            }

            if (entity?.isValid && isArmorStandEntity(entity.typeId)) {
                if (armorStandEquipmentDiffers(entity, watch.snap)) {
                    applyArmorStandEquipmentRestore(watch.snap, player);
                }
                continue;
            }

            applyArmorStandRestore(watch.snap, player);
            continue;
        }
    }
}


export function handleFrameTheftInventoryChange(player, itemStack, beforeItemStack) {
    const watch = decorTheftWatches.get(player?.id);
    if (!watch) return;

    if (system.currentTick > watch.untilTick) {
        decorTheftWatches.delete(player.id);
        return;
    }

    if (!itemStack) return;
    if (beforeItemStack?.typeId === itemStack.typeId && beforeItemStack?.amount === itemStack.amount) return;

    try {
        if (watch.mode === "entity") {
            const entity = findEntityItemFrame(watch.snap ?? watch);
            if (!entity) return;

            if (entityFrameItemMatches(entity, watch.snap?.frameItem)) {
                decorTheftWatches.delete(player.id);
                return;
            }

            if (watch.snap) {
                applyEntityItemFrameRestore(watch.snap, player);
            } else {
                restoreEntityFrameTheftFromPlayer(player, entity, watch.snap?.frameItem);
            }

            return;
        }

        if (watch.mode === "armor_stand") {
            let entity;
            try {
                entity = watch.entityId ? world.getEntity(watch.entityId) : null;
            } catch (e) {
                entity = null;
            }

            if (entity?.isValid && isArmorStandEntity(entity.typeId)) {
                applyArmorStandEquipmentRestore(watch.snap, player);
                return;
            }

            applyArmorStandRestore(watch.snap, player);
            decorTheftWatches.delete(player.id);
            return;
        }

        const dim = world.getDimension(watch.dimensionId || "minecraft:overworld");
        const block = dim.getBlock(watch.location);
        if (!block?.isValid || !isItemFrameBlock(block.typeId)) return;

        const frameItem = readFrameItemFromBlock(block, block.permutation);
        if (frameItem) {
            decorTheftWatches.delete(player.id);
            return;
        }

        if (watch.snap) {
            restoreItemFrameBlock(watch.snap, player);
        } else {
            restoreFrameTheftFromPlayer(player, block);
        }

        decorTheftWatches.delete(player.id);
    } catch (e) {}
}

export function takePendingItemFrameRestore(location, dimensionId) {
    const key = getBlockKey(location, dimensionId);
    const snap = pendingFrameRestore.get(key);
    if (snap) pendingFrameRestore.delete(key);
    return snap;
}

function reclaimDecorItemFromPlayer(player, itemStack) {
    if (!player || !itemStack?.typeId) return;

    try {
        const inv = player.getComponent("minecraft:inventory")?.container
            || player.getComponent("inventory")?.container;
        if (!inv) return;

        const selected = player.selectedSlotIndex;
        const held = inv.getItem(selected);
        if (held?.typeId === itemStack.typeId) {
            if (held.amount <= itemStack.amount) inv.setItem(selected, undefined);
            else {
                held.amount -= itemStack.amount;
                inv.setItem(selected, held);
            }
            return;
        }

        for (let i = 0; i < inv.size; i++) {
            const stack = inv.getItem(i);
            if (stack?.typeId !== itemStack.typeId) continue;

            if (stack.amount <= itemStack.amount) inv.setItem(i, undefined);
            else {
                stack.amount -= itemStack.amount;
                inv.setItem(i, stack);
            }
            return;
        }
    } catch (e) {}
}

/** Last resort when snapshot has no item data — put stolen item back into an empty frame. */
export function restoreFrameTheftFromPlayer(player, block) {
    if (!player || !block?.isValid || !isItemFrameBlock(block.typeId)) return false;

    const container = getItemFrameContainer(block);
    if (container?.getItem(0) || readFrameItemFromBlock(block, block.permutation)) return false;

    try {
        const inv = player.getComponent("minecraft:inventory")?.container
            || player.getComponent("inventory")?.container;
        if (!inv) return false;

        const slots = [player.selectedSlotIndex];
        for (let i = 0; i < inv.size; i++) {
            if (!slots.includes(i)) slots.push(i);
        }

        for (const slot of slots) {
            const held = inv.getItem(slot);
            if (!held) continue;

            if (writeFrameItemToBlock(block, held, block.permutation.getAllStates?.())) {
                reclaimDecorItemFromPlayer(player, held);
                return true;
            }
        }
    } catch (e) {}

    return false;
}

function applyItemFrameRestore(snapshot, player) {
    if (!snapshot?.location) return false;

    try {
        const dim = world.getDimension(snapshot.dimensionId || "minecraft:overworld");
        const block = dim.getBlock(snapshot.location);
        if (!block?.isValid || !isItemFrameBlock(block.typeId)) return false;

        writeFrameItemToBlock(block, snapshot.frameItem, snapshot.states);

        if (player && snapshot.frameItem) {
            reclaimDecorItemFromPlayer(player, snapshot.frameItem);
            removeDroppedTheftNear(snapshot.location, dim, snapshot.frameItem);
        } else if (player) {
            restoreFrameTheftFromPlayer(player, block);
        }

        return !!readFrameItemFromBlock(block, block.permutation) || !snapshot.frameItem;
    } catch (e) {
        return false;
    }
}

export function restoreItemFrameBlock(snapshot, player) {
    if (!snapshot?.location) return;

    const key = getBlockKey(snapshot.location, snapshot.dimensionId);
    scheduleRestoreJob(`block:${key}`, () => applyItemFrameRestore(snapshot, player));
}

export function enforceProtectedItemFrame(player, block, hitPermutation, denyFn) {
    if (!player || !block || !isItemFrameBlock(block.typeId)) return;

    const enforceKey = `block:${player.id}:${getBlockKey(block.location, block.dimension.id)}`;

    let snap = takePendingItemFrameRestore(block.location, block.dimension.id);
    if (!snap && hitPermutation) {
        snap = snapshotItemFrameFromHit(hitPermutation, block);
    }
    if (!snap) {
        snap = snapshotItemFrameBlock(block);
    }

    if (snap) {
        restoreItemFrameBlock(snap, player);
    } else {
        scheduleRestoreJob(enforceKey, () => restoreFrameTheftFromPlayer(player, block));
    }

    if (typeof denyFn === "function" && canShowDecorDeny(`${enforceKey}:deny`)) {
        denyFn(player);
    }
}

export function queueDecorEntityInteractRestore(entity) {
    const snap = snapshotDecorEntity(entity);
    if (!snap || !entity?.id) return snap;

    const merged = mergeEntityFrameSnapshots(pendingEntityInteractRestore.get(entity.id), snap);
    pendingEntityInteractRestore.set(entity.id, merged);
    system.runTimeout(() => {
        if (pendingEntityInteractRestore.get(entity.id) === merged) {
            pendingEntityInteractRestore.delete(entity.id);
        }
    }, FRAME_SNAPSHOT_TTL);

    return merged;
}

export function peekPendingDecorEntityInteractRestore(entityId) {
    return pendingEntityInteractRestore.get(entityId);
}

export function takePendingDecorEntityInteractRestore(entityId) {
    const snap = pendingEntityInteractRestore.get(entityId);
    if (snap) pendingEntityInteractRestore.delete(entityId);
    return snap;
}

/** True when a non-trusted player must be blocked from frames / armor stands. */
export function shouldProtectDecor(plot, player) {
    if (!plot || !player) return false;
    if (isClaimTrustedForDecor(plot, player)) return false;
    if (hasTesterSurvivalBuildBypass(plot, player)) return false;

    const isPublicClaim = plot.factionClaim || plot.isAdminClaim || plot.adminClaim;
    if (isPublicClaim && plot.permissions?.public?.decorations === true) {
        return false;
    }

    return !isClaimPermAllowed(plot, player, "protectInteract");
}

registerRealmHook(REALM_STAGGER.MEDIUM, tickDecorGuardRealm);
