import { system, world, ItemStack } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';
import { getAllGlobalClaims, addToGlobalClaims, rebuildGlobalClaimChunkCache } from './plotHelpers.js';
import { notify } from '../../utils/realmPerf.js';
import { appendSubclaimPublicPermToggles, buildSubclaimPublicPermObject } from '../../utils/claimPermissions.js';

const MAX_CLAIM_AREA = 30000;
const MIN_DISTANCE_FROM_OTHER_CLAIMS = 50;

export default {
    name: 'playerInteractWithBlock',
    type: 0,

    run: async (ev) => {
        const { player, block, itemStack } = ev;

        if (!player || !block || !itemStack) return;
        if (itemStack.typeId !== 'minecraft:wooden_axe') return;
        if (!player.hasTag('plot_making')) return;

        const now = Date.now();
        const location = block.location;
        const dimensionId = player.dimension.id;

        const lastClick = Number(player.getDynamicProperty('last_axe_click')) || 0;

        if (now - lastClick < 500) return;

        player.setDynamicProperty('last_axe_click', now);

        const isSubclaimMode = player.hasTag('plot_subclaim_making');
        const parentClaim = isSubclaimMode ? getSubclaimParent(player) : null;

        if (isSubclaimMode && !parentClaim) {
            notify(player, "claim_err", "§c§l[ERROR]§r", "§cSubclaim parent not found. Cancelling.", "note.bass");
            cleanupPlotting(player);
            ev.cancel = true;
            return;
        }

        const rawPos1 = player.getDynamicProperty('plot_pos1');

        // CLICK 1: SET POS 1
        if (!rawPos1) {
            if (isSubclaimMode) {
                if (!isLocationInsideClaim(location, dimensionId, parentClaim)) {
                    notify(player, "claim_err", "§c§l[ERROR]§r", "§cPos1 must be inside the parent claim.", "note.bass");
                    ev.cancel = true;
                    return;
                }
            } else {
                const claimed = getAllGlobalClaims();

                for (const plot of claimed) {
                    const plotDim = plot.dimension || 'minecraft:overworld';

                    if (plotDim !== dimensionId) continue;

                    if (isLocationInsideClaim(location, dimensionId, plot)) {
                        if (sameOwner(plot, player)) {
                            notify(player, "claim_err", "§c§l[ERROR]§r", "§cCannot set Pos1 inside one of your existing plots.", "note.bass");
                        } else {
                            notify(player, "claim_err", "§c§l[ERROR]§r", "§cCannot set Pos1 inside an existing plot.", "note.bass");
                        }
                        ev.cancel = true;
                        return;
                    }
                }
            }

            player.setDynamicProperty(
                'plot_pos1',
                JSON.stringify({
                    x: location.x,
                    y: location.y,
                    z: location.z,
                    dimension: dimensionId
                })
            );

            // Toast for setting Position 1
            const modeText = isSubclaimMode ? "§d§l[SUBCLAIM]§r" : "§e§l[PLOT]§r";
            notify(player, "pos1_set", modeText, `§aPosition 1 set!\n§7X: ${Math.floor(location.x)} | Z: ${Math.floor(location.z)}\n§eClick any block for Pos2.`, "random.orb");

            system.run(() => {
                player.dimension.spawnParticle(
                    'minecraft:balloon_gas_particle',
                    {
                        x: location.x + 1,
                        y: location.y + 1,
                        z: location.z + 0.5
                    }
                );
            });

            ev.cancel = true;
            return;
        }

        // CLICK 2: SET POS 2
        const pos1 = JSON.parse(rawPos1);

        if (pos1.dimension !== dimensionId) {
            notify(player, "claim_err", "§c§l[ERROR]§r", "§cPos1 and Pos2 must be in the same dimension. Resetting...", "note.bass");
            cleanupPlotting(player);
            ev.cancel = true;
            return;
        }

        const minX = Math.floor(Math.min(pos1.x, location.x));
        const maxX = Math.floor(Math.max(pos1.x, location.x));
        const minZ = Math.floor(Math.min(pos1.z, location.z));
        const maxZ = Math.floor(Math.max(pos1.z, location.z));
        const area = (maxX - minX + 1) * (maxZ - minZ + 1);

        const isStaff = player.hasTag('staff');

        if (!isSubclaimMode && !isStaff) {
            const newClaimBounds = {
                minX,
                maxX,
                minZ,
                maxZ,
                dimension: dimensionId
            };

            const nearby = getNearbyForeignClaim(player, newClaimBounds);

            if (nearby) {
                const claimName = nearby.claim.name || 'another claim';
                const ownerName = nearby.claim.ownerName || 'Unknown';
                const dist = Math.floor(nearby.distance);

                notify(player, "claim_dist_err", "§c§l[TOO CLOSE]§r", `§cToo close to §e${claimName}§c!\n§7Must be ${MIN_DISTANCE_FROM_OTHER_CLAIMS} blocks away. (Current: ${dist})`, "note.bass");
                ev.cancel = true;
                return;
            }
        }

        if (!isStaff && area > MAX_CLAIM_AREA) {
            notify(player, "claim_size_err", "§c§l[TOO LARGE]§r", `§cPlot exceeds max size!\n§7Max: ${MAX_CLAIM_AREA} | Yours: ${area}`, "note.bass");
            ev.cancel = true;
            return;
        }

        if (isSubclaimMode) {
            const subclaimBounds = {
                minX,
                maxX,
                minZ,
                maxZ,
                dimension: dimensionId
            };

            if (!isSubclaimInsideParent(subclaimBounds, parentClaim)) {
                notify(player, "claim_err", "§c§l[ERROR]§r", "§cThe entire subclaim must be inside the parent claim.", "note.bass");
                ev.cancel = true;
                return;
            }
        }

        system.run(() => {
            player.dimension.spawnParticle(
                'minecraft:balloon_gas_particle',
                {
                    x: location.x + 1,
                    y: location.y + 1,
                    z: location.z + 0.5
                }
            );
        });

        system.runTimeout(() => {
            if (isSubclaimMode) {
                showSubclaimMenu(player, area, pos1, location, parentClaim);
            } else {
                showClaimMenu(player, area, pos1, location);
            }
        }, 5);

        ev.cancel = true;
    }
};

