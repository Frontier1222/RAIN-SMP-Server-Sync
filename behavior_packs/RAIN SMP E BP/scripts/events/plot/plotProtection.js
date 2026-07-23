import { system, world, ItemStack } from '@minecraft/server';
import { getCombatRemainingSeconds } from '../../utils/teleport.js';
import { getGlobalPlotAtLocation } from './plotHelpers.js';
import { toastDeny, registerRealmHook, REALM_STAGGER } from '../../utils/realmPerf.js';
import { isBountyHunterActive } from '../../systems/bounty.js';
import {
    isStorageContainerBlock,
    isClaimWorkstationBlock,
    isSignBlock,
    isDecorInteractBlock,
    isAxeItem,
    isStrippableWoodBlock,
    isLiquidBucketItem,
    isLiquidBlock,
} from '../../utils/blockTypes.js';
import {
    enforceCreativeRoleAdminClaimOnly,
    blockRestrictedCreativeBlockInteract,
    blockRestrictedCreativePlace,
    resolveRestrictedCreativeBreak,
    resolveRestrictedCreativePlace,
    isRestrictedCreativeRole,
    isCreativeBuilderTagged,
    shouldBlockCreativeRoleDrop,
    syncCreativeRoleTag,
    isRestrictedCreativeItem,
    isRestrictedEntityContainer,
    denyRestrictedCreative,
    isPlayerInCreative,
} from '../../utils/creativeRoleGuard.js';
import { isRainGuiItem } from '../../utils/rainGui.js';
import {
    isItemFrameBlock,
    isEntityItemFrame,
    isArmorStandEntity,
    isDecorEntity,
    shouldProtectDecor,
    getDecorDamagePlayer,
    snapshotDecorEntity,
    restoreDecorEntity,
    queueDecorRestore,
    takePendingDecorRestore,
    queueItemFrameRestore,
    enforceProtectedItemFrame,
    enforceProtectedEntityFrame,
    enforceProtectedArmorStand,
    registerFrameTheftWatch,
    registerEntityFrameTheftWatch,
    registerArmorStandBreakWatch,
    queueArmorStandRestore,
    handleFrameTheftInventoryChange,
    canSnapshotDecorSwing,
    queueDecorEntityInteractRestore,
    takePendingDecorEntityInteractRestore,
    peekPendingArmorStandRestore,
} from '../../utils/claimDecor.js';
import { findPlayerPermRecord, isClaimPermAllowed, hasRoleClaimBypass, isFactionClaimMember, syncFactionPublicToDefaultPermissions } from '../../utils/claimPermissions.js';
import { isTester } from '../../utils/creativeRoleGuard.js';
import { isStaffPlayer } from '../../systems/ranks.js';
import {
    isClaimBypassToolItem,
    isClaimBreakToolItemUse,
    claimPermForToolUse,
} from '../../utils/tinkersClaim.js';

// ==========================================
// TRUST / PERMISSION HELPERS
// ==========================================
function isFullyTrusted(plot, player) {
    if (!plot || !player) return false;

    if (plot.factionClaim) syncFactionPublicToDefaultPermissions(plot);

    if (plot.ownerId === player.id || plot.ownerName === player.name) return true;
    if (isFactionClaimMember(plot, player)) return true;
    if (!isRestrictedCreativeRole(player) && isStaffPlayer(player) && !isTester(player)) return true;
    if (hasRoleClaimBypass(plot, player)) return true;

    const pName = player.name.toLowerCase();

    if (Array.isArray(plot.permissions?.guests) && plot.permissions.guests.map((n) => String(n).toLowerCase()).includes(pName)) {
        return true;
    }

    if (Array.isArray(plot.members) && plot.members.map(n => String(n).toLowerCase()).includes(pName)) return true;
    if (Array.isArray(plot.trusted) && plot.trusted.map(n => String(n).toLowerCase()).includes(pName)) return true;

    const record = findPlayerPermRecord(plot, player);
    return record?.entry === true;
}

