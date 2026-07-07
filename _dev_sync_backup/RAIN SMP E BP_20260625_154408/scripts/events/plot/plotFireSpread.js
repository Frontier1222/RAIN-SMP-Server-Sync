import { BlockPermutation, system, world } from '@minecraft/server';
import { getGlobalPlotAtLocation } from './plotHelpers.js';
import { isClaimPermAllowed, isClaimProtectionEnabled } from '../../utils/claimPermissions.js';
import { isTester } from '../../utils/creativeRoleGuard.js';
import { toastDeny, registerRealmHook, REALM_STAGGER, nextRealmPlayer } from '../../utils/realmPerf.js';

const FIRE_BLOCK_IDS = new Set(['minecraft:fire', 'minecraft:soul_fire']);
const FIRE_IGNITE_ITEMS = new Set(['minecraft:flint_and_steel', 'minecraft:fire_charge']);
const FIRE_SCAN_RADIUS = { x: 5, y: 3, z: 5 };

/** Block flint/steel when fire spread is off — no owner bypass; respects per-player allow. */
function shouldBlockFireSpread(plot, player) {
    if (!plot || !player) return false;
    if (player.hasTag('staff') && !isTester(player)) return false;
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

function extinguishFireBlock(block) {
    if (!block?.isValid || !isFireBlock(block.typeId)) return;

    try {
        block.setPermutation(BlockPermutation.resolve('minecraft:air'));
    } catch (e) {}
}

/** Remove fire inside claims where fire spread is disabled (including spread from outside). */
function extinguishFireInProtectedClaim(block) {
    if (!block?.isValid || !isFireBlock(block.typeId)) return;

    const plot = getGlobalPlotAtLocation(block.location, block.dimension.id);
    if (!plot || !isClaimProtectionEnabled(plot, 'protectFireSpread')) return;

    system.run(() => extinguishFireBlock(block));
}

function scanAndExtinguishFireNearPlayer(player) {
    if (!player?.isValid) return;

    const plot = getGlobalPlotAtLocation(player.location, player.dimension.id);
    if (!plot || !isClaimProtectionEnabled(plot, 'protectFireSpread')) return;

    const dim = player.dimension;
    const base = player.location;
    const minX = Math.floor(base.x) - FIRE_SCAN_RADIUS.x;
    const maxX = Math.floor(base.x) + FIRE_SCAN_RADIUS.x;
    const minY = Math.floor(base.y) - FIRE_SCAN_RADIUS.y;
    const maxY = Math.floor(base.y) + FIRE_SCAN_RADIUS.y;
    const minZ = Math.floor(base.z) - FIRE_SCAN_RADIUS.z;
    const maxZ = Math.floor(base.z) + FIRE_SCAN_RADIUS.z;

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                try {
                    const block = dim.getBlock({ x, y, z });
                    if (!block?.isValid || !isFireBlock(block.typeId)) continue;

                    const blockPlot = getGlobalPlotAtLocation(block.location, dim.id);
                    if (blockPlot && isClaimProtectionEnabled(blockPlot, 'protectFireSpread')) {
                        extinguishFireBlock(block);
                    }
                } catch (e) {}
            }
        }
    }
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

if (world.afterEvents?.blockUpdate) {
    world.afterEvents.blockUpdate.subscribe((event) => {
        try {
            extinguishFireInProtectedClaim(event.block);
        } catch (e) {}
    });
}

registerRealmHook(REALM_STAGGER.MEDIUM, (players) => {
    const player = nextRealmPlayer(players);
    if (player) scanAndExtinguishFireNearPlayer(player);
});

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
