import { ItemStack, system, world } from "@minecraft/server";
import { REALM_STAGGER, toastDeny, nextRealmPlayer, registerRealmHook } from "./realmPerf.js";

export const PRISON_BOUNDS = {
    MIN_X: 2320,
    MAX_X: 2860,
    MIN_Z: 407,
    MAX_Z: 671,
    MIN_Y: 0,
    MAX_Y: 180,
    MOB_MARGIN: 30,
    TAG: "prison",
    STAFF_TAG: "prison_staff",
    DIMENSION: "minecraft:overworld",
};

export const RAIN_GUI_ITEM_ID = "bd:gui";
export const PRISON_BLOCK_MESSAGE = "§cOnly prison staff can use the Rain SMP GUI inside the prison.";
export const PRISON_TPA_MESSAGE = "§cThat player is in prison — TPA rejected.";

const EFFECT_TICKS = 20000000;

const MOB_KILL = {
    minX: PRISON_BOUNDS.MIN_X - PRISON_BOUNDS.MOB_MARGIN,
    maxX: PRISON_BOUNDS.MAX_X + PRISON_BOUNDS.MOB_MARGIN,
    minZ: PRISON_BOUNDS.MIN_Z - PRISON_BOUNDS.MOB_MARGIN,
    maxZ: PRISON_BOUNDS.MAX_Z + PRISON_BOUNDS.MOB_MARGIN,
    minY: PRISON_BOUNDS.MIN_Y,
    maxY: PRISON_BOUNDS.MAX_Y,
};

const MOB_TYPES = [
    "minecraft:creeper",
    "minecraft:warden",
];

const PROXIMITY_PADDING = 72;
const PRISON_EFFECT_IDS = [
    "resistance",
    "regeneration",
    "fire_resistance",
    "strength",
    "weakness",
    "mining_fatigue",
];

const prisonInsideState = new Map();
let prisonRuntimeStarted = false;
let prisonLoopFrame = 0;

function isOverworld(dimensionId) {
    return dimensionId === "minecraft:overworld" || dimensionId === "overworld";
}

function getOverworldDimension() {
    try {
        return world.getDimension("overworld");
    } catch (e) {}

    try {
        return world.getDimension("minecraft:overworld");
    } catch (e) {}

    return null;
}

export function isInPrisonArea(loc, dimensionId = PRISON_BOUNDS.DIMENSION) {
    if (!loc || !isOverworld(dimensionId)) return false;

    return (
        loc.x >= PRISON_BOUNDS.MIN_X &&
        loc.x <= PRISON_BOUNDS.MAX_X &&
        loc.y >= PRISON_BOUNDS.MIN_Y &&
        loc.y <= PRISON_BOUNDS.MAX_Y &&
        loc.z >= PRISON_BOUNDS.MIN_Z &&
        loc.z <= PRISON_BOUNDS.MAX_Z
    );
}

export function isPlayerInPrison(player) {
    if (!player) return false;

    try {
        return isInPrisonArea(player.location, player.dimension.id);
    } catch (e) {
        return false;
    }
}

export function isPrisonStaff(player) {
    return !!(
        player?.hasTag(PRISON_BOUNDS.STAFF_TAG) ||
        player?.hasTag("prison_admin") ||
        player?.hasTag("prisonadmin")
    );
}

export function isPrisonInmate(player) {
    return !!player?.hasTag(PRISON_BOUNDS.TAG);
}

/** Inside prison with neither `prison` nor `prison_staff` tag. */
export function isPrisonIntruder(player) {
    if (!isPlayerInPrison(player)) return false;
    return !isPrisonStaff(player) && !isPrisonInmate(player);
}

export function hasPrisonGuiAccess(player) {
    return isPrisonStaff(player);
}

export function isPrisonGuiBlocked(player) {
    return isPlayerInPrison(player) && !hasPrisonGuiAccess(player);
}

function isNearPrisonRegion(loc, dimensionId, padding = PROXIMITY_PADDING) {
    if (!loc || !isOverworld(dimensionId)) return false;

    return (
        loc.x >= MOB_KILL.minX - padding &&
        loc.x <= MOB_KILL.maxX + padding &&
        loc.z >= MOB_KILL.minZ - padding &&
        loc.z <= MOB_KILL.maxZ + padding
    );
}