function getSubclaimParent(player) {
    const parentId = player.getDynamicProperty('subclaim_parent_id');
    if (!parentId) return null;
    const claims = getAllGlobalClaims();
    return claims.find(claim => claim && claim.id === parentId) || null;
}

function isLocationInsideClaim(location, dimensionId, claim) {
    if (!claim) return false;
    const claimDim = claim.dimension || 'minecraft:overworld';
    if (claimDim !== dimensionId) return false;

    const minX = Math.min(claim.minX, claim.maxX);
    const maxX = Math.max(claim.minX, claim.maxX);
    const minZ = Math.min(claim.minZ, claim.maxZ);
    const maxZ = Math.max(claim.minZ, claim.maxZ);

    return (
        location.x >= minX &&
        location.x <= maxX &&
        location.z >= minZ &&
        location.z <= maxZ
    );
}

function sameOwner(plot, player) {
    if (!plot || !player) return false;
    return (
        plot.ownerId === player.id ||
        String(plot.ownerName || '').toLowerCase() === player.name.toLowerCase()
    );
}

function rectDistance2D(a, b) {
    const aMinX = Math.min(a.minX, a.maxX);
    const aMaxX = Math.max(a.minX, a.maxX);
    const aMinZ = Math.min(a.minZ, a.maxZ);
    const aMaxZ = Math.max(a.minZ, a.maxZ);

    const bMinX = Math.min(b.minX, b.maxX);
    const bMaxX = Math.max(b.minX, b.maxX);
    const bMinZ = Math.min(b.minZ, b.maxZ);
    const bMaxZ = Math.max(b.minZ, b.maxZ);

    let dx = 0;
    let dz = 0;

    if (aMaxX < bMinX) { dx = bMinX - aMaxX; } else if (bMaxX < aMinX) { dx = aMinX - bMaxX; }
    if (aMaxZ < bMinZ) { dz = bMinZ - aMaxZ; } else if (bMaxZ < aMinZ) { dz = aMinZ - bMaxZ; }

    return Math.sqrt(dx * dx + dz * dz);
}

function getNearbyForeignClaim(player, newClaimBounds) {
    const claims = getAllGlobalClaims();

    for (const claim of claims) {
        if (!claim) continue;
        const claimDim = claim.dimension || 'minecraft:overworld';
        const newDim = newClaimBounds.dimension || 'minecraft:overworld';

        if (claimDim !== newDim) continue;
        if (sameOwner(claim, player)) continue;
        if (claim.isSubclaim) continue;

        const distance = rectDistance2D(newClaimBounds, claim);

        if (distance < MIN_DISTANCE_FROM_OTHER_CLAIMS) {
            return { claim, distance };
        }
    }
    return null;
}