function shouldProtect(plot, player, permKey) {
    if (isFullyTrusted(plot, player)) return false;

    // Per-player overrides win over public defaults (e.g. public enter on, player enter off).
    return !isClaimPermAllowed(plot, player, permKey);
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

function getClaimAtLocation(location, dimensionId) {
    return getGlobalPlotAtLocation(location, dimensionId);
}

function getPushOutLocation(player, plot) {
    const loc = player.location;

    const minX = Math.min(plot.minX, plot.maxX);
    const maxX = Math.max(plot.minX, plot.maxX);
    const minZ = Math.min(plot.minZ, plot.maxZ);
    const maxZ = Math.max(plot.minZ, plot.maxZ);

    const options = [
        { x: minX - 1.5, z: loc.z, dist: Math.abs(minX - loc.x) },
        { x: maxX + 1.5, z: loc.z, dist: Math.abs(maxX - loc.x) },
        { x: loc.x, z: minZ - 1.5, dist: Math.abs(minZ - loc.z) },
        { x: loc.x, z: maxZ + 1.5, dist: Math.abs(maxZ - loc.z) }
    ];

    options.sort((a, b) => a.dist - b.dist);

    return {
        x: options[0].x,
        y: loc.y,
        z: options[0].z
    };
}

// ==========================================
// TYPE HELPERS
// ==========================================
function isProtectedInteractBlock(blockId) {
    return isSignBlock(blockId) || isDecorInteractBlock(blockId);
}

function isContainerBlock(blockId) {
    return isStorageContainerBlock(blockId);
}

function isDoorBlock(blockId) {
    const id = String(blockId || '').toLowerCase();

    return (
        id.includes('door') ||
        id.includes('trapdoor') ||
        id.includes('fence_gate')
    );
}

function isProtectedInteractEntity(entityId) {
    const id = String(entityId || '').toLowerCase();

    if (id === 'minecraft:player') return false;

    return (
        id === 'minecraft:armor_stand' ||
        id === 'minecraft:item_frame' ||
        id === 'minecraft:glow_item_frame' ||
        id === 'minecraft:painting' ||
        id.includes('minecart') ||
        id.includes('boat') ||
        id.includes('villager') ||
        id.includes('npc')
    );
}

function isProtectedDecorEntity(entityId) {
    return isDecorEntity(entityId);
}

const DECOR_DENY_TOAST_KEY = 'plot_decor_deny';

function denyDecor(player, plot) {
    toastDeny(
        player,
        `_r4ui:toast_1.tip.§cYou cannot take items from item frames or break armor stands in ${plot?.name || 'this plot'}.`,
        DECOR_DENY_TOAST_KEY
    );
}

function blockDecorFrameUse(player, block, ev) {
    if (!player || !block || !isItemFrameBlock(block.typeId)) return false;

    const plot = getClaimAtLocation(block.location, player.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return false;

    queueItemFrameRestore(block);
    registerFrameTheftWatch(player, block, plot);
    ev.cancel = true;
    denyDecor(player, plot);
    return true;
}

function getLookedAtBlock(player, maxDistance = 5) {
    if (!player) return null;

    try {
        const hit = player.dimension.getBlockFromRay(
            player.getHeadLocation(),
            player.getViewDirection(),
            {
                maxDistance,
                includeLiquidBlocks: false,
                includePassableBlocks: true,
            }
        );
        return hit?.block ?? null;
    } catch (e) {
        return null;
    }
}

function getLookedAtEntityItemFrame(player, maxDistance = 5) {
    if (!player) return null;

    try {
        const hits = player.getEntitiesFromViewDirection?.({ maxDistance });
        for (const hit of hits ?? []) {
            const entity = hit?.entity;
            if (entity?.isValid && isEntityItemFrame(entity.typeId)) return entity;
        }
    } catch (e) {}

    return null;
}

function getTargetEntityItemFrame(player, maxDistance = 5) {
    const direct = getLookedAtEntityItemFrame(player, maxDistance);
    if (direct) return direct;

    try {
        const hits = player.getEntitiesFromViewDirection?.({ maxDistance });
        for (const hit of hits ?? []) {
            const entity = hit?.entity;
            if (entity?.isValid && isEntityItemFrame(entity.typeId)) return entity;
        }
    } catch (e) {}

    try {
        const head = player.getHeadLocation();
        const view = player.getViewDirection();
        const probe = {
            x: head.x + view.x * 1.5,
            y: head.y + view.y * 1.5,
            z: head.z + view.z * 1.5,
        };

        for (const typeId of ["minecraft:item_frame", "minecraft:glow_item_frame"]) {
            const nearby = player.dimension.getEntities({
                type: typeId,
                location: probe,
                maxDistance: 2,
            });
            if (nearby?.[0]?.isValid) return nearby[0];
        }
    } catch (e) {}

    const block = getLookedAtBlock(player, maxDistance);
    if (!block) return null;

    try {
        for (const typeId of ["minecraft:item_frame", "minecraft:glow_item_frame"]) {
            const nearby = block.dimension.getEntities({
                type: typeId,
                location: block.location,
                maxDistance: 2,
            });
            if (nearby?.[0]?.isValid) return nearby[0];
        }
    } catch (e) {}

    return null;
}

function getTargetArmorStand(player, maxDistance = 5) {
    if (!player) return null;

    try {
        const hits = player.getEntitiesFromViewDirection?.({ maxDistance });
        for (const hit of hits ?? []) {
            const entity = hit?.entity;
            if (entity?.isValid && isArmorStandEntity(entity.typeId)) return entity;
        }
    } catch (e) {}

    try {
        const head = player.getHeadLocation();
        const view = player.getViewDirection();
        const probe = {
            x: head.x + view.x * 1.5,
            y: head.y + view.y * 1.5,
            z: head.z + view.z * 1.5,
        };

        const nearby = player.dimension.getEntities({
            type: "minecraft:armor_stand",
            location: probe,
            maxDistance: 2.5,
        });
        if (nearby?.[0]?.isValid) return nearby[0];
    } catch (e) {}

    return null;
}

function snapshotProtectedEntityFrame(player) {
    const entity = getTargetEntityItemFrame(player);
    if (!entity) return;

    const plot = getClaimAtLocation(entity.location, entity.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return;

    queueDecorEntityInteractRestore(entity);
    registerEntityFrameTheftWatch(player, entity, plot);
}

function snapshotProtectedDecorSwing(player) {
    if (!player || !canSnapshotDecorSwing(player.id)) return;

    const entity = getTargetEntityItemFrame(player);
    if (entity) {
        const plot = getClaimAtLocation(entity.location, entity.dimension.id);
        if (plot && shouldProtectDecor(plot, player)) {
            queueDecorEntityInteractRestore(entity);
            registerEntityFrameTheftWatch(player, entity, plot);
            return;
        }
    }

    const stand = getTargetArmorStand(player);
    if (stand) {
        const plot = getClaimAtLocation(stand.location, stand.dimension.id);
        if (plot && shouldProtectDecor(plot, player)) {
            queueArmorStandRestore(stand);
            registerArmorStandBreakWatch(player, stand, plot);
            return;
        }
    }

    const block = getLookedAtBlock(player);
    if (block && isItemFrameBlock(block.typeId)) {
        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtectDecor(plot, player)) {
            queueItemFrameRestore(block);
            registerFrameTheftWatch(player, block, plot);
        }
    }
}

function restoreBlockedDecorFrame(player, block) {
    if (!player || !block || !isItemFrameBlock(block.typeId)) return;

    const plot = getClaimAtLocation(block.location, player.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return;

    queueItemFrameRestore(block);
    registerFrameTheftWatch(player, block, plot);
    enforceProtectedItemFrame(player, block, null, null);
}

function blockDecorEntityUse(player, target, ev) {
    if (!player || !target || !isDecorEntity(target.typeId)) return false;

    const plot = getClaimAtLocation(target.location, target.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return false;

    queueDecorEntityInteractRestore(target);
    if (isEntityItemFrame(target.typeId)) {
        registerEntityFrameTheftWatch(player, target, plot);
    } else if (isArmorStandEntity(target.typeId)) {
        queueArmorStandRestore(target);
        registerArmorStandBreakWatch(player, target, plot);
    }
    ev.cancel = true;
    denyDecor(player, plot);
    return true;
}

function restoreBlockedDecorEntity(player, target) {
    if (!player || !target || !isDecorEntity(target.typeId)) return;

    const plot = getClaimAtLocation(target.location, target.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return;

    if (isEntityItemFrame(target.typeId)) {
        queueDecorEntityInteractRestore(target);
        registerEntityFrameTheftWatch(player, target, plot);
        enforceProtectedEntityFrame(player, target, null);
        return;
    }

    if (isArmorStandEntity(target.typeId)) {
        queueArmorStandRestore(target);
        registerArmorStandBreakWatch(player, target, plot);
        enforceProtectedArmorStand(player, target, null);
        return;
    }

    const snap = takePendingDecorEntityInteractRestore(target.id);
    if (snap) restoreDecorEntity(snap, player);
}

// ==========================================
// BLOCK BREAK PROTECTION
// Also protects frame/sign/shelf/lectern-style blocks using protectInteract.
// ==========================================
export default {
    name: 'playerBreakBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        if (player.hasTag('in_spleef')) {
            const blockId = String(block.typeId || '').toLowerCase();
            if (
                blockId === 'minecraft:snow' ||
                blockId === 'minecraft:snow_layer' ||
                blockId.includes('snow')
            ) {
                return;
            }
        }

        const breakResult = resolveRestrictedCreativeBreak(player, block, ev);
        if (breakResult === 'blocked') return;

        const location = block.location;
        const dimensionId = player.dimension.id;
        const blockId = String(block.typeId || '').toLowerCase();

        const plot = getClaimAtLocation(location, dimensionId);
        if (!plot) return;

        if (isItemFrameBlock(blockId) && shouldProtectDecor(plot, player)) {
            queueItemFrameRestore(block);
            registerFrameTheftWatch(player, block, plot);
            ev.cancel = true;
            denyDecor(player, plot);
            return;
        }

        if (isProtectedInteractBlock(blockId) && shouldProtect(plot, player, 'protectInteract')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot break item frames, signs, shelves, or lecterns in ${plot.name || 'this plot'}.`,
                'plot_decor_block_break'
            );

            return;
        }

        if (plot && shouldProtect(plot, player, 'protectBreak')) {
            if (breakResult === 'allowed') return;

            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot break blocks in ${plot.name || 'this plot'}.`,
                'plot_break'
            );

            return;
        }
    }
};

// ==========================================
// BLOCK PLACE PROTECTION
// ==========================================
export const plotPlaceProtection = {
    name: 'playerPlaceBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;
        if (isLiquidBlock(block.typeId)) return;

        const placeResult = resolveRestrictedCreativePlace(player, block, ev);
        if (placeResult === 'blocked') return;

        const location = block.location;
        const dimensionId = player.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (plot && shouldProtect(plot, player, 'protectPlace')) {
            if (placeResult === 'allowed') return;

            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot place blocks in ${plot.name || 'this plot'}.`,
                'plot_place'
            );

            return;
        }
    }
};

// ==========================================
// ITEM FRAME / SIGN / SHELF / LECTERN PROTECTION
// Handles right-click/using decor blocks.
// ==========================================
export const plotInteractProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        const blockId = String(block.typeId || '').toLowerCase();

        if (blockRestrictedCreativeBlockInteract(player, blockId, ev)) return;

        if (isClaimWorkstationBlock(blockId)) return;

        if (isItemFrameBlock(blockId)) {
            if (blockDecorFrameUse(player, block, ev)) return;
        }

        if (isSignBlock(blockId)) {
            const plot = getClaimAtLocation(block.location, player.dimension.id);
            if (plot && shouldProtect(plot, player, 'protectInteract')) {
                ev.cancel = true;
                toastDeny(
                    player,
                    `_r4ui:toast_1.tip.§cYou cannot edit signs in ${plot.name || 'this plot'}.`,
                    'plot_interact_sign'
                );
            }
            return;
        }

        if (!isDecorInteractBlock(blockId)) return;

        const location = block.location;
        const dimensionId = player.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (plot && shouldProtect(plot, player, 'protectInteract')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot use shelves or lecterns in ${plot.name || 'this plot'}.`,
                'plot_interact_decor'
            );

            return;
        }
    }
};