function shouldRunPrisonMobCleanup() {
    for (const player of world.getAllPlayers()) {
        try {
            if (isNearPrisonRegion(player.location, player.dimension.id)) return true;
        } catch (e) {}
    }
    return false;
}

function safeAddEffect(player, effectId, amplifier) {
    try {
        player.addEffect(effectId, EFFECT_TICKS, {
            amplifier,
            showParticles: true,
        });
        return;
    } catch (e) {}

    try {
        const seconds = Math.min(1000000, Math.floor(EFFECT_TICKS / 20));
        player.runCommand(`effect @s ${effectId} ${seconds} ${amplifier} true`);
    } catch (e) {}
}

function safeRemoveEffect(player, effectId) {
    try {
        player.removeEffect(effectId);
    } catch (e) {}
}

function clearPrisonEffects(player) {
    for (const effectId of PRISON_EFFECT_IDS) {
        safeRemoveEffect(player, effectId);
    }
}

function applyPrisonStaffEffects(player) {
    safeAddEffect(player, "resistance", 4);
    safeAddEffect(player, "regeneration", 1);
    safeAddEffect(player, "fire_resistance", 0);
    safeAddEffect(player, "strength", 0);
    safeAddEffect(player, "speed", 1);
    safeRemoveEffect(player, "weakness");
    safeRemoveEffect(player, "mining_fatigue");
}

function applyPrisonerEffects(player) {
    safeAddEffect(player, "weakness", 4);
    safeRemoveEffect(player, "mining_fatigue");
    safeRemoveEffect(player, "resistance");
    safeRemoveEffect(player, "regeneration");
    safeRemoveEffect(player, "fire_resistance");
    safeRemoveEffect(player, "strength");
    safeRemoveEffect(player, "speed");
}

function applyIntruderEffects(player) {
    safeAddEffect(player, "weakness", 4);
    safeAddEffect(player, "mining_fatigue", 15);
    safeRemoveEffect(player, "resistance");
    safeRemoveEffect(player, "regeneration");
    safeRemoveEffect(player, "fire_resistance");
    safeRemoveEffect(player, "strength");
    safeRemoveEffect(player, "speed");
}

function applyPrisonEffectsForPlayer(player) {
    if (!isPlayerInPrison(player)) return;

    if (isPrisonStaff(player)) {
        applyPrisonStaffEffects(player);
        return;
    }

    if (isPrisonInmate(player)) {
        applyPrisonerEffects(player);
        return;
    }

    applyIntruderEffects(player);
}

function schedulePrisonEffects(player) {
    if (!player?.isValid || !isPlayerInPrison(player)) return;
    system.run(() => applyPrisonEffectsForPlayer(player));
    system.runTimeout(() => applyPrisonEffectsForPlayer(player), 1);
    system.runTimeout(() => applyPrisonEffectsForPlayer(player), 5);
}

export function denyPrisonGuiUse(player) {
    toastDeny(player, PRISON_BLOCK_MESSAGE, "prison_gui");
}

export function blockPrisonGuiItemUse(player, itemStack, cancelEvent = null) {
    if (!player || itemStack?.typeId !== RAIN_GUI_ITEM_ID) return false;
    if (!isPrisonGuiBlocked(player)) return false;

    if (cancelEvent) {
        cancelEvent.cancel = true;
    }

    denyPrisonGuiUse(player);
    return true;
}

const INTRUDER_TELEPORT_ITEMS = new Set([
    "minecraft:ender_pearl",
    "minecraft:chorus_fruit",
    "minecraft:chorus_flower",
]);

function restoreCancelledTeleportItem(player, typeId, expectedAmount = 1) {
    if (!player?.isValid || !typeId) return;
    system.run(() => {
        try {
            const inv = player.getComponent("minecraft:inventory")?.container;
            if (!inv) return;
            const targetAmount = Math.max(1, Math.floor(Number(expectedAmount) || 1));
            const slot = player.selectedSlotIndex;
            const slotItem = inv.getItem(slot);
            if (slotItem?.typeId === typeId && (slotItem.amount || 0) >= targetAmount) return;

            const addAmount = slotItem?.typeId === typeId
                ? Math.max(0, targetAmount - (slotItem.amount || 0))
                : targetAmount;
            if (addAmount <= 0) return;

            const restore = new ItemStack(typeId, addAmount);
            const leftover = inv.addItem(restore);
            if (leftover) player.dimension.spawnItem(leftover, player.location);
        } catch (e) {}
    });
}