function isSubclaimInsideParent(subclaim, parentClaim) {
    const childMinX = Math.min(subclaim.minX, subclaim.maxX);
    const childMaxX = Math.max(subclaim.minX, subclaim.maxX);
    const childMinZ = Math.min(subclaim.minZ, subclaim.maxZ);
    const childMaxZ = Math.max(subclaim.minZ, subclaim.maxZ);

    const parentMinX = Math.min(parentClaim.minX, parentClaim.maxX);
    const parentMaxX = Math.max(parentClaim.minX, parentClaim.maxX);
    const parentMinZ = Math.min(parentClaim.minZ, parentClaim.maxZ);
    const parentMaxZ = Math.max(parentClaim.minZ, parentClaim.maxZ);

    return (
        (subclaim.dimension || 'minecraft:overworld') === (parentClaim.dimension || 'minecraft:overworld') &&
        childMinX >= parentMinX &&
        childMaxX <= parentMaxX &&
        childMinZ >= parentMinZ &&
        childMaxZ <= parentMaxZ
    );
}

function showClaimMenu(player, area, pos1, pos2) {
    const claimForFaction = player.getDynamicProperty('claim_for_faction');

    const detailsForm = new ModalFormData()
        .title(claimForFaction ? `bd.modal:§6Faction Claim ${area} Blks` : `bd.modal:§5Claim ${area} Blocks`)
        .textField(
            claimForFaction 
                ? '§6§l[FACTION PLOT]§r\nEnter a name for your faction claim:\n§8(Close this menu to cancel)§r' 
                : 'Enter a name for your plot:\n§8(Close this menu to cancel)§r',
            claimForFaction ? 'e.g. Faction Main Base' : 'e.g. My Awesome Base',
            { defaultValue: claimForFaction ? 'Faction Outpost' : `${player.name}'s Plot` }
        )
        .submitButton(claimForFaction ? 'Claim Faction Land' : 'Claim Land');

    detailsForm.show(player).then((detailsRes) => {
        if (detailsRes.canceled) {
            notify(player, "claim_cancel", "§e§l[CANCELLED]§r", "§eClaim cancelled.\n§7Click a block to choose a new Pos2.", "random.pop");
            return;
        }

        const plotName = (detailsRes.formValues[0] || '').trim() || (claimForFaction ? 'Faction Outpost' : `${player.name}'s Plot`);

        const minX = Math.floor(Math.min(pos1.x, pos2.x));
        const maxX = Math.floor(Math.max(pos1.x, pos2.x));
        const minZ = Math.floor(Math.min(pos1.z, pos2.z));
        const maxZ = Math.floor(Math.max(pos1.z, pos2.z));
        const y = Math.floor(Math.max(pos1.y ?? 0, pos2.y ?? 0) + 1);

        const newPlot = {
            id: Date.now().toString(),
            name: plotName,
            ownerId: player.id,
            ownerName: player.name,
            minX, maxX, minZ, maxZ, y,
            dimension: player.dimension.id,
            area,
            permissions: {
                default: {
                    protectBreak: true, protectPlace: true, protectContainer: true,
                    protectInteract: true, protectEntityKill: true, protectDoors: true,
                    protectExplosion: true, protectEnter: true, protectPvp: true,
                    protectFireSpread: true,
                    protectLiquid: true,
                    allowHomes: false,
                },
                players: {},
                public: {},
            }
        };

        try {
            if (claimForFaction) {
                const factions = JSON.parse(world.getDynamicProperty('factions') || '[]');
                const fac = factions.find(f => f.id === claimForFaction);

                if (fac) {
                    newPlot.ownerId = fac.id;
                    newPlot.ownerName = fac.name;
                    newPlot.factionClaim = true;

                    fac.claims = fac.claims || [];
                    fac.claims.push(newPlot);

                    world.setDynamicProperty('factions', JSON.stringify(factions));
                    notify(player, "fac_success", "§a§l[FACTION]§r", `§aClaimed for faction:\n§e${fac.name}`, "random.levelup");
                } else {
                    notify(player, "fac_err", "§c§l[ERROR]§r", "§cFaction not found. Creating personal plot.", "note.bass");
                }
            }

            if (!newPlot.factionClaim) {
                const ownedStr = player.getDynamicProperty('owned_plots') || '[]';
                let owned = [];

                try { owned = JSON.parse(ownedStr); } catch (e) { owned = []; }

                if (Array.isArray(owned) && owned.length >= 1000) {
                    notify(player, "claim_err", "§c§l[ERROR]§r", "§cYou have reached the maximum of 1000 plots.", "note.bass");
                    cleanupPlotting(player);
                    return;
                }

                owned.push(newPlot);
                player.setDynamicProperty('owned_plots', JSON.stringify(owned));
            }

            if (!addToGlobalClaims(newPlot)) {
                if (!newPlot.factionClaim) {
                    const ownedStr = player.getDynamicProperty('owned_plots') || '[]';
                    let owned = [];
                    try { owned = JSON.parse(ownedStr); } catch (e) { owned = []; }
                    const rollbackIdx = owned.findIndex((p) => p && p.id === newPlot.id);
                    if (rollbackIdx > -1) {
                        owned.splice(rollbackIdx, 1);
                        player.setDynamicProperty('owned_plots', JSON.stringify(owned));
                    }
                }
                notify(player, "claim_err", "§c§l[ERROR]§r", "§cPlot could not be saved to world data.", "note.bass");
                cleanupPlotting(player);
                return;
            }

            rebuildGlobalClaimChunkCache(true);

            if (!newPlot.factionClaim) {
                notify(player, "claim_success", "§a§l[SUCCESS]§r", `§aSuccessfully claimed:\n§e${plotName}`, "random.levelup");
            }

            cleanupPlotting(player);
        } catch (err) {
            notify(player, "claim_err", "§c§l[ERROR]§r", "§cError saving plot data.", "note.bass");
        }
    }).catch(() => {
        notify(player, "claim_err", "§c§l[ERROR]§r", "§cFailed to open menu. Stand completely still!", "note.bass");
    });
}

