import { system, world } from "@minecraft/server";
import { isGravestoneBlock } from "./blockTypes.js";
import { registerRealmHook, REALM_STAGGER, getRealmPlayers } from "./realmPerf.js";

const GRAVE_ENTITY = "ae_sg:floating_text";
const CLEANUP_DIMS = ["overworld", "nether", "the_end"];
const SCAN_RADIUS = 24;
const BLOCK_CHECKS_PER_TICK = 32;
const ENTITIES_PER_TICK = 16;

let dimRot = 0;

/** @type {Map<string, { dx: number, dy: number, dz: number }>} */
const blockScanCursors = new Map();

function disableGravestoneSystem() {
    try {
        world.setDynamicProperty("ae_sg.enabled", false);
    } catch (e) {}

    try {
        if (world.gameRules && world.gameRules.keepInventory) {
            world.gameRules.keepInventory = false;
        }
    } catch (e) {}
}

function removeGraveEntitiesInDimension(dim) {
    let entities;
    try {
        entities = dim.getEntities({ type: GRAVE_ENTITY });
    } catch (e) {
        return;
    }

    let removed = 0;
    for (const ent of entities) {
        if (removed >= ENTITIES_PER_TICK) break;
        if (!ent?.isValid) continue;
        try {
            ent.remove();
            removed++;
        } catch (e) {}
    }
}

function advanceScanCursor(cursor) {
    cursor.dz++;
    if (cursor.dz <= SCAN_RADIUS) return cursor;

    cursor.dz = -SCAN_RADIUS;
    cursor.dx++;
    if (cursor.dx <= SCAN_RADIUS) return cursor;

    cursor.dx = -SCAN_RADIUS;
    cursor.dy++;
    if (cursor.dy <= SCAN_RADIUS) return cursor;

    return null;
}

function removeGraveBlocksNearPlayers(dim) {
    const players = getRealmPlayers().filter((p) => {
        try {
            return p?.isValid && p.dimension?.id === dim.id;
        } catch (e) {
            return false;
        }
    });
    if (!players.length) return;

    let checks = 0;

    for (const player of players) {
        if (checks >= BLOCK_CHECKS_PER_TICK) break;
        if (!player?.isValid) continue;

        let cursor = blockScanCursors.get(player.id);
        if (!cursor) {
            cursor = { dx: -SCAN_RADIUS, dy: -SCAN_RADIUS, dz: -SCAN_RADIUS };
        }

        const baseX = Math.floor(player.location.x);
        const baseY = Math.floor(player.location.y);
        const baseZ = Math.floor(player.location.z);

        while (checks < BLOCK_CHECKS_PER_TICK) {
            try {
                const block = dim.getBlock({
                    x: baseX + cursor.dx,
                    y: baseY + cursor.dy,
                    z: baseZ + cursor.dz,
                });
                if (isGravestoneBlock(block)) {
                    block.setType("minecraft:air");
                }
            } catch (e) {}

            checks++;
            const next = advanceScanCursor(cursor);
            if (!next) {
                blockScanCursors.delete(player.id);
                break;
            }
            cursor = next;
        }

        if (cursor) blockScanCursors.set(player.id, cursor);
    }
}

function tickGraveCleanup() {
    const dimId = CLEANUP_DIMS[dimRot % CLEANUP_DIMS.length];
    dimRot = (dimRot + 1) % CLEANUP_DIMS.length;

    let dim;
    try {
        dim = world.getDimension(dimId);
    } catch (e) {
        return;
    }

    removeGraveEntitiesInDimension(dim);
    removeGraveBlocksNearPlayers(dim);
}

/** Gravestones disabled — purge ae_sg blocks/entities and prevent new spawns. */
export function startGraveCleanupRuntime() {
    system.run(() => disableGravestoneSystem());
    registerRealmHook(REALM_STAGGER.SLOW, tickGraveCleanup);
}