// ==========================================
// CONTAINER PROTECTION
// ==========================================
export const plotContainerProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        const blockId = String(block.typeId || '').toLowerCase();

        if (blockRestrictedCreativeBlockInteract(player, blockId, ev)) return;

        if (isClaimWorkstationBlock(blockId)) return;

        // Keep decor/shelf/sign messages separate from container messages.
        if (isProtectedInteractBlock(blockId)) return;
        if (!isContainerBlock(blockId)) return;

        const location = block.location;
        const dimensionId = player.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (plot && shouldProtect(plot, player, 'protectContainer')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot open containers in ${plot.name || 'this plot'}.`,
                'plot_container'
            );

            return;
        }
    }
};

// ==========================================
// ITEM FRAME itemUseOn (place/take via item use)
// ==========================================
export const plotItemFrameUseProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        if (!player || player.typeId !== 'minecraft:player' || !block) return;

        if (isRestrictedCreativeRole(player)) {
            ev.cancel = true;
            system.run(() => {
                denyRestrictedCreative(
                    player,
                    'anti_abuse_frame_use',
                    'You cannot put items on Item Frames or Armor Stands.'
                );
            });
            return;
        }

        if (!isItemFrameBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtectDecor(plot, player)) {
            blockDecorFrameUse(player, block, ev);
        }
    }
};

// Bedrock often ignores cancel for survival frame interactions — restore after the fact.
export const plotDecorFrameInteractRestore = {
    name: 'playerInteractWithBlock',
    type: 1,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block || !isItemFrameBlock(block.typeId)) return;
        restoreBlockedDecorFrame(player, block);
    }
};

export const plotDecorFrameUseRestore = {
    name: 'itemUseOn',
    type: 1,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        if (!player || player.typeId !== 'minecraft:player' || !block || !isItemFrameBlock(block.typeId)) return;
        restoreBlockedDecorFrame(player, block);
    }
};

export const plotDecorFrameBreakRestore = {
    name: 'playerBreakBlock',
    type: 1,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block || !isItemFrameBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (!plot || !shouldProtectDecor(plot, player)) return;

        enforceProtectedItemFrame(player, block, null, null);
    }
};

// One swing handler — block + entity snapshot (Realm: avoids 4 raycasts per punch).
export const plotDecorSwingSnapshot = {
    name: 'playerSwingStart',
    type: 0,

    run: async (ev) => {
        const player = ev.player;
        if (!player || player.typeId !== 'minecraft:player') return;
        snapshotProtectedDecorSwing(player);
    }
};

export const plotDecorFrameHitBefore = {
    name: 'entityHitBlock',
    type: 0,

    run: async (ev) => {
        const player = ev.damagingEntity;
        const block = ev.block ?? ev.hitBlock;
        if (!player || player.typeId !== 'minecraft:player' || !block) return;
        if (!isItemFrameBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, block.dimension.id);
        if (!plot || !shouldProtectDecor(plot, player)) return;

        queueItemFrameRestore(block);
        registerFrameTheftWatch(player, block, plot);
        ev.cancel = true;
        denyDecor(player, plot);
    }
};

export const plotDecorFrameHitRestore = {
    name: 'entityHitBlock',
    type: 1,

    run: async (ev) => {
        const player = ev.damagingEntity;
        const block = ev.hitBlock ?? ev.block;
        if (!player || player.typeId !== 'minecraft:player' || !block) return;
        if (!isItemFrameBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, block.dimension.id);
        if (!plot || !shouldProtectDecor(plot, player)) return;

        queueItemFrameRestore(block);
        registerFrameTheftWatch(player, block, plot);
        enforceProtectedItemFrame(player, block, ev.hitBlockPermutation, null);
    }
};

export const plotDecorFrameInventoryRestore = {
    name: 'playerInventoryItemChange',
    type: 1,

    run: async (ev) => {
        const player = ev.player;
        if (!player || player.typeId !== 'minecraft:player') return;
        handleFrameTheftInventoryChange(player, ev.itemStack, ev.beforeItemStack);
    }
};

// ==========================================
// TINKERS / SPONGE TOOL PROTECTION (itemUse bypasses break checks)
// ==========================================
export const plotTinkersToolUseOnProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !block || !item) return;
        if (!isClaimBypassToolItem(item.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        const permKey = claimPermForToolUse(item.typeId);
        if (plot && shouldProtect(plot, player, permKey)) {
            ev.cancel = true;
            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot use that tool in ${plot.name || 'this claim'}.`,
                'plot_tc_tool'
            );
        }
    }
};

