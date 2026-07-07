import { world, system } from "@minecraft/server";
import { getGlobalPlotAtLocation } from "./plotHelpers.js";
import { isClaimProtectionEnabled } from "../../utils/claimPermissions.js";
import { isTester } from "../../utils/creativeRoleGuard.js";

const RAID_EFFECTS = new Set(["minecraft:bad_omen", "minecraft:raid_omen", "bad_omen", "raid_omen"]);
const RAID_MOB_TYPES = new Set([
    "minecraft:ravager",
    "minecraft:evocation_illager",
    "minecraft:evoker",
    "minecraft:vindicator",
    "minecraft:pillager",
    "minecraft:witch",
    "minecraft:illusioner",
    "minecraft:iron_golem",
    "minecraft:vex",
]);

function shouldBlockRaidsInClaim(plot, player) {
    if (!plot) return false;
    if (player?.hasTag("staff") && !isTester(player)) return false;
    return isClaimProtectionEnabled(plot, "protectRaid");
}

function getPlotAtLocation(location, dimensionId) {
    return getGlobalPlotAtLocation(location, dimensionId);
}

function removeRaidEntity(entity) {
    system.run(() => {
        try {
            if (entity?.isValid) entity.remove();
        } catch (e) {}
    });
}

if (world.beforeEvents?.effectAdd) {
    world.beforeEvents.effectAdd.subscribe((event) => {
        try {
            const entity = event.entity;
            if (!entity || entity.typeId !== "minecraft:player") return;

            const effectId = String(event.effect?.typeId || event.effectType || "").toLowerCase();
            if (!RAID_EFFECTS.has(effectId)) return;

            const plot = getPlotAtLocation(entity.location, entity.dimension.id);
            if (plot && shouldBlockRaidsInClaim(plot, entity)) {
                event.cancel = true;
            }
        } catch (e) {}
    });
}

if (world.beforeEvents?.entitySpawn) {
    world.beforeEvents.entitySpawn.subscribe((event) => {
        try {
            const entity = event.entity;
            if (!entity) return;

            const typeId = String(entity.typeId || "").toLowerCase();
            if (!RAID_MOB_TYPES.has(typeId)) return;

            const plot = getPlotAtLocation(entity.location, entity.dimension.id);
            if (plot && isClaimProtectionEnabled(plot, "protectRaid")) {
                event.cancel = true;
            }
        } catch (e) {}
    });
}

if (world.afterEvents?.entitySpawn) {
    world.afterEvents.entitySpawn.subscribe((event) => {
        try {
            const entity = event.entity;
            if (!entity) return;

            const typeId = String(entity.typeId || "").toLowerCase();
            if (!RAID_MOB_TYPES.has(typeId)) return;

            const plot = getPlotAtLocation(entity.location, entity.dimension.id);
            if (plot && isClaimProtectionEnabled(plot, "protectRaid")) {
                removeRaidEntity(entity);
            }
        } catch (e) {}
    });
}
