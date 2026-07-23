import { world } from '@minecraft/server';
import { getGlobalPlotAtLocation } from './plotHelpers.js';
import { isClaimPermAllowed } from '../../utils/claimPermissions.js';
import { toastDeny } from '../../utils/realmPerf.js';
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

// Do not run periodic fire deletion. Claim fire-spread protection should block
// unauthorized ignition, not remove valid fire/campfires/decor near protected areas.