export const plotTinkersToolUseProtection = {
    name: 'itemUse',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !item) return;
        // Only block actual break-style tools on itemUse (not food, armour, etc.)
        if (!isClaimBreakToolItemUse(item.typeId)) return;

        const plot = getClaimAtLocation(player.location, player.dimension.id);
        const permKey = claimPermForToolUse(item.typeId);
        if (plot && shouldProtect(plot, player, permKey)) {
            ev.cancel = true;
            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot use that tool in ${plot.name || 'this claim'}.`,
                'plot_tc_tool'
            );
        }
    }
};

// ==========================================
// LIQUID BUCKET PROTECTION (water/lava/essentials)
// ==========================================
export const plotLiquidUseProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !block || !item) return;
        if (!isLiquidBucketItem(item.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectLiquid')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot place liquids in ${plot.name || 'this plot'}.`,
                'plot_liquid'
            );
        }
    }
};

export const plotLiquidInteractProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        let item;
        try {
            const inv = player.getComponent('minecraft:inventory')?.container;
            item = inv?.getItem(player.selectedSlotIndex);
        } catch (e) {
            return;
        }

        if (!item || !isLiquidBucketItem(item.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectLiquid')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot place liquids in ${plot.name || 'this plot'}.`,
                'plot_liquid'
            );
        }
    }
};

