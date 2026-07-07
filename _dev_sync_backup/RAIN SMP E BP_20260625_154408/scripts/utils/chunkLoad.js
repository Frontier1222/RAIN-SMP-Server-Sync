import { system, world } from "@minecraft/server";
import { getRealmPlayerById } from "./realmPerf.js";

/** Poll cadence for chunk readiness — avoids per-tick teleport spam on Realms. */
export const CHUNK_LOAD = {
    pollIntervalTicks: 5,
    maxPolls: 30,
    skyY: 310,
};

export function isPlayerOnline(player) {
    if (!player?.id) return false;
    try {
        if (getRealmPlayerById(player.id)) return true;
        return !!player.isValid;
    } catch (e) {
        return false;
    }
}

/** Cheap column check — bedrock exists once the chunk is loaded. */
export function isChunkColumnLoaded(dimension, x, z) {
    try {
        return !!dimension.getBlock({
            x: Math.floor(x),
            y: -64,
            z: Math.floor(z),
        });
    } catch (e) {
        return false;
    }
}

export function findSafeSurfaceY(dimension, x, z, dangerousBlocks) {
    try {
        const fx = Math.floor(x);
        const fz = Math.floor(z);
        const topmost = dimension.getTopmostBlock({ x: fx, y: 320, z: fz });
        if (!topmost) return null;

        const feetBlock = dimension.getBlock({ x: fx, y: topmost.y + 1, z: fz });
        const headBlock = dimension.getBlock({ x: fx, y: topmost.y + 2, z: fz });
        const safe =
            !dangerousBlocks.includes(topmost.typeId) &&
            feetBlock && !dangerousBlocks.includes(feetBlock.typeId) &&
            headBlock && !dangerousBlocks.includes(headBlock.typeId);

        return safe ? topmost.y + 1 : null;
    } catch (e) {
        return null;
    }
}

/**
 * Move player to sky once, poll until the destination column loads, then callback.
 */
export function preloadChunkThen(player, dimension, x, z, onReady, onTimeout) {
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    const skyLoc = { x: fx + 0.5, y: CHUNK_LOAD.skyY, z: fz + 0.5 };

    try {
        player.teleport(skyLoc, { dimension });
    } catch (e) {
        onTimeout?.();
        return;
    }

    let polls = 0;
    const pollId = system.runInterval(() => {
        polls++;

        if (!isPlayerOnline(player)) {
            system.clearRun(pollId);
            return;
        }

        if (isChunkColumnLoaded(dimension, fx, fz)) {
            system.clearRun(pollId);
            onReady(dimension, fx, fz);
            return;
        }

        if (polls >= CHUNK_LOAD.maxPolls) {
            system.clearRun(pollId);
            onTimeout?.();
        }
    }, CHUNK_LOAD.pollIntervalTicks);
}

/** Border/world-edge pushes: keep current height instead of scanning new columns. */
export function teleportClamped(player, x, z, minY = 64, maxY = 300) {
    const loc = player.location;
    const y = Math.max(minY, Math.min(maxY, loc.y));
    player.teleport({ x, y, z }, { dimension: player.dimension });
}

let vaultTickingAreaRegistered = false;

/** Register builder vault ticking area once (Realms limit: avoid re-adding every swap). */
export function ensureVaultTickingArea() {
    if (vaultTickingAreaRegistered) return;
    vaultTickingAreaRegistered = true;
    try {
        world.getDimension("overworld").runCommandAsync(
            "tickingarea add 1180 0 80 1220 320 150 BuilderVaults true"
        );
    } catch (e) { }
}
