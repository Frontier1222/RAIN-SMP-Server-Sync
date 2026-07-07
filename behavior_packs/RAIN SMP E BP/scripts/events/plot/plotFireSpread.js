import { world } from '@minecraft/server';
import { getGlobalPlotAtLocation } from './plotHelpers.js';
import { isClaimPermAllowed } from '../../utils/claimPermissions.js';
import { REALM_STAGGER, toastDeny, REALM_CLEANUP_RADIUS, registerRealmHook } from '../../utils/realmPerf.js';
import { isStaffPlayer } from '../../systems/ranks.js';

const FIRE_BLOCK_IDS = new Set(['minecraft:fire', 'minecraft:soul_fire']);
const FIRE_IGNITE_ITEMS = new Set(['minecraft:flint_and_steel', 'minecraft:fire_charge']);

function getDefaultPerms(plot) {
    return (plot.permissions && plot.permissions.default) || plot.permissions || {};
}

function claimBlocksFireSpread(plot) {
    return getDefaultPerms(plot).protectFireSpread !== false;
}

/** Block flint/steel when fire spread is off — no owner bypass; respects per-player allow. */
function shouldBlockFireSpread(plot, player) {
    if (!plot || !player) return false;
    if (isStaffPlayer(player)) return false;
    return !isClaimPermAllowed(plot, player, 'protectFireSpread');
}

function isFireBlock(typeId) {
    return FIRE_BLOCK_IDS.has(String(typeId || '').toLowerCase());
}

function isFireIgniteItem(itemStack) {
    if (!itemStack) return false;
    return FIRE_IGNITE_ITEMS.has(String(itemStack.typeId || '').toLowerCase());
}

function getHeldItem(player) {
    try {
        return player.getComponent('minecraft:inventory')?.container?.getItem(player.selectedSlotIndex);
    } catch (e) {
        return undefined;
    }
}

function denyFire(player, plot) {
    toastDeny(
        player,
        `§cFlint and steel are disabled in ${plot?.name || 'this claim'} (fire spread off).`,
        'plot_fire'
    );
}

function blockFireIgnite(ev, player, block) {
    if (!player || player.typeId !== 'minecraft:player' || !block) return false;

    const item = ev.itemStack ?? getHeldItem(player);
    if (!isFireIgniteItem(item)) return false;

    const plot = getGlobalPlotAtLocation(block.location, player.dimension.id);
    if (plot && shouldBlockFireSpread(plot, player)) {
        ev.cancel = true;
        denyFire(player, plot);
        return true;
    }

    return false;
}

function isInsidePlot(location, dimensionId, plot) {
    if (!location || !plot) return false;

    const plotDim = plot.dimension || 'minecraft:overworld';
    if (plotDim !== dimensionId) return false;

    const minX = Math.min(plot.minX, plot.maxX);
    const maxX = Math.max(plot.minX, plot.maxX);
    const minZ = Math.min(plot.minZ, plot.maxZ);
    const maxZ = Math.max(plot.minZ, plot.maxZ);

    return (
        location.x >= minX &&
        location.x <= maxX &&
        location.z >= minZ &&
        location.z <= maxZ
    );
}

function clearFireNearPlayer(player, plot) {
    const dim = player.dimension;
    const loc = player.location;

    const claimMinX = Math.min(plot.minX, plot.maxX);
    const claimMaxX = Math.max(plot.minX, plot.maxX);
    const claimMinZ = Math.min(plot.minZ, plot.maxZ);
    const claimMaxZ = Math.max(plot.minZ, plot.maxZ);

    const rH = REALM_CLEANUP_RADIUS.horizontal;
    const rV = REALM_CLEANUP_RADIUS.vertical;

    const minX = Math.max(claimMinX, Math.floor(loc.x) - rH);
    const maxX = Math.min(claimMaxX, Math.floor(loc.x) + rH);
    const minZ = Math.max(claimMinZ, Math.floor(loc.z) - rH);
    const maxZ = Math.min(claimMaxZ, Math.floor(loc.z) + rH);
    const minY = Math.max(-64, Math.floor(loc.y) - rV);
    const maxY = Math.min(320, Math.floor(loc.y) + rV);

    for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                try {
                    const block = dim.getBlock({ x, y, z });
                    if (block && isFireBlock(block.typeId)) {
                        block.setType('minecraft:air');
                    }
                } catch (e) {}
            }
        }
    }
}