function getLiquidUseTargetLocation(player) {
    try {
        const hit = player.getBlockFromViewDirection({ maxDistance: 6 });
        if (hit?.block) return hit.block.location;
    } catch (e) {}

    const loc = player.location;
    return {
        x: Math.floor(loc.x),
        y: Math.floor(loc.y),
        z: Math.floor(loc.z),
    };
}

/** Essentials big buckets use itemUse (not itemUseOn) to place up to 5 liquid blocks. */
export const plotLiquidItemUseProtection = {
    name: 'itemUse',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !item) return;
        if (!isLiquidBucketItem(item.typeId)) return;

        if (enforceCreativeRoleAdminClaimOnly(player, getLiquidUseTargetLocation(player), 'place liquids')) {
            ev.cancel = true;
            return;
        }

        const target = getLiquidUseTargetLocation(player);
        const plot = getClaimAtLocation(target, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectLiquid')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot place liquids in ${plot.name || 'this plot'}.`,
                'plot_liquid'
            );
        }
    }
};

export const plotLiquidPlaceProtection = {
    name: 'playerPlaceBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block || !isLiquidBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectLiquid')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot place liquids in ${plot.name || 'this plot'}.`,
                'plot_liquid'
            );
        }
    }
};

// Liquids are blocked at placement time (itemUse / itemUseOn / interact / placeBlock).
// Do not run periodic liquid deletion — it removed legit water/lava for owners and trusted players.

// ==========================================
// LOG / WOOD STRIP PROTECTION (axe on logs)
// ==========================================
export const plotLogStripUseProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !block || !item) return;
        if (!isAxeItem(item.typeId) || !isStrippableWoodBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectBreak')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot strip logs in ${plot.name || 'this plot'}.`,
                'plot_strip_log'
            );
        }
    }
};

export const plotLogStripInteractProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        let item;
        try {
            const inv = player.getComponent('minecraft:inventory')?.container;
            item = inv?.getItem(player.selectedSlotIndex);
        } catch (e) {
            return;
        }

        if (!item || !isAxeItem(item.typeId) || !isStrippableWoodBlock(block.typeId)) return;

        const plot = getClaimAtLocation(block.location, player.dimension.id);
        if (plot && shouldProtect(plot, player, 'protectBreak')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot strip logs in ${plot.name || 'this plot'}.`,
                'plot_strip_log'
            );
        }
    }
};

// ==========================================
// DOOR PROTECTION
// ==========================================
export const plotDoorProtection = {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block } = ev;
        if (!player || !block) return;

        if (!isDoorBlock(block.typeId)) return;
        if (isBountyHunterActive(player)) return;

        const location = block.location;
        const dimensionId = player.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (plot && shouldProtect(plot, player, 'protectDoors')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot open doors in ${plot.name || 'this plot'}.`,
                'plot_doors'
            );

            return;
        }
    }
};

