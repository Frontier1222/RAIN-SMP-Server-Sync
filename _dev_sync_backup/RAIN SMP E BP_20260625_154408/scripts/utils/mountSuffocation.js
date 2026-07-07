import { world } from "@minecraft/server";

/** Bedrock floor is y=-64; mounted riders clip into blocks around y=-63. */
const LOW_RIDE_SUFFOCATE_Y = -62;

function getMount(entity) {
    try {
        const riding = entity.getComponent("minecraft:riding");
        const mount = riding?.entityRidingOn;
        return mount?.isValid ? mount : null;
    } catch (e) {
        return null;
    }
}

function isLowWorldRide(player) {
    const mount = getMount(player);
    if (!mount) return false;

    const riderY = player.location.y;
    const mountY = mount.location.y;
    return riderY <= LOW_RIDE_SUFFOCATE_Y || mountY <= LOW_RIDE_SUFFOCATE_Y;
}

function isSuffocationDamage(damageSource) {
    const cause = String(damageSource?.cause ?? "").toLowerCase();
    return cause === "suffocation" || cause === "inwall" || cause.includes("suffoc");
}

if (world.beforeEvents?.entityHurt) {
    world.beforeEvents.entityHurt.subscribe((event) => {
        const hurt = event.hurtEntity;
        if (!hurt?.isValid || hurt.typeId !== "minecraft:player") return;
        if (!isSuffocationDamage(event.damageSource)) return;
        if (!isLowWorldRide(hurt)) return;

        event.cancel = true;
    });
}
