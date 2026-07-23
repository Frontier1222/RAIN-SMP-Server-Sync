import { ItemStack, system, world } from "@minecraft/server";
import { REALM_STAGGER, toastDeny, nextRealmPlayer, registerRealmHook } from "./realmPerf.js";
import { isStaffPlayer } from "../systems/ranks.js";

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

// The realm loop refreshes prison effects every two seconds. Keeping these
// short prevents a stale intruder effect surviving a tag change or restart.
const EFFECT_TICKS = 600;

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
    "minecraft:elder_guardian",
];

const PROXIMITY_PADDING = 72;
const PRISON_EFFECT_IDS = [
    "resistance",
    "regeneration",
    "fire_resistance",
    "strength",
    "weakness",
    "mining_fatigue",
    "speed",
];

const prisonInsideState = new Map();
const prisonRoleState = new Map();
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
    if (!player) return false;

    try {
        if (
            player.hasTag(PRISON_BOUNDS.STAFF_TAG) ||
            player.hasTag("prison_admin") ||
            player.hasTag("prisonadmin")
        ) return true;
    } catch (e) {}

    try {
        if (player.getTags().some((tag) => {
            const normalized = String(tag || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            return normalized.includes("prisonstaff") || normalized.includes("prisonadmin");
        })) return true;
    } catch (e) {}

    try {
        return isStaffPlayer(player);
    } catch (e) {}

    return false;
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
    const bareId = String(effectId || "").replace("minecraft:", "");
    const ids = [bareId, `minecraft:${bareId}`];
    let apiAccepted = false;

    for (const id of ids) {
        try {
            player.removeEffect(id);
            apiAccepted = true;
        } catch (e) {}
    }

    if (apiAccepted) return;

    try {
        player.runCommand(`effect @s clear ${bareId}`);
    } catch (e) {}
}

function forceRemoveEffect(player, effectId) {
    const bareId = String(effectId || "").replace("minecraft:", "");
    safeRemoveEffect(player, bareId);
    try {
        player.runCommand(`effect @s clear ${bareId}`);
    } catch (e) {
        try {
            player.runCommand(`effect @s clear minecraft:${bareId}`);
        } catch (commandError) {}
    }
}

function hasEffect(player, effectId) {
    const bareId = String(effectId || "").replace("minecraft:", "");
    for (const id of [bareId, `minecraft:${bareId}`]) {
        try {
            if (player.getEffect(id)) return true;
        } catch (e) {}
    }
    return false;
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
}

function applyPrisonerEffects(player) {
    safeAddEffect(player, "weakness", 4);
    forceRemoveEffect(player, "mining_fatigue");
    safeRemoveEffect(player, "resistance");
    safeRemoveEffect(player, "regeneration");
    safeRemoveEffect(player, "fire_resistance");
    safeRemoveEffect(player, "strength");
    safeRemoveEffect(player, "speed");
}

function applyIntruderEffects(player) {
    // Re-check literal role tags at the only prison source of mining fatigue.
    // This remains authoritative even if a shared rank lookup is unavailable.
    if (isPrisonStaff(player)) {
        forceRemoveEffect(player, "weakness");
        forceRemoveEffect(player, "mining_fatigue");
        applyPrisonStaffEffects(player);
        return;
    }
    if (isPrisonInmate(player)) {
        applyPrisonerEffects(player);
        return;
    }

    safeAddEffect(player, "weakness", 4);
    safeAddEffect(player, "mining_fatigue", 15);
    safeRemoveEffect(player, "resistance");
    safeRemoveEffect(player, "regeneration");
    safeRemoveEffect(player, "fire_resistance");
    safeRemoveEffect(player, "strength");
    safeRemoveEffect(player, "speed");
}

function getPrisonRole(player) {
    if (isPrisonStaff(player)) return "staff";
    if (isPrisonInmate(player)) return "inmate";
    return "intruder";
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
    if (!player?.isValid) return;
    system.runTimeout(() => tickPrisonPlayer(player, true), 1);
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
        } else if (
            (isPrisonStaff(player) || isPrisonInmate(player)) &&
            hasEffect(player, "mining_fatigue")
        ) {
            // Purge fatigue that existed before a protected role was assigned.
            forceRemoveEffect(player, "mining_fatigue");
        }
        prisonInsideState.set(player.id, false);
        prisonRoleState.delete(player.id);
        return;
    }

    const role = getPrisonRole(player);
    const previousRole = prisonRoleState.get(player.id);
    prisonInsideState.set(player.id, true);
    prisonRoleState.set(player.id, role);

    if (role === "staff" && (!wasInPrison || previousRole !== role)) {
        forceRemoveEffect(player, "weakness");
        forceRemoveEffect(player, "mining_fatigue");
    }

    if (!wasInPrison || previousRole !== role) {
        applyPrisonEffectsForPlayer(player);
        return;
    }

    if (refreshEffects) {
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

    if (world.beforeEvents?.effectAdd) {
        world.beforeEvents.effectAdd.subscribe((event) => {
            try {
                const player = event.entity;
                if (!player || player.typeId !== "minecraft:player" || !isPrisonStaff(player)) return;

                const typeId = String(
                    event.effect?.typeId ??
                    event.effect?.type?.id ??
                    event.effectType?.id ??
                    event.effectType?.typeId ??
                    event.effectType ??
                    ""
                ).toLowerCase().replace("minecraft:", "");

                if (typeId === "mining_fatigue") event.cancel = true;
            } catch (e) {}
        });
    }

    // Engine-driven effects can bypass cancellable script events. Keep an
    // exact-tag immunity check at tick speed, but only issue a clear when the
    // effect is genuinely present.
    system.runInterval(() => {
        let staffPlayers = [];
        try {
            staffPlayers = world.getPlayers({ tags: [PRISON_BOUNDS.STAFF_TAG] });
        } catch (e) {
            return;
        }

        for (const player of staffPlayers) {
            if (hasEffect(player, "mining_fatigue")) {
                forceRemoveEffect(player, "mining_fatigue");
            }
        }
    }, 1);

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