// ==========================================
// ENTITY INTERACTION PROTECTION
// Handles taking/rotating item frames and using armor stands.
// ==========================================
export const plotEntityInteractProtection = {
    name: 'playerInteractWithEntity',
    type: 0,

    run: async (ev) => {
        const { player, target } = ev;
        if (!player || !target) return;

        if (isRestrictedCreativeRole(player)) {
            const targetId = String(target.typeId || '').toLowerCase();
            if (isRestrictedEntityContainer(targetId)) {
                ev.cancel = true;
                system.run(() => {
                    denyRestrictedCreative(
                        player,
                        'anti_abuse_stand',
                        'Entity inventories, stands, and frames are locked in Creative mode.'
                    );
                });
                return;
            }
        }

        if (!isProtectedInteractEntity(target.typeId)) return;

        const location = target.location;
        const dimensionId = target.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (!plot) return;

        if (isDecorEntity(target.typeId)) {
            blockDecorEntityUse(player, target, ev);
            return;
        }

        if (shouldProtect(plot, player, 'protectInteract')) {
            ev.cancel = true;

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot use or take items from minecarts, boats, or entities in ${plot.name || 'this plot'}.`,
                'plot_entity_interact'
            );

            return;
        }
    }
};

export const plotDecorEntityInteractRestore = {
    name: 'playerInteractWithEntity',
    type: 1,

    run: async (ev) => {
        const { player, target } = ev;
        if (!player || !target) return;
        restoreBlockedDecorEntity(player, target);
    }
};

// ==========================================
// ENTITY DAMAGE / KILL PROTECTION
// Handles breaking armor stands, item frames, glow item frames, and paintings.
// ==========================================
function blockDecorEntityHit(player, target, ev) {
    if (!player || player.typeId !== 'minecraft:player' || !target) return false;

    if (!isProtectedDecorEntity(target.typeId)) return false;

    const plot = getClaimAtLocation(target.location, target.dimension.id);
    if (!plot || !shouldProtectDecor(plot, player)) return false;

    if (isEntityItemFrame(target.typeId)) {
        queueDecorEntityInteractRestore(target);
        registerEntityFrameTheftWatch(player, target, plot);
        enforceProtectedEntityFrame(player, target, null);
        ev.cancel = true;
        denyDecor(player, plot);
        return true;
    }

    if (isArmorStandEntity(target.typeId)) {
        queueArmorStandRestore(target);
        registerArmorStandBreakWatch(player, target, plot);
        ev.cancel = true;
        denyDecor(player, plot);
        return true;
    }

    ev.cancel = true;
    return true;
}

export const plotEntityKillProtection = {
    name: 'entityHurt',
    type: 0,

    run: async (ev) => {
        const hurtEntity = ev.hurtEntity;
        const attacker = getDecorDamagePlayer(ev.damageSource);

        if (!hurtEntity) return;
        if (hurtEntity.typeId === 'minecraft:player') return;

        const location = hurtEntity.location;
        const dimensionId = hurtEntity.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (!plot) return;

        if (isProtectedDecorEntity(hurtEntity.typeId)) {
            if (!attacker || shouldProtectDecor(plot, attacker)) {
                if (attacker && isEntityItemFrame(hurtEntity.typeId) && shouldProtectDecor(plot, attacker)) {
                    queueDecorEntityInteractRestore(hurtEntity);
                    registerEntityFrameTheftWatch(attacker, hurtEntity, plot);
                    enforceProtectedEntityFrame(attacker, hurtEntity, null);
                    ev.cancel = true;
                    denyDecor(attacker, plot);
                    return;
                }
                if (attacker && isArmorStandEntity(hurtEntity.typeId) && shouldProtectDecor(plot, attacker)) {
                    queueArmorStandRestore(hurtEntity);
                    registerArmorStandBreakWatch(attacker, hurtEntity, plot);
                    ev.cancel = true;
                    denyDecor(attacker, plot);
                    return;
                }
                ev.cancel = true;
            }
            return;
        }

        if (!attacker) {
            if ((plot.permissions?.default || plot.permissions || {}).protectEntityKill !== false) {
                ev.cancel = true;
            }

            return;
        }

        if (shouldProtect(plot, attacker, 'protectEntityKill')) {
            ev.cancel = true;

            toastDeny(
                attacker,
                `_r4ui:toast_1.tip.§cYou cannot damage or kill entities in ${plot.name || 'this plot'}.`,
                'plot_entity_kill'
            );

            return;
        }
    }
};

// Armor stands often ignore cancel on hit — still try to block damage here (no toast).
export const plotDecorEntityHitProtection = {
    name: 'entityHitEntity',
    type: 0,

    run: async (ev) => {
        blockDecorEntityHit(ev.damagingEntity, ev.hitEntity, ev);
    }
};

export const plotDecorEntityHitRestore = {
    name: 'entityHitEntity',
    type: 1,

    run: async (ev) => {
        const player = ev.damagingEntity;
        const target = ev.hitEntity;
        if (!player || player.typeId !== 'minecraft:player' || !target) return;

        const plot = getClaimAtLocation(target.location, target.dimension.id);
        if (!plot || !shouldProtectDecor(plot, player)) return;

        if (isEntityItemFrame(target.typeId)) {
            queueDecorEntityInteractRestore(target);
            registerEntityFrameTheftWatch(player, target, plot);
            enforceProtectedEntityFrame(player, target, null);
            return;
        }

        if (isArmorStandEntity(target.typeId)) {
            queueArmorStandRestore(target);
            registerArmorStandBreakWatch(player, target, plot);
            enforceProtectedArmorStand(player, target, null);
        }
    }
};

export const plotDecorEntityHurtRestore = {
    name: 'entityHurt',
    type: 1,

    run: async (ev) => {
        const hurtEntity = ev.hurtEntity;
        const attacker = getDecorDamagePlayer(ev.damageSource);
        if (!hurtEntity || !attacker) return;

        const plot = getClaimAtLocation(hurtEntity.location, hurtEntity.dimension.id);
        if (!plot || !shouldProtectDecor(plot, attacker)) return;

        if (isEntityItemFrame(hurtEntity.typeId)) {
            queueDecorEntityInteractRestore(hurtEntity);
            registerEntityFrameTheftWatch(attacker, hurtEntity, plot);
            enforceProtectedEntityFrame(attacker, hurtEntity, null);
            return;
        }

        if (isArmorStandEntity(hurtEntity.typeId)) {
            queueArmorStandRestore(hurtEntity);
            registerArmorStandBreakWatch(attacker, hurtEntity, plot);
            enforceProtectedArmorStand(attacker, hurtEntity, null);
        }
    }
};

// Block decor entity death; toast once here. Restore runs in afterEvents if cancel is ignored.
export const plotDecorEntityDieProtection = {
    name: 'entityDie',
    type: 0,

    run: async (ev) => {
        const deadEntity = ev.deadEntity;
        if (!deadEntity || !isProtectedDecorEntity(deadEntity.typeId)) return;

        const plot = getClaimAtLocation(deadEntity.location, deadEntity.dimension.id);
        if (!plot) return;

        const attacker = getDecorDamagePlayer(ev.damageSource);
        if (!attacker) {
            ev.cancel = true;
            return;
        }

        if (!shouldProtectDecor(plot, attacker)) return;

        let snap = peekPendingArmorStandRestore(deadEntity.id) || snapshotDecorEntity(deadEntity);
        if (snap) queueDecorRestore(deadEntity.id, snap);

        ev.cancel = true;
        denyDecor(attacker, plot);
    }
};

export const plotDecorEntityDieRestoreProtection = {
    name: 'entityDie',
    type: 1,

    run: async (ev) => {
        const deadEntity = ev.deadEntity;
        if (!deadEntity) return;

        let snap = takePendingDecorRestore(deadEntity.id);

        if (!snap && isProtectedDecorEntity(deadEntity.typeId)) {
            const plot = getClaimAtLocation(deadEntity.location, deadEntity.dimension.id);
            const attacker = getDecorDamagePlayer(ev.damageSource);

            if (plot && attacker && shouldProtectDecor(plot, attacker)) {
                snap = snapshotDecorEntity(deadEntity) || peekPendingArmorStandRestore(deadEntity.id);
                denyDecor(attacker, plot);
            }
        }

        if (snap) restoreDecorEntity(snap, getDecorDamagePlayer(ev.damageSource));
    }
};

// ==========================================
// ENTER CLAIM PROTECTION
// ==========================================
const lastAllowedClaimLocation = new Map();
const lastEnterCheckBlock = new Map();
/** Inside a blocked claim and being pushed out. */
const enterDenyActiveWatch = new Set();
/** Inside a blocked claim but combat temporarily blocks the kick. */
const enterDenyCombatDeferred = new Set();

function getEnterBlockKey(player) {
    const loc = player.location;
    return `${Math.floor(loc.x)}:${Math.floor(loc.y)}:${Math.floor(loc.z)}:${player.dimension.id}`;
}

function tickPlotEnterDenyForPlayer(player, force = false) {
    if (player?.hasTag?.('bounty_mode')) {
        enterDenyActiveWatch.delete(player.id);
        enterDenyCombatDeferred.delete(player.id);
        return;
    }

    const location = player.location;
    const dimensionId = player.dimension.id;
    const blockKey = getEnterBlockKey(player);
    const pushing = enterDenyActiveWatch.has(player.id);
    const combatDeferred = enterDenyCombatDeferred.has(player.id);
    const moved = lastEnterCheckBlock.get(player.id) !== blockKey;

    if (!force && !pushing && !combatDeferred && !moved) return;

    lastEnterCheckBlock.set(player.id, blockKey);

    const plot = getClaimAtLocation(location, dimensionId);

    if (!plot || !shouldProtect(plot, player, 'protectEnter')) {
        enterDenyActiveWatch.delete(player.id);
        enterDenyCombatDeferred.delete(player.id);
        lastAllowedClaimLocation.set(player.id, {
            location: { x: location.x, y: location.y, z: location.z },
            dimensionId
        });

        return;
    }

    // Defer the kick while in combat, but keep polling so we eject as soon as combat ends.
    if (getCombatRemainingSeconds(player) > 0) {
        enterDenyCombatDeferred.add(player.id);
        return;
    }

    enterDenyCombatDeferred.delete(player.id);
    enterDenyActiveWatch.add(player.id);

    const lastSafe = lastAllowedClaimLocation.get(player.id);

    let targetLocation;
    let targetDimension = player.dimension;

    if (lastSafe) {
        targetLocation = lastSafe.location;

        try {
            targetDimension = world.getDimension(lastSafe.dimensionId);
        } catch (e) {
            targetDimension = player.dimension;
        }
    } else {
        targetLocation = getPushOutLocation(player, plot);
    }

    player.teleport(targetLocation, {
        dimension: targetDimension
    });

    lastEnterCheckBlock.delete(player.id);

    toastDeny(
        player,
        `_r4ui:toast_1.tip.§cYou cannot enter ${plot.name || 'this claim'}.`,
        'plot_enter'
    );
}

/** Force the next movement check after a per-player enter restriction is saved. */
export function markPlayerEnterRestricted(player) {
    if (!player?.id) return;
    lastEnterCheckBlock.delete(player.id);
}

export function clearPlayerEnterRestricted(player) {
    if (!player?.id) return;
    enterDenyActiveWatch.delete(player.id);
    enterDenyCombatDeferred.delete(player.id);
    lastEnterCheckBlock.delete(player.id);
}

/** Run enter-deny immediately for one player (e.g. after permission change). */
export function enforcePlotEnterDenyForPlayer(player) {
    if (!player) return;
    try {
        tickPlotEnterDenyForPlayer(player, true);
    } catch (e) {}
}

/** Run enter-deny for every online player inside a claim's bounds (after toggling enter protection). */
export function enforcePlotEnterDenyForClaim(plot) {
    if (!plot) return;

    let players;
    try {
        players = world.getAllPlayers();
    } catch (e) {
        return;
    }

    for (const player of players) {
        if (!isInsidePlot(player.location, player.dimension.id, plot)) continue;
        enforcePlotEnterDenyForPlayer(player);
    }
}

/** Call when a player moves to a new block (public enter block + restricted players). */
export function onPlayerEnterDenyActivation(player) {
    if (!player) return;
    try {
        tickPlotEnterDenyForPlayer(player);
    } catch (e) {}
}

function tickPlotEnterDenyPoll(players) {
    if (!players?.length) return;

    for (const player of players) {
        const blockKey = getEnterBlockKey(player);
        const moved = lastEnterCheckBlock.get(player.id) !== blockKey;
        const pushing = enterDenyActiveWatch.has(player.id);
        const combatDeferred = enterDenyCombatDeferred.has(player.id);

        // Idle players are skipped unless being pushed out or waiting for combat to end.
        if (!moved && !pushing && !combatDeferred) continue;

        try {
            tickPlotEnterDenyForPlayer(player);
        } catch (e) {}
    }
}

// Enter-deny poll — staggered inside the Realm master loop (every 2 passes ≈ 40 ticks).
registerRealmHook(REALM_STAGGER.MEDIUM, (players) => {
    tickPlotEnterDenyPoll(players);
});

if (world.afterEvents?.playerSpawn) {
    world.afterEvents.playerSpawn.subscribe(({ player }) => {
        system.run(() => enforcePlotEnterDenyForPlayer(player));
    });
}

if (world.afterEvents?.playerDimensionChange) {
    world.afterEvents.playerDimensionChange.subscribe(({ player }) => {
        system.run(() => enforcePlotEnterDenyForPlayer(player));
    });
}

if (world.afterEvents?.playerLeave) {
    world.afterEvents.playerLeave.subscribe(({ playerId }) => {
        enterDenyActiveWatch.delete(playerId);
        enterDenyCombatDeferred.delete(playerId);
        lastEnterCheckBlock.delete(playerId);
        lastAllowedClaimLocation.delete(playerId);
    });
}

// ==========================================
// CREATIVE BUILDER / TESTER ROLE GUARD (early in registry)
// ==========================================
export const plotCreativeRoleItemUseProtection = {
    name: 'itemUse',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !item) return;
        if (!isRestrictedCreativeRole(player)) return;
        if (!isRestrictedCreativeItem(item.typeId)) return;

        ev.cancel = true;
        system.run(() => {
            denyRestrictedCreative(player, 'anti_abuse_item', 'This item is locked in Creative mode.');
        });
    }
};

export const plotCreativeRoleItemUseOnProtection = {
    name: 'itemUseOn',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        const block = ev.block;
        const item = ev.itemStack;
        if (!player || player.typeId !== 'minecraft:player' || !block) return;
        if (!isRestrictedCreativeRole(player)) return;

        const blockId = String(block.typeId || '').toLowerCase();
        if (blockRestrictedCreativeBlockInteract(player, blockId, ev)) return;

        if (item && isRestrictedCreativeItem(item.typeId)) {
            ev.cancel = true;
            system.run(() => {
                denyRestrictedCreative(
                    player,
                    'builder_blacklist',
                    'This item is permanently blacklisted in Creative mode.'
                );
            });
        }
    }
};

export const plotCreativeRoleDropProtection = {
    name: 'playerDropItem',
    type: 0,

    run: async (ev) => {
        const player = ev.source;
        if (!player || player.typeId !== 'minecraft:player') return;
        syncCreativeRoleTag(player);
        if (!shouldBlockCreativeRoleDrop(player)) return;
        if (isRainGuiItem(ev.itemStack)) return;

        ev.cancel = true;
        system.run(() => {
            denyRestrictedCreative(player, 'anti_abuse_drop', 'You cannot drop items in Creative mode.');
        });
    }
};

// ==========================================
// ENDER PEARL PROTECTION
// ==========================================
function restoreCancelledEnderPearl(player, expectedAmount = 1) {
    if (!player?.isValid) return;
    system.run(() => {
        try {
            const inv = player.getComponent('minecraft:inventory')?.container;
            if (!inv) return;
            const safeExpected = Math.max(1, Math.min(64, Number(expectedAmount) || 1));

            const slot = Number(player.selectedSlotIndex);
            const handItem = Number.isInteger(slot) ? inv.getItem(slot) : undefined;
            if (!handItem) {
                inv.setItem(slot, new ItemStack('minecraft:ender_pearl', safeExpected));
                return;
            }
            if (handItem.typeId === 'minecraft:ender_pearl' && handItem.amount < safeExpected) {
                const updated = handItem.clone();
                updated.amount = safeExpected;
                inv.setItem(slot, updated);
                return;
            }

            const leftover = inv.addItem(new ItemStack('minecraft:ender_pearl', safeExpected));
            if (leftover) player.dimension.spawnItem(leftover, player.location);
        } catch (e) {}
    });
}

export const plotEnderPearlProtection = {
    name: 'itemUse',
    type: 0,

    run: async (ev) => {
        const { source: player, itemStack } = ev;

        if (!player || player.typeId !== 'minecraft:player') return;
        if (itemStack?.typeId !== 'minecraft:ender_pearl') return;
        if (isPlayerInCreative(player)) return;

        const location = player.location;
        const dimensionId = player.dimension.id;

        const plot = getClaimAtLocation(location, dimensionId);
        if (plot && shouldProtect(plot, player, 'protectEnderPearls')) {
            ev.cancel = true;
            restoreCancelledEnderPearl(player, itemStack.amount ?? 1);

            toastDeny(
                player,
                `_r4ui:toast_1.tip.§cYou cannot use ender pearls in ${plot.name || 'this plot'}.`,
                'plot_ender_pearl'
            );

            return;
        }
    }
};