export const plotFirePlaceProtection = {
    name: 'playerPlaceBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block || !isFireBlock(block.typeId)) return;

        const plot = getGlobalPlotAtLocation(block.location, player.dimension.id);
        if (plot && shouldBlockFireSpread(plot, player)) {
            ev.cancel = true;
            denyFire(player, plot);
        }
    }
};

export const plotFireIgniteProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        blockFireIgnite(ev, ev.source, ev.block);
    }
};

/** Flint and steel often triggers interact instead of itemUseOn on Bedrock. */
export const plotFireInteractProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        blockFireIgnite(ev, ev.player, ev.block);
    }
};

/** Fire charge can ignite via itemUse in air. */
export const plotFireItemUseProtection = {
    name: 'itemUse',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        if (!player || player.typeId !== 'minecraft:player') return;

        const item = ev.itemStack ?? getHeldItem(player);
        if (!isFireIgniteItem(item)) return;

        let target = player.location;
        try {
            const hit = player.getBlockFromViewDirection({ maxDistance: 6 });
            if (hit?.block) target = hit.block.location;
        } catch (e) {}

        const plot = getGlobalPlotAtLocation(target, player.dimension.id);
        if (plot && shouldBlockFireSpread(plot, player)) {
            ev.cancel = true;
            denyFire(player, plot);
        }
    }
};

let fireSpreadPlayerRot = 0;
const FIRE_SPREAD_BATCH = 2;
const FIRE_RESCAN_IDLE_LOOPS = 6;
/** @type {Map<string, { blockKey: string, lastScanFrame: number }>} */
const fireScanStateById = new Map();

function getFireScanBlockKey(player) {
    const loc = player.location;
    return `${Math.floor(loc.x)}:${Math.floor(loc.y)}:${Math.floor(loc.z)}:${player.dimension.id}`;
}

function shouldRunFireScan(player, frame) {
    const blockKey = getFireScanBlockKey(player);
    const state = fireScanStateById.get(player.id);

    if (!state || state.blockKey !== blockKey) {
        fireScanStateById.set(player.id, { blockKey, lastScanFrame: frame });
        return true;
    }

    return frame - state.lastScanFrame >= FIRE_RESCAN_IDLE_LOOPS;
}

function tickPlotFireSpreadForPlayer(player, frame) {
    const plot = getGlobalPlotAtLocation(player.location, player.dimension.id);
    if (!plot || !claimBlocksFireSpread(plot)) return;
    if (!isInsidePlot(player.location, player.dimension.id, plot)) return;
    if (!shouldRunFireScan(player, frame)) return;

    fireScanStateById.set(player.id, {
        blockKey: getFireScanBlockKey(player),
        lastScanFrame: frame,
    });
    clearFireNearPlayer(player, plot);
}

function tickPlotFireSpread(players, frame = 0) {
    if (!players?.length) return;

    const batch = Math.min(FIRE_SPREAD_BATCH, players.length);
    for (let i = 0; i < batch; i++) {
        const player = players[(fireSpreadPlayerRot + i) % players.length];
        if (!player) continue;
        try {
            tickPlotFireSpreadForPlayer(player, frame);
        } catch (e) {}
    }

    fireSpreadPlayerRot = (fireSpreadPlayerRot + batch) % players.length;
}

registerRealmHook(REALM_STAGGER.SLOW, (players, _now, frame) => {
    tickPlotFireSpread(players, frame);
});