function showSubclaimMenu(player, area, pos1, pos2, parentClaim) {
    let detailsForm = new ModalFormData()
        .title(`bd.modal:§dSubclaim ${area} Blocks`)
        .textField('Enter a name for this admin subclaim:', 'e.g. Spawn Shop', { defaultValue: `${parentClaim.name} Subclaim` });

    detailsForm = appendSubclaimPublicPermToggles(detailsForm, {});
    detailsForm.submitButton('Create Subclaim');

    detailsForm.show(player).then((detailsRes) => {
        if (detailsRes.canceled) {
            notify(player, "claim_cancel", "§e§l[CANCELLED]§r", "§eSubclaim cancelled.\n§7Click a block for Pos2.", "random.pop");
            return;
        }

        const rawName = detailsRes.formValues[0];
        const defaultPerms = buildSubclaimPublicPermObject(detailsRes.formValues, 1);

        const subclaimName = (rawName || '').trim() || `${parentClaim.name} Subclaim`;

        const minX = Math.floor(Math.min(pos1.x, pos2.x));
        const maxX = Math.floor(Math.max(pos1.x, pos2.x));
        const minZ = Math.floor(Math.min(pos1.z, pos2.z));
        const maxZ = Math.floor(Math.max(pos1.z, pos2.z));
        const y = Math.floor(Math.max(pos1.y ?? 0, pos2.y ?? 0) + 1);

        const subclaim = {
            id: `admin_subclaim_${Date.now()}_${Math.floor(Math.random() * 999999)}`,
            name: subclaimName,
            ownerId: 'server',
            ownerName: 'Server',
            isSubclaim: true,
            parentId: parentClaim.id,
            parentName: parentClaim.name,
            minX, maxX, minZ, maxZ, y,
            dimension: player.dimension.id,
            area,
            permissions: {
                default: defaultPerms,
                players: {}
            }
        };

        if (!isSubclaimInsideParent(subclaim, parentClaim)) {
            notify(player, "claim_err", "§c§l[ERROR]§r", "§cSubclaim must be fully inside parent claim.", "note.bass");
            return;
        }

        try {
            if (!addToGlobalClaims(subclaim)) {
                notify(player, "claim_err", "§c§l[ERROR]§r", "§cSubclaim could not be saved to world data.", "note.bass");
                return;
            }

            rebuildGlobalClaimChunkCache(true);
            notify(player, "sub_success", "§d§l[SUBCLAIM]§r", `§aSubclaim created:\n§d${subclaimName}`, "random.levelup");
            cleanupPlotting(player);
        } catch (err) {
            notify(player, "claim_err", "§c§l[ERROR]§r", "§cError saving subclaim.", "note.bass");
        }
    }).catch(() => {
        notify(player, "claim_err", "§c§l[ERROR]§r", "§cFailed to open menu. Stand completely still!", "note.bass");
    });
}

function cleanupPlotting(player) {
    player.setDynamicProperty('plot_pos1', undefined);
    player.setDynamicProperty('plot_pos2', undefined);
    player.setDynamicProperty('claim_for_faction', undefined);
    player.setDynamicProperty('subclaim_parent_id', undefined);

    player.removeTag('plot_making');
    player.removeTag('plot_subclaim_making');

    const originalStr = player.getDynamicProperty('original_item');

    if (originalStr) {
        try {
            const original = JSON.parse(originalStr);
            const inventory = player.getComponent('minecraft:inventory');

            if (inventory && inventory.container && original && original.typeId) {
                inventory.container.setItem(
                    player.selectedSlotIndex,
                    new ItemStack(original.typeId, original.amount || 1)
                );
            }
        } catch (e) {
            console.error('Failed to restore item', e);
        }
    }

    player.setDynamicProperty('original_item', undefined);
}