function blockPrisonIntruderTeleportUse(player, itemStack, cancelEvent = null) {
    if (!player || !itemStack) return false;
    if (!isPrisonIntruder(player)) return false;
    if (!INTRUDER_TELEPORT_ITEMS.has(String(itemStack.typeId || "").toLowerCase())) return false;

    if (cancelEvent) cancelEvent.cancel = true;
    restoreCancelledTeleportItem(player, itemStack.typeId, itemStack.amount ?? 1);
    toastDeny(player, "§cTeleport items are blocked for prison intruders.", "prison_teleport_block");
    return true;
}

export function tickPrisonPlayer(player, refreshEffects = false) {
    if (!player?.isValid) return;

    let inPrison = false;
    try {
        inPrison = isInPrisonArea(player.location, player.dimension.id);
    } catch (e) {
        return;
    }

    const wasInPrison = prisonInsideState.get(player.id) ?? false;

    if (!inPrison) {
        if (wasInPrison) {
            clearPrisonEffects(player);
        }
        prisonInsideState.set(player.id, false);
        return;
    }

    const intruder = isPrisonIntruder(player);
    prisonInsideState.set(player.id, true);

    if (!wasInPrison) {
        applyPrisonEffectsForPlayer(player);
        schedulePrisonEffects(player);
        return;
    }

    if (intruder || refreshEffects) {
        applyPrisonEffectsForPlayer(player);
    }
}

export function tickPrisonMobCleanup() {
    if (!shouldRunPrisonMobCleanup()) return;

    const dim = getOverworldDimension();
    if (!dim) return;

    const dx = MOB_KILL.maxX - MOB_KILL.minX;
    const dy = MOB_KILL.maxY - MOB_KILL.minY;
    const dz = MOB_KILL.maxZ - MOB_KILL.minZ;

    for (const mobType of MOB_TYPES) {
        try {
            // Exclude staff_exempt entities (tagged when staff spawns blocked capture mobs for testing)
            dim.runCommandAsync(
                `kill @e[type=${mobType},tag=!staff_exempt,x=${MOB_KILL.minX},y=${MOB_KILL.minY},z=${MOB_KILL.minZ},dx=${dx},dy=${dy},dz=${dz}]`
            );
        } catch (e) {}
    }
}

function tickPrisonRealmLoop(players, _now, frame) {
    prisonLoopFrame++;
    const refreshEffects = prisonLoopFrame % 2 === 0;

    for (const player of players) {
        if (prisonInsideState.get(player.id)) {
            tickPrisonPlayer(player, refreshEffects);
        }
    }

    const outsider = nextRealmPlayer(players.filter((p) => !prisonInsideState.get(p.id)));
    if (outsider) tickPrisonPlayer(outsider, false);

    if (frame % REALM_STAGGER.SLOW === 0) {
        tickPrisonMobCleanup();
    }
}

export function startPrisonRuntime() {
    if (prisonRuntimeStarted) return;
    prisonRuntimeStarted = true;

    if (world.beforeEvents?.itemUse) {
        world.beforeEvents.itemUse.subscribe((event) => {
            try {
                blockPrisonGuiItemUse(event.source, event.itemStack, event);
                blockPrisonIntruderTeleportUse(event.source, event.itemStack, event);
            } catch (e) {}
        });
    }

    if (world.beforeEvents?.itemUseOn) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            try {
                blockPrisonIntruderTeleportUse(event.source, event.itemStack, event);
            } catch (e) {}
        });
    }

    registerRealmHook(REALM_STAGGER.MEDIUM, tickPrisonRealmLoop);

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            schedulePrisonEffects(event.player);
        });
    }

    system.runTimeout(() => {
        for (const player of world.getAllPlayers()) {
            schedulePrisonEffects(player);
        }
    }, 1);
}
